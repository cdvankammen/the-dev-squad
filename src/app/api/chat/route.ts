import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { spawn as nodeSpawn } from 'child_process';
import { join, resolve, basename } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { NextRequest, NextResponse } from 'next/server';
import {
  createRunner,
  isRecoverableDockerAuthFailure,
  type PipelineAgentId,
  type RunnerOptions,
} from '../../../../pipeline/runner.ts';
import { EMPTY_RUNTIME } from '@/lib/pipeline-runtime';
import { readPendingApproval } from '@/lib/pipeline-approval';
import { buildSupervisorSnapshot, getSupervisorRecommendation } from '@/lib/pipeline-supervisor';
import { buildSupervisorConceptReply, looksLikeStatusQuestion } from '@/lib/supervisor-concept';
import {
  appendPipelineEvent,
  resumePipelineRun,
  setStopAfterReview,
  startPipelineRun,
  stopPipelineRun,
  type PermissionMode,
  type RunGoal,
  type SecurityMode,
} from '@/lib/pipeline-control';
import { parseSupervisorIntent } from '@/lib/supervisor-intents';
import { getProviderDefinition } from '@/lib/provider-catalog';
import { findLatestProject as findLatestProjectTracked } from '@/lib/projectLocator';

const BUILDUI_DIR = resolve(process.cwd(), 'pipeline');
const BUILDS_DIR = join(homedir(), 'Builds');
const STAGING_DIR = join(BUILDS_DIR, '.staging');
const MANUAL_DIR = join(BUILDS_DIR, '.manual');
const ROLE_A_PHASE0 = join(BUILDUI_DIR, 'role-a-phase0.md');
const ROLE_FILES: Record<string, string> = {
  A: join(BUILDUI_DIR, 'role-a.md'),
  B: join(BUILDUI_DIR, 'role-b.md'),
  C: join(BUILDUI_DIR, 'role-c.md'),
  D: join(BUILDUI_DIR, 'role-d.md'),
  E: join(BUILDUI_DIR, 'role-e.md'),
  S: join(BUILDUI_DIR, 'role-s.md'),
};

const MANUAL_PROMPTS: Record<string, string> = {
  A: 'You specialize in software planning and architecture.',
  B: 'You specialize in code review and finding gaps.',
  C: 'You specialize in writing code.',
  D: 'You specialize in testing and debugging.',
  E: 'You specialize in static security analysis.',
  S: 'You help oversee and diagnose issues.',
};

const runner = createRunner();

function roleLabel(agent: string): string {
  switch (agent) {
    case 'A':
      return 'planner';
    case 'B':
      return 'plan reviewer';
    case 'C':
      return 'coder';
    case 'D':
      return 'tester';
    case 'E':
      return 'security auditor';
    case 'S':
    default:
      return 'supervisor';
  }
}

function getManualState(): Record<string, unknown> {
  const eventsFile = join(MANUAL_DIR, 'manual-state.json');
  if (existsSync(eventsFile)) {
    try { return JSON.parse(readFileSync(eventsFile, 'utf8')); } catch {}
  }
  mkdirSync(MANUAL_DIR, { recursive: true });
  const fresh: Record<string, unknown> = {
    concept: '',
    projectDir: MANUAL_DIR,
    currentPhase: 'concept',
    securityMode: 'fast',
    activeAgent: '',
    agentStatus: { A: 'idle', B: 'idle', C: 'idle', D: 'idle', E: 'idle', S: 'idle' },
    sessions: {},
    buildComplete: false,
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCostUsd: 0 },
    runtime: { ...EMPTY_RUNTIME },
    events: [],
  };
  writeFileSync(eventsFile, JSON.stringify(fresh, null, 2));
  return fresh;
}

function getStagingState(): Record<string, unknown> {
  const eventsFile = join(STAGING_DIR, 'pipeline-events.json');
  if (existsSync(eventsFile)) {
    try { return JSON.parse(readFileSync(eventsFile, 'utf8')); } catch {}
  }
  mkdirSync(STAGING_DIR, { recursive: true });
  const fresh: Record<string, unknown> = {
    concept: '',
    projectDir: '',
    currentPhase: 'concept',
    securityMode: 'fast',
    activeAgent: '',
    agentStatus: { A: 'idle', B: 'idle', C: 'idle', D: 'idle', E: 'idle', S: 'idle' },
    sessions: {},
    buildComplete: false,
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCostUsd: 0 },
    runtime: { ...EMPTY_RUNTIME },
    events: [],
  };
  writeFileSync(eventsFile, JSON.stringify(fresh, null, 2));
  return fresh;
}

function expandHomePath(input: string): string {
  if (input === '~') return homedir();
  if (input.startsWith('~/')) return join(homedir(), input.slice(2));
  return input;
}

function resolveWorkingDirectory(input: unknown, fallbackDir: string): string {
  const raw = String(input || '').trim();
  const target = raw ? resolve(expandHomePath(raw)) : fallbackDir;
  mkdirSync(target, { recursive: true });
  return target;
}

function buildWorkspaceGuard(workspaceDir: string): string {
  return [
    `WORKSPACE BOUNDARY: ${workspaceDir}`,
    `Stay strictly within ${workspaceDir}.`,
    `Do not read, write, create, rename, delete, launch, or run commands outside ${workspaceDir}.`,
    'You may create folders and files inside this workspace only.',
  ].join('\n');
}

function findLatestProject(): string | null {
  return findLatestProjectTracked();
}

function writeState(file: string, state: Record<string, unknown>) {
  writeFileSync(file, JSON.stringify(state, null, 2));
}

function appendUserEvent(state: Record<string, unknown>, agent: string, message: string) {
  const events = (state.events as Array<Record<string, unknown>>) || [];
  events.push({
    time: new Date().toISOString(),
    agent,
    phase: state.currentPhase || 'concept',
    type: 'user_msg',
    text: `You: ${message}`,
  });
  state.events = events;
}

function appendSupervisorFailureAndGuidance(
  state: Record<string, unknown>,
  file: string,
  errorText: string
) {
  const events = (state.events as Array<Record<string, unknown>>) || [];
  events.push({
    time: new Date().toISOString(),
    agent: 'S',
    phase: state.currentPhase || 'concept',
    type: 'failure',
    text: errorText,
  });

  const recommendation = getSupervisorRecommendation(state, null);
  events.push({
    time: new Date().toISOString(),
    agent: 'S',
    phase: state.currentPhase || 'concept',
    type: 'text',
    text: `${recommendation.title}: ${recommendation.detail}${recommendation.chatCommand ? ` Try: "${recommendation.chatCommand}".` : ''}`,
  });
  state.events = events;
  writeState(file, state);
}

// ── Shared: stream claude output into a state file ──────────────────

function streamClaude(
  opts: RunnerOptions,
  eventsFile: string,
  agent: string,
  sessionId: string,
): Promise<NextResponse> {
  return new Promise<NextResponse>((resolveResponse) => {
    const child = runner.spawn(opts);
    const canFallbackToHost = child.backend === 'docker' && runner.supportsHostFallback(opts);

    if (child.backend === 'docker') {
      try {
        const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
        const phase = s.currentPhase || 'concept';
        s.events.push({
          time: new Date().toISOString(),
          agent: 'system',
          phase,
          type: 'status',
          text: `Running ${roleLabel(agent)} in isolated Docker worker.`,
        });
        writeFileSync(eventsFile, JSON.stringify(s, null, 2));
      } catch {}
    }

    const rl = createInterface({ input: child.stdout });
    let newSessionId = sessionId;
    let lastResultText = '';
    let stderr = '';
    let diagnosticTail = '';

    function noteDiagnostic(text: string) {
      if (!text) return;
      diagnosticTail = `${diagnosticTail}\n${text}`.slice(-12_000);
    }

    rl.on('line', (line) => {
      if (!line.trim()) return;
      noteDiagnostic(line);
      let event: Record<string, unknown>;
      try { event = JSON.parse(line); } catch { return; }

      const type = event.type as string;

      if (type === 'system') {
        const streamedSessionId = (event.session_id as string) || '';
        if (streamedSessionId) {
          newSessionId = streamedSessionId;
          try {
            const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
            if (!s.sessions) s.sessions = {};
            s.sessions[agent] = streamedSessionId;
            writeFileSync(eventsFile, JSON.stringify(s, null, 2));
          } catch {}
        }
      }

      if (type === 'assistant') {
        const msg = event.message as Record<string, unknown>;
        const content = msg?.content as Array<Record<string, unknown>>;
        if (!content) return;

        for (const block of content) {
          if (block.type === 'tool_use') {
            const toolName = block.name as string;
            const input = block.input as Record<string, unknown>;
            let desc = toolName;
            if (toolName === 'Read' && input.file_path) desc = `Reading: ${basename(input.file_path as string)}`;
            else if (toolName === 'Write' && input.file_path) desc = `Writing: ${basename(input.file_path as string)}`;
            else if (toolName === 'Edit' && input.file_path) desc = `Editing: ${basename(input.file_path as string)}`;
            else if (toolName === 'Bash' && input.command) desc = `Running: ${(input.command as string).slice(0, 80)}`;

            try {
              const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
              s.events.push({ time: new Date().toISOString(), agent, phase: s.currentPhase || 'concept', type: 'tool_call', text: desc });
              writeFileSync(eventsFile, JSON.stringify(s, null, 2));
            } catch {}
          } else if (block.type === 'text') {
            const text = ((block.text as string) || '').trim();
            if (text) {
              try {
                const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
                s.events.push({ time: new Date().toISOString(), agent, phase: s.currentPhase || 'concept', type: 'text', text });
                writeFileSync(eventsFile, JSON.stringify(s, null, 2));
              } catch {}
            }
          }
        }
      } else if (type === 'result') {
        newSessionId = (event.session_id as string) || sessionId;
        lastResultText = typeof event.result === 'string' ? event.result : '';
        try {
          const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
          if (!s.sessions) s.sessions = {};
          s.sessions[agent] = newSessionId;
          const usage = event.usage as Record<string, number>;
          if (usage && s.usage) {
            s.usage.inputTokens = (s.usage.inputTokens || 0) + (usage.input_tokens || 0);
            s.usage.outputTokens = (s.usage.outputTokens || 0) + (usage.output_tokens || 0);
            s.usage.cacheReadTokens = (s.usage.cacheReadTokens || 0) + (usage.cache_read_input_tokens || 0);
            s.usage.cacheWriteTokens = (s.usage.cacheWriteTokens || 0) + (usage.cache_creation_input_tokens || 0);
          }
          const cost = event.total_cost_usd as number;
          if (cost && s.usage) s.usage.totalCostUsd = (s.usage.totalCostUsd || 0) + cost;
          writeFileSync(eventsFile, JSON.stringify(s, null, 2));
        } catch {}
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      noteDiagnostic(text);
    });

    child.on('close', async () => {
      if (canFallbackToHost && isRecoverableDockerAuthFailure(`${diagnosticTail}\n${stderr}\n${lastResultText}`)) {
        try {
          const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
          const phase = s.currentPhase || 'concept';
          s.events.push({
            time: new Date().toISOString(),
            agent: 'system',
            phase,
            type: 'status',
            text: `Isolated ${roleLabel(agent)} auth is unavailable. Retrying on the host.`,
          });
          s.events.push({
            time: new Date().toISOString(),
            agent: 'S',
            phase,
            type: 'text',
            text: `I could not keep the ${roleLabel(agent)} isolated for this turn because Claude subscription auth is unavailable in Docker right now, so I am retrying it on the host instead of failing the run.`,
          });
          writeFileSync(eventsFile, JSON.stringify(s, null, 2));
        } catch {}

        resolveResponse(await streamClaude(
          { ...opts, forceHost: true },
          eventsFile,
          agent,
          sessionId,
        ));
        return;
      }

      // Set agent back to idle
      try {
        const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
        if (s.agentStatus) s.agentStatus[agent] = 'idle';
        writeFileSync(eventsFile, JSON.stringify(s, null, 2));
      } catch {}
      resolveResponse(NextResponse.json({ success: true, sessionId: newSessionId }));
    });
    child.on('error', () => {
      resolveResponse(NextResponse.json({ success: false }, { status: 500 }));
    });
  });
}

function streamOpenCode(
  opts: { prompt: string; projectDir: string; model: string; sessionId?: string; agent: string },
  eventsFile: string,
  agent: string,
  sessionId: string,
): Promise<NextResponse> {
  return new Promise<NextResponse>((resolveResponse) => {
    const args = [
      'run',
      opts.prompt,
      '--format', 'json',
      '--pure',
      '--model', opts.model,
      '--dir', opts.projectDir,
    ];
    if (opts.sessionId) {
      args.push('--session', opts.sessionId);
    }

    const child = nodeSpawn('opencode', args, {
      cwd: opts.projectDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TERM: 'dumb',
      },
    });

    const rl = createInterface({ input: child.stdout });
    let newSessionId = sessionId;
    let stderr = '';
    let diagnosticTail = '';

    function noteDiagnostic(text: string) {
      if (!text) return;
      diagnosticTail = `${diagnosticTail}\n${text}`.slice(-12_000);
    }

    rl.on('line', (line) => {
      if (!line.trim()) return;
      noteDiagnostic(line);

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }

      const part = (event.part as Record<string, unknown> | undefined) || {};
      const streamedSessionId =
        (event.sessionID as string) ||
        (event.sessionId as string) ||
        (event.session_id as string) ||
        (part.sessionID as string) ||
        (part.sessionId as string) ||
        (part.session_id as string) ||
        '';
      if (streamedSessionId) {
        newSessionId = streamedSessionId;
        try {
          const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
          if (!s.sessions) s.sessions = {};
          s.sessions[agent] = streamedSessionId;
          writeFileSync(eventsFile, JSON.stringify(s, null, 2));
        } catch {}
      }

      const type = String(event.type || part.type || '');
      const lowerType = type.toLowerCase();

      if (lowerType === 'text') {
        const text = String(event.text || part.text || '').trim();
        if (text) {
          try {
            const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
            s.events.push({ time: new Date().toISOString(), agent, phase: s.currentPhase || 'concept', type: 'text', text });
            writeFileSync(eventsFile, JSON.stringify(s, null, 2));
          } catch {}
        }
      } else if (lowerType.includes('tool')) {
        const toolName = String((part.name as string) || (event.tool as string) || type || 'tool').trim();
        const text = toolName ? `Tool event: ${toolName}` : 'Tool event';
        try {
          const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
          s.events.push({ time: new Date().toISOString(), agent, phase: s.currentPhase || 'concept', type: 'tool_call', text });
          writeFileSync(eventsFile, JSON.stringify(s, null, 2));
        } catch {}
      } else if (lowerType === 'step_start') {
        try {
          const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
          s.events.push({ time: new Date().toISOString(), agent, phase: s.currentPhase || 'concept', type: 'status', text: 'OpenCode started a step.' });
          writeFileSync(eventsFile, JSON.stringify(s, null, 2));
        } catch {}
      } else if (lowerType === 'step_finish') {
        const tokens = (part.tokens as {
          input?: number;
          output?: number;
          cacheRead?: number;
          cacheWrite?: number;
          cache?: { read?: number; write?: number };
        } | undefined) || {};
        const cost = Number((part.cost as number) || 0);
        try {
          const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
          if (!s.sessions) s.sessions = {};
          s.sessions[agent] = newSessionId;
          if (s.usage) {
            s.usage.inputTokens = (s.usage.inputTokens || 0) + Number(tokens.input || 0);
            s.usage.outputTokens = (s.usage.outputTokens || 0) + Number(tokens.output || 0);
            s.usage.cacheReadTokens = (s.usage.cacheReadTokens || 0) + Number(tokens.cacheRead || tokens.cache?.read || 0);
            s.usage.cacheWriteTokens = (s.usage.cacheWriteTokens || 0) + Number(tokens.cacheWrite || tokens.cache?.write || 0);
            s.usage.totalCostUsd = (s.usage.totalCostUsd || 0) + cost;
          }
          writeFileSync(eventsFile, JSON.stringify(s, null, 2));
        } catch {}
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      noteDiagnostic(text);
    });

    child.on('close', async () => {
      try {
        const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
        if (s.agentStatus) s.agentStatus[agent] = 'idle';
        writeFileSync(eventsFile, JSON.stringify(s, null, 2));
      } catch {}

      if (stderr.trim()) {
        noteDiagnostic(stderr);
      }

      // OpenCode is not our current docker-based engine, so there is no host fallback path.
      void diagnosticTail;
      resolveResponse(NextResponse.json({ success: true, sessionId: newSessionId }));
    });

    child.on('error', () => {
      resolveResponse(NextResponse.json({ success: false }, { status: 500 }));
    });
  });
}

// ── Manual mode ─────────────────────────────────────────────────────

function handleManual(agent: string, message: string, model: string, provider: string, workingDir?: string) {
  const eventsFile = join(MANUAL_DIR, 'manual-state.json');
  const state = getManualState();
  const sessions = (state.sessions as Record<string, string>) || {};
  const sessionId = sessions[agent] || '';
  const manualProjectDir = resolveWorkingDirectory(workingDir, MANUAL_DIR);

  // Set agent active
  const agentStatus = (state.agentStatus as Record<string, string>) || {};
  agentStatus[agent] = 'active';
  state.agentStatus = agentStatus;

  // Append event — detect handoffs vs regular user messages
  const events = (state.events as Array<Record<string, unknown>>) || [];
  const handoffMatch = message.match(/^\[HANDOFF:(\w)→(\w)\]\s/);
  if (handoffMatch) {
    const fromAgent = handoffMatch[1];
    const handoffText = message.replace(/^\[HANDOFF:\w→\w\]\s/, '').replace(/\n\nReview this and continue the work\.$/, '');
    events.push({ time: new Date().toISOString(), agent: fromAgent, phase: 'concept', type: 'handoff', text: `→ ${agent}: ${handoffText}` });
  } else {
    events.push({ time: new Date().toISOString(), agent, phase: 'concept', type: 'user_msg', text: `You: ${message}` });
  }
  state.events = events;
  writeFileSync(eventsFile, JSON.stringify(state, null, 2));

  const safeMessage = message.startsWith('-') ? 'User says: ' + message : message;
  const guardedMessage = [buildWorkspaceGuard(manualProjectDir), '', safeMessage].join('\n\n');
  const resolvedProvider = getProviderDefinition(provider).id;

  if (resolvedProvider === 'opencode') {
    const prompt = sessionId
      ? guardedMessage
      : `${MANUAL_PROMPTS[agent] || MANUAL_PROMPTS.A}\n\n${guardedMessage}`;

    return streamOpenCode(
      {
        prompt,
        projectDir: manualProjectDir,
        model,
        sessionId: sessionId || undefined,
        agent,
      },
      eventsFile,
      agent,
      sessionId
    );
  }

  return streamClaude(
    {
      prompt: guardedMessage,
      projectDir: manualProjectDir,
      model,
      provider,
      resume: sessionId || undefined,
      systemPrompt: sessionId ? undefined : (MANUAL_PROMPTS[agent] || MANUAL_PROMPTS.A),
    },
    eventsFile,
    agent,
    sessionId
  );
}

// ── Pipeline mode ───────────────────────────────────────────────────

function handlePipeline(
  agent: string,
  message: string,
  model?: string,
  provider?: string,
  agentModels?: Record<string, string>,
  workingDir?: string,
  defaults?: { securityMode?: SecurityMode; permissionMode?: PermissionMode; runGoal?: RunGoal; runFinalAudit?: boolean }
) {
  let projectDir: string;
  let eventsFile: string;

  const stagingEvents = join(STAGING_DIR, 'pipeline-events.json');
  const activeProject = findLatestProject();

  if (existsSync(stagingEvents)) {
    projectDir = STAGING_DIR;
    eventsFile = stagingEvents;
  } else if (activeProject) {
    const projState = JSON.parse(readFileSync(join(activeProject, 'pipeline-events.json'), 'utf8'));
    const phase = projState.currentPhase as string;
    const isActive = phase && phase !== 'concept' && !projState.buildComplete;
    const isDone = !!projState.buildComplete;
    if (isActive || isDone) {
      projectDir = activeProject;
      eventsFile = join(activeProject, 'pipeline-events.json');
    } else {
      projectDir = STAGING_DIR;
      eventsFile = stagingEvents;
      getStagingState();
    }
  } else {
    projectDir = STAGING_DIR;
    eventsFile = stagingEvents;
    getStagingState();
  }

  let state: Record<string, unknown> = {};
  try { state = JSON.parse(readFileSync(eventsFile, 'utf8')); } catch {}
  if (typeof model === 'string' && model.trim()) state.selectedModel = model.trim();
  if (typeof provider === 'string' && provider.trim()) state.selectedProvider = provider.trim();
  if (typeof workingDir === 'string' && workingDir.trim()) {
    state.requestedWorkingDir = resolveWorkingDirectory(workingDir, BUILDS_DIR);
  }
  if (agentModels && typeof agentModels === 'object') {
    state.agentModels = Object.fromEntries(
      Object.entries(agentModels)
        .map(([agentId, value]) => [agentId, String(value || '').trim()])
        .filter(([, value]) => Boolean(value))
    );
  }
  const securityMode = state.securityMode === 'strict' ? 'strict' : 'fast';
  const selectedModel = typeof state.selectedModel === 'string' && state.selectedModel.trim()
    ? state.selectedModel.trim()
    : 'claude-sonnet-4-6';
  const selectedProvider = typeof state.selectedProvider === 'string' && state.selectedProvider.trim()
    ? state.selectedProvider.trim()
    : 'claude';
  const activeWorkspace = projectDir === STAGING_DIR
    ? (typeof state.requestedWorkingDir === 'string' && state.requestedWorkingDir.trim() ? state.requestedWorkingDir.trim() : projectDir)
    : projectDir;
  const sessions = (state.sessions as Record<string, string>) || {};
  const sessionId = sessions[agent] || '';

  if (agent === 'S') {
    const intent = parseSupervisorIntent(message);
    if (intent) {
      let controlProjectDir = projectDir;
      let controlEventsFile = eventsFile;
      let controlState = state;

      if (intent.action === 'start-run') {
        controlProjectDir = STAGING_DIR;
        controlEventsFile = join(STAGING_DIR, 'pipeline-events.json');
        controlState = getStagingState();

        if (!controlState.concept && typeof intent.concept === 'string' && intent.concept.trim()) {
          controlState.concept = intent.concept.trim();
        }
      }

      appendUserEvent(controlState, agent, message);
      writeState(controlEventsFile, controlState);

      if (intent.action === 'start-run') {
        const effectiveSecurityMode = defaults?.securityMode || (controlState.securityMode === 'strict' ? 'strict' : 'fast');
        const effectiveRunGoal = defaults?.runGoal || 'full-build';
        const effectivePermissionMode = defaults?.permissionMode || 'auto';
        const effectiveRunFinalAudit = defaults?.runFinalAudit === true || controlState.runFinalAudit === true;
        const result = startPipelineRun({
          securityMode: effectiveSecurityMode,
          permissionMode: effectivePermissionMode as 'auto' | 'plan' | 'dangerously-skip-permissions',
          runGoal: effectiveRunGoal,
          runFinalAudit: effectiveRunFinalAudit,
          model: selectedModel,
          provider: selectedProvider,
          agentModels: state.agentModels as Record<string, string> | undefined,
          workingDir: typeof state.requestedWorkingDir === 'string' ? state.requestedWorkingDir : undefined,
        });

        if (!result.success) {
          appendSupervisorFailureAndGuidance(
            controlState,
            controlEventsFile,
            result.error || 'Supervisor could not start the run'
          );
          return NextResponse.json({ success: false, error: result.error || 'Could not start pipeline' });
        }

        appendPipelineEvent(result.projectDir!, {
          agent: 'S',
          phase: 'concept',
          type: 'status',
          text:
            result.runGoal === 'plan-only'
              ? `Supervisor started plan-only mode in ${result.securityMode} mode. A will plan, B will review, then the run will pause.`
              : `Supervisor started the full build in ${result.securityMode} mode.`,
        });

        return NextResponse.json({
          success: true,
          controlAction: 'start-run',
          projectDir: result.projectDir,
          runGoal: result.runGoal,
          securityMode: result.securityMode,
        });
      }

      if (intent.action === 'set-stop-after-review') {
        const result = setStopAfterReview(intent.enabled, controlProjectDir === STAGING_DIR ? undefined : controlProjectDir);
        if (!result.success) {
          appendSupervisorFailureAndGuidance(
            controlState,
            controlEventsFile,
            result.error || 'Supervisor could not update stop-after-review'
          );
          return NextResponse.json({ success: false, error: result.error || 'Could not update supervisor control' });
        }

        return NextResponse.json({
          success: true,
          controlAction: 'set-stop-after-review',
          stopAfterPhase: result.stopAfterPhase,
          projectDir: result.projectDir,
        });
      }

      if (intent.action === 'resume-run') {
        const result = resumePipelineRun(controlProjectDir === STAGING_DIR ? undefined : controlProjectDir);
        if (!result.success) {
          appendSupervisorFailureAndGuidance(
            controlState,
            controlEventsFile,
            result.error || 'Supervisor could not resume the run'
          );
          return NextResponse.json({ success: false, error: result.error || 'Could not resume pipeline' });
        }

        return NextResponse.json({
          success: true,
          controlAction: result.action || 'resume-run',
          projectDir: result.projectDir,
        });
      }

      if (intent.action === 'stop-run') {
        const result = stopPipelineRun(controlProjectDir === STAGING_DIR ? undefined : controlProjectDir);
        appendPipelineEvent(result.projectDir || controlProjectDir, {
          agent: 'S',
          phase: String(controlState.currentPhase || 'concept'),
          type: 'status',
          text: 'Supervisor stopped the run',
        });
        return NextResponse.json({ success: true, controlAction: 'stop-run', projectDir: result.projectDir });
      }
    }

    const isConceptPhase =
      projectDir === STAGING_DIR &&
      (!state.currentPhase || state.currentPhase === 'concept') &&
      !state.buildComplete;

    if (isConceptPhase) {
      // First message — no concept yet. Capture it with a canned reply.
      if (!state.concept) {
        state.concept = message.trim();
        appendUserEvent(state, agent, message);
        const reply = buildSupervisorConceptReply(String(state.concept), true);
        const events = (state.events as Array<Record<string, unknown>>) || [];
        events.push({
          time: new Date().toISOString(),
          agent: 'S',
          phase: state.currentPhase || 'concept',
          type: 'text',
          text: reply,
        });
        state.events = events;
        writeState(eventsFile, state);

        return NextResponse.json({
          success: true,
          conceptCaptured: true,
          concept: state.concept,
        });
      }

      // Concept exists — stream everything to Claude so S can think.
      appendUserEvent(state, agent, message);
      writeState(eventsFile, state);

      const conceptContext = [
        buildWorkspaceGuard(activeWorkspace),
        '',
        `[CONCEPT PHASE — no pipeline running yet]`,
        `Current concept: ${state.concept}`,
        '',
        'The user is exploring this idea with you before starting the team.',
        'Engage naturally — give your honest opinion, ask clarifying questions, suggest improvements.',
        'If the user refines or changes the concept, acknowledge it conversationally.',
        'When they seem ready, remind them they can say `start planning`, `start plan only`, or `start full build`.',
        '',
        message,
      ].join('\n');

      if (selectedProvider === 'opencode') {
        return streamOpenCode(
          {
            prompt: conceptContext,
            projectDir,
            model: selectedModel,
            sessionId: sessionId || undefined,
            agent,
          },
          eventsFile,
          agent,
          sessionId
        );
      }

      return streamClaude(
        {
          prompt: conceptContext,
          projectDir,
          pipelineDir: BUILDUI_DIR,
          model: selectedModel,
          provider: selectedProvider,
          roleFile: ROLE_FILES.S,
          resume: sessionId || undefined,
          pipelineAgent: 'S',
          securityMode,
        },
        eventsFile,
        agent,
        sessionId
      );
    }
  }

  if (!state.concept && message) {
    state.concept = message;
    writeState(eventsFile, state);
  }

  const currentPhase = state.currentPhase as string;
  const isPhase0 = !currentPhase || currentPhase === 'concept';
  const roleFile = (agent === 'A' && isPhase0) ? ROLE_A_PHASE0 : (ROLE_FILES[agent] || ROLE_FILES.A);

  const safeMessage = message.startsWith('-') ? 'User says: ' + message : message;
  const buildComplete = !!state.buildComplete;
  let finalMessage = safeMessage;
  if (agent === 'S') {
    const pendingApproval = projectDir !== STAGING_DIR ? readPendingApproval(projectDir) : null;
    finalMessage = [
      buildWorkspaceGuard(activeWorkspace),
      '',
      buildSupervisorSnapshot(state, pendingApproval),
      '',
      'Use the live snapshot above as the source of truth for the team state.',
      'Answer as the supervisor/operator for the dev team.',
      'Lead with one concrete recommendation when the user asks what to do next.',
      '',
      safeMessage,
    ].join('\n');
  }
  if (buildComplete) {
    finalMessage = '[The build pipeline has completed. The user is chatting with you directly for post-build work — reviewing, fixing, or modifying the project.]\n\n' + finalMessage;
  } else if (agent !== 'S') {
    finalMessage = [buildWorkspaceGuard(activeWorkspace), '', finalMessage].join('\n\n');
  }

  appendUserEvent(state, agent, message);
  writeState(eventsFile, state);

  if (selectedProvider === 'opencode') {
    return streamOpenCode(
      {
        prompt: finalMessage,
        projectDir,
        model: selectedModel,
        sessionId: sessionId || undefined,
        agent,
      },
      eventsFile,
      agent,
      sessionId
    );
  }

  return streamClaude(
    {
      prompt: finalMessage,
      projectDir,
      pipelineDir: BUILDUI_DIR,
      model: selectedModel,
      provider: selectedProvider,
      roleFile,
      resume: sessionId || undefined,
      pipelineAgent: agent as PipelineAgentId,
      securityMode,
    },
    eventsFile,
    agent,
    sessionId
  );
}

// ── Route handler ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { agent, message, mode, model, provider, agentModels, workingDir, securityMode, permissionMode, runGoal, runFinalAudit } = await req.json();

  const normalizedAgentModels = agentModels && typeof agentModels === 'object'
    ? Object.fromEntries(
        Object.entries(agentModels)
          .map(([agentId, value]) => [agentId, String(value || '').trim()])
          .filter(([, value]) => Boolean(value))
      )
    : undefined;

  const effectiveModel = normalizedAgentModels?.[agent] || model || 'claude-sonnet-4-6';

  if (mode === 'manual') {
    return handleManual(agent, message, effectiveModel, provider || 'claude', workingDir);
  }
  return handlePipeline(agent, message, model, provider, normalizedAgentModels, workingDir, {
    securityMode: securityMode === 'strict' ? 'strict' : 'fast',
    permissionMode: permissionMode === 'plan' ? 'plan' : permissionMode === 'dangerously-skip-permissions' ? 'dangerously-skip-permissions' : 'auto',
    runGoal: runGoal === 'plan-only' ? 'plan-only' : 'full-build',
    runFinalAudit: runFinalAudit === true,
  });
}
