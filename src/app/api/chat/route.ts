import { readFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { spawn as nodeSpawn } from 'node:child_process';
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
import { getProviderDefaultModel } from '@/lib/provider-catalog';
import { mutateJsonStateLocked } from '@/lib/locked-json-state';
import { authorizeLocalOrTokenRequest } from '@/lib/skill-runtime';

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

const MAX_EVENT_HISTORY = 3000;

const MANUAL_PROMPTS: Record<string, string> = {
  A: 'You specialize in software planning and architecture.',
  B: 'You specialize in code review and finding gaps.',
  C: 'You specialize in writing code.',
  D: 'You specialize in testing and debugging.',
  E: 'You specialize in static security analysis.',
  S: 'You help oversee and diagnose issues.',
};

type AgentModelOverrides = Partial<Record<string, string>>;

function resolveModelForAgent(agent: string, fallbackModel: string, agentModels?: AgentModelOverrides): string {
  const override = String(agentModels?.[agent] || '').trim();
  return override || fallbackModel;
}

function resolveModelFallbackForProvider(provider: string, requestedModel: string): string {
  const requested = String(requestedModel || '').trim();
  if (requested) return requested;

  const providerDefault = String(getProviderDefaultModel(provider) || '').trim();
  if (providerDefault) return providerDefault;

  return provider === 'claude' ? 'claude-sonnet-4-6' : 'google/gemma-4-e2b';
}

function normalizeAgentModels(agentModels?: AgentModelOverrides): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (!agentModels || typeof agentModels !== 'object') return normalized;
  for (const [agent, value] of Object.entries(agentModels)) {
    const trimmed = String(value || '').trim();
    if (trimmed) normalized[agent] = trimmed;
  }
  return normalized;
}

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
  writeMergedState(eventsFile, fresh);
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
  writeMergedState(eventsFile, fresh);
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
  try {
    const dirs = readdirSync(BUILDS_DIR)
      .filter((name: string) => name !== '.staging' && name !== '.manual')
      .map((name: string) => join(BUILDS_DIR, name))
      .filter((p: string) => {
        try { return statSync(p).isDirectory() && statSync(join(p, 'pipeline-events.json')).isFile(); }
        catch { return false; }
      })
      .sort((a: string, b: string) => statSync(join(b, 'pipeline-events.json')).mtimeMs - statSync(join(a, 'pipeline-events.json')).mtimeMs);
    return dirs[0] || null;
  } catch { return null; }
}

function normalizeEvents(events: unknown): Array<Record<string, unknown>> {
  return Array.isArray(events)
    ? events.filter((event): event is Record<string, unknown> => !!event && typeof event === 'object')
    : [];
}

function mergeEvents(
  currentEvents: Array<Record<string, unknown>>,
  incomingEvents: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  const merged: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const event of [...currentEvents, ...incomingEvents]) {
    const key = [
      String(event.time || ''),
      String(event.agent || ''),
      String(event.phase || ''),
      String(event.type || ''),
      String(event.text || ''),
      String(event.detail || ''),
    ].join('::');
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(event);
  }
  merged.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  return merged.length > MAX_EVENT_HISTORY ? merged.slice(-MAX_EVENT_HISTORY) : merged;
}

function latestEventTime(events: Array<Record<string, unknown>>): number {
  let latest = 0;
  for (const event of events) {
    const raw = String(event.time || '');
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed) && parsed > latest) latest = parsed;
  }
  return latest;
}

function writeMergedState(file: string, state: Record<string, unknown>) {
  mutateJsonStateLocked(
    file,
    (current) => {
      const currentRecord = current as Record<string, unknown>;
      const next: Record<string, unknown> = { ...currentRecord };
      const currentEvents = normalizeEvents(currentRecord.events);
      const incomingEvents = normalizeEvents(state.events);
      const currentLatest = latestEventTime(currentEvents);
      const incomingLatest = latestEventTime(incomingEvents);
      const incomingIsNewerOrEqual = incomingLatest >= currentLatest;

      if (typeof state.concept === 'string' && (incomingIsNewerOrEqual || !String(currentRecord.concept || '').trim())) {
        next.concept = state.concept;
      }
      if (typeof state.selectedModel === 'string' && (incomingIsNewerOrEqual || !String(currentRecord.selectedModel || '').trim())) {
        next.selectedModel = state.selectedModel;
      }
      if (typeof state.selectedProvider === 'string' && (incomingIsNewerOrEqual || !String(currentRecord.selectedProvider || '').trim())) {
        next.selectedProvider = state.selectedProvider;
      }
      if (typeof state.requestedWorkingDir === 'string' && (incomingIsNewerOrEqual || !String(currentRecord.requestedWorkingDir || '').trim())) {
        next.requestedWorkingDir = state.requestedWorkingDir;
      }

      if (state.agentModels && typeof state.agentModels === 'object') {
        next.agentModels = {
          ...(currentRecord.agentModels as Record<string, unknown> | undefined),
          ...(state.agentModels as Record<string, unknown>),
        };
      }

      if (state.sessions && typeof state.sessions === 'object') {
        const currentSessions = currentRecord.sessions && typeof currentRecord.sessions === 'object'
          ? currentRecord.sessions as Record<string, unknown>
          : {};
        const incomingSessions = state.sessions as Record<string, unknown>;
        const mergedSessions: Record<string, unknown> = { ...currentSessions };
        for (const [agentId, incoming] of Object.entries(incomingSessions)) {
          const incomingSession = String(incoming || '').trim();
          if (!incomingSession) continue;
          const currentSession = String(mergedSessions[agentId] || '').trim();
          if (!currentSession || incomingIsNewerOrEqual) {
            mergedSessions[agentId] = incomingSession;
          }
        }
        next.sessions = mergedSessions;
      }

      if (state.agentStatus && typeof state.agentStatus === 'object') {
        const currentStatuses = currentRecord.agentStatus && typeof currentRecord.agentStatus === 'object'
          ? currentRecord.agentStatus as Record<string, unknown>
          : {};
        const incomingStatuses = state.agentStatus as Record<string, unknown>;
        const mergedStatuses: Record<string, unknown> = { ...currentStatuses };
        for (const [agentId, incoming] of Object.entries(incomingStatuses)) {
          const incomingStatus = String(incoming || '');
          const currentStatus = String(mergedStatuses[agentId] || '');
          if (!currentStatus || incomingStatus === 'active' || incomingStatus === 'working' || incomingIsNewerOrEqual) {
            mergedStatuses[agentId] = incomingStatus;
          }
        }
        next.agentStatus = mergedStatuses;
      }

      if (state.usage && typeof state.usage === 'object') {
        const currentUsage = currentRecord.usage && typeof currentRecord.usage === 'object'
          ? currentRecord.usage as Record<string, unknown>
          : {};
        const incomingUsage = state.usage as Record<string, unknown>;
        const keys = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'totalCostUsd'];
        const mergedUsage: Record<string, number> = {};
        for (const key of keys) {
          mergedUsage[key] = Math.max(Number(currentUsage[key] || 0), Number(incomingUsage[key] || 0));
        }
        next.usage = mergedUsage;
      }

      next.events = mergeEvents(currentEvents, incomingEvents);

      Object.assign(currentRecord, next);
    },
    { createIfMissing: () => ({ ...state }) }
  );
}

function writeState(file: string, state: Record<string, unknown>) {
  writeMergedState(file, state);
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
    let child: ReturnType<typeof runner.spawn>;
    try {
      child = runner.spawn(opts);
    } catch (error) {
      resolveResponse(NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 }));
      return;
    }
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
        writeMergedState(eventsFile, s as Record<string, unknown>);
      } catch {}
    }

    const rl = createInterface({ input: child.stdout as NodeJS.ReadableStream });
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
            writeMergedState(eventsFile, s as Record<string, unknown>);
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
              writeMergedState(eventsFile, s as Record<string, unknown>);
            } catch {}
          } else if (block.type === 'text') {
            const text = ((block.text as string) || '').trim();
            if (text) {
              try {
                const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
                s.events.push({ time: new Date().toISOString(), agent, phase: s.currentPhase || 'concept', type: 'text', text });
                writeMergedState(eventsFile, s as Record<string, unknown>);
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
          writeMergedState(eventsFile, s as Record<string, unknown>);
        } catch {}
      }
    });

    if (child.stderr) {
      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderr += text;
        noteDiagnostic(text);
      });
    }

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
          writeMergedState(eventsFile, s as Record<string, unknown>);
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
        writeMergedState(eventsFile, s as Record<string, unknown>);
      } catch {}
      resolveResponse(NextResponse.json({ success: true, sessionId: newSessionId }));
    });
    child.on('error', (error: unknown) => {
      resolveResponse(NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 }));
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

    let child: ReturnType<typeof nodeSpawn>;
    try {
      child = nodeSpawn('opencode', args, {
        cwd: opts.projectDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          TERM: 'dumb',
        },
      });
    } catch (error) {
      resolveResponse(NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 }));
      return;
    }

    const rl = createInterface({ input: child.stdout as unknown as NodeJS.ReadableStream });
    let newSessionId = sessionId;
    let stderr = '';
    let diagnosticTail = '';
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;

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
          writeMergedState(eventsFile, s as Record<string, unknown>);
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
            writeMergedState(eventsFile, s as Record<string, unknown>);
          } catch {}
        }
      } else if (lowerType.includes('tool')) {
        const toolName = String((part.name as string) || (event.tool as string) || type || 'tool').trim();
        const text = toolName ? `Tool event: ${toolName}` : 'Tool event';
        try {
          const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
          s.events.push({ time: new Date().toISOString(), agent, phase: s.currentPhase || 'concept', type: 'tool_call', text });
          writeMergedState(eventsFile, s as Record<string, unknown>);
        } catch {}
      } else if (lowerType === 'step_start') {
        try {
          const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
          s.events.push({ time: new Date().toISOString(), agent, phase: s.currentPhase || 'concept', type: 'status', text: 'OpenCode started a step.' });
          writeMergedState(eventsFile, s as Record<string, unknown>);
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
          writeMergedState(eventsFile, s as Record<string, unknown>);
        } catch {}
      }
    });

    if (child.stderr) {
      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderr += text;
        noteDiagnostic(text);
      });
    }

    child.on('close', async (code, signal) => {
      exitCode = typeof code === 'number' ? code : null;
      exitSignal = signal ?? null;
      try {
        const s = JSON.parse(readFileSync(eventsFile, 'utf8'));
        if (s.agentStatus) s.agentStatus[agent] = 'idle';
        if (exitCode !== 0 || exitSignal) {
          s.events.push({
            time: new Date().toISOString(),
            agent,
            phase: s.currentPhase || 'concept',
            type: 'failure',
            text: `OpenCode exited with code ${exitCode ?? 'unknown'}${exitSignal ? ` (${exitSignal})` : ''}`,
          });
        }
        writeMergedState(eventsFile, s as Record<string, unknown>);
      } catch {}

      if (stderr.trim()) {
        noteDiagnostic(stderr);
      }

      void diagnosticTail;
      if (exitCode !== 0 || exitSignal) {
        resolveResponse(NextResponse.json({
          success: false,
          error: `OpenCode exited with code ${exitCode ?? 'unknown'}${exitSignal ? ` (${exitSignal})` : ''}${stderr.trim() ? `: ${stderr.trim().slice(-1000)}` : ''}`,
        }, { status: 500 }));
        return;
      }
      resolveResponse(NextResponse.json({ success: true, sessionId: newSessionId }));
    });

    child.on('error', (error) => {
      resolveResponse(NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 }));
    });
  });
}

// ── Manual mode ─────────────────────────────────────────────────────

function handleManual(
  agent: string,
  message: string,
  model: string,
  provider: string,
  workingDir?: string,
  agentModels?: AgentModelOverrides,
) {
  const eventsFile = join(MANUAL_DIR, 'manual-state.json');
  const state = getManualState();
  const sessions = (state.sessions as Record<string, string>) || {};
  const sessionId = sessions[agent] || '';
  const manualProjectDir = resolveWorkingDirectory(workingDir, MANUAL_DIR);
  const manualSystemPrompt = MANUAL_PROMPTS[agent] || MANUAL_PROMPTS.A;
  const selectedModel = resolveModelForAgent(
    agent,
    resolveModelFallbackForProvider(provider, model),
    agentModels,
  );

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
  writeMergedState(eventsFile, state);

  const safeMessage = message.startsWith('-') ? 'User says: ' + message : message;
  const guardedMessage = [buildWorkspaceGuard(manualProjectDir), '', safeMessage].join('\n\n');

  if (provider === 'opencode') {
    return streamOpenCode(
      {
        prompt: sessionId ? guardedMessage : `${manualSystemPrompt}\n\n${guardedMessage}`,
        projectDir: manualProjectDir,
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
      prompt: guardedMessage,
      projectDir: manualProjectDir,
      model: selectedModel,
      provider,
      resume: sessionId || undefined,
      systemPrompt: manualSystemPrompt,
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
  model: string,
  provider: string,
  workingDir?: string,
  agentModels?: AgentModelOverrides,
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
  const securityMode = state.securityMode === 'strict' ? 'strict' : 'fast';
  const pipelineStatus = String(state.pipelineStatus || '').trim();
  const sessions = (state.sessions as Record<string, string>) || {};
  const sessionId = sessions[agent] || '';
  const pipelineProvider = provider || 'claude';
  const stateProvider = String(state.selectedProvider || '').trim();
  const canReuseStateAgentModels = stateProvider === pipelineProvider;
  const stateAgentModels = canReuseStateAgentModels
    ? normalizeAgentModels((state.agentModels as AgentModelOverrides | undefined) || undefined)
    : {};
  const requestedAgentModels = normalizeAgentModels(agentModels);
  const mergedAgentModels: AgentModelOverrides = { ...stateAgentModels, ...requestedAgentModels };
  const pipelineModel = resolveModelForAgent(
    agent,
    resolveModelFallbackForProvider(pipelineProvider, model),
    mergedAgentModels,
  );
  const workspaceDir = resolveWorkingDirectory(workingDir, projectDir);
  const supervisorIntent = agent === 'S' ? parseSupervisorIntent(message) : null;
  const activeAgent = String(state.activeAgent || '').trim();

  if (pipelineStatus === 'running' && activeAgent) {
    const allowedSupervisorActions = new Set([
      'set-stop-after-review',
      'resume-run',
      'stop-run',
    ]);
    const isAllowedSupervisorAction =
      agent === 'S' &&
      (looksLikeStatusQuestion(message) || (
        !!supervisorIntent &&
        allowedSupervisorActions.has(supervisorIntent.action)
      ));

    if (!isAllowedSupervisorAction) {
      return NextResponse.json(
        {
          success: false,
          error: `Pipeline is currently active with agent ${activeAgent}. Wait for this turn to finish or queue the message from the UI.`,
          activeAgent,
        },
        { status: 409 }
      );
    }
  }

  if (agent === 'S') {
    if (!supervisorIntent && projectDir !== STAGING_DIR && pipelineStatus !== 'running') {
      const stagedConcept = message.trim();
      if (stagedConcept) {
        const stagingState = getStagingState();
        stagingState.concept = stagedConcept;
        stagingState.selectedProvider = pipelineProvider;
        stagingState.selectedModel = pipelineModel;
        stagingState.requestedWorkingDir = workspaceDir;
        if (Object.keys(requestedAgentModels).length > 0) {
          stagingState.agentModels = requestedAgentModels;
        }

        appendUserEvent(stagingState, agent, message);
        const reply = buildSupervisorConceptReply(stagedConcept, true);
        const events = (stagingState.events as Array<Record<string, unknown>>) || [];
        events.push({
          time: new Date().toISOString(),
          agent: 'S',
          phase: 'concept',
          type: 'text',
          text: reply,
        });
        stagingState.events = events;
        writeState(stagingEvents, stagingState);

        return NextResponse.json({
          success: true,
          conceptCaptured: true,
          concept: stagedConcept,
        });
      }
    }

    if (supervisorIntent) {
      let controlProjectDir = projectDir;
      let controlEventsFile = eventsFile;
      let controlState = state;

      if (supervisorIntent.action === 'start-run') {
        controlProjectDir = STAGING_DIR;
        controlEventsFile = join(STAGING_DIR, 'pipeline-events.json');
        controlState = getStagingState();

        if (!controlState.concept && typeof supervisorIntent.concept === 'string' && supervisorIntent.concept.trim()) {
          controlState.concept = supervisorIntent.concept.trim();
        }

        if (!controlState.concept && projectDir !== STAGING_DIR && typeof state.concept === 'string' && state.concept.trim()) {
          controlState.concept = state.concept.trim();
        }
      }

      appendUserEvent(controlState, agent, message);
      writeState(controlEventsFile, controlState);

      if (supervisorIntent.action === 'start-run') {
        const effectiveSecurityMode = defaults?.securityMode || (controlState.securityMode === 'strict' ? 'strict' : 'fast');
        const effectiveRunGoal = defaults?.runGoal || 'full-build';
        const effectivePermissionMode = defaults?.permissionMode || 'auto';
        const effectiveRunFinalAudit = defaults?.runFinalAudit === true || controlState.runFinalAudit === true;
        const controlStateProvider = String(controlState.selectedProvider || '').trim();
        const canReuseControlAgentModels = controlStateProvider === pipelineProvider;
        const controlAgentModels = {
          ...(canReuseControlAgentModels
            ? normalizeAgentModels((controlState.agentModels as AgentModelOverrides | undefined) || undefined)
            : {}),
          ...requestedAgentModels,
        };
        const result = startPipelineRun({
          securityMode: effectiveSecurityMode,
          permissionMode: effectivePermissionMode as 'auto' | 'plan' | 'dangerously-skip-permissions',
          runGoal: effectiveRunGoal,
          runFinalAudit: effectiveRunFinalAudit,
          model: pipelineModel,
          provider: pipelineProvider,
          workingDir: workspaceDir,
          agentModels: Object.keys(controlAgentModels).length > 0 ? controlAgentModels : undefined,
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

      if (supervisorIntent.action === 'set-stop-after-review') {
        const result = setStopAfterReview(supervisorIntent.enabled, controlProjectDir === STAGING_DIR ? undefined : controlProjectDir);
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

      if (supervisorIntent.action === 'resume-run') {
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

      if (supervisorIntent.action === 'stop-run') {
        const result = stopPipelineRun(controlProjectDir === STAGING_DIR ? undefined : controlProjectDir);
        if (!result.success) {
          appendSupervisorFailureAndGuidance(
            controlState,
            controlEventsFile,
            result.error || 'Supervisor could not stop the run'
          );
          return NextResponse.json({ success: false, error: result.error || 'Could not stop pipeline' }, { status: 409 });
        }
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

      return streamClaude(
        {
          prompt: conceptContext,
          projectDir,
          pipelineDir: BUILDUI_DIR,
          model: pipelineModel,
          provider: pipelineProvider === 'claude' ? undefined : pipelineProvider,
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
  }

  appendUserEvent(state, agent, message);
  writeState(eventsFile, state);

  return streamClaude(
    {
      prompt: [buildWorkspaceGuard(workspaceDir), '', finalMessage].join('\n\n'),
      projectDir,
      pipelineDir: BUILDUI_DIR,
      model: pipelineModel,
      provider: pipelineProvider === 'claude' ? undefined : pipelineProvider,
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
  const auth = authorizeLocalOrTokenRequest(req, 'chat endpoint');
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message || 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    agent,
    message,
    mode,
    model,
    provider,
    workingDir,
    securityMode,
    permissionMode,
    runGoal,
    runFinalAudit,
  } = body as Record<string, unknown>;

  const parsedAgentModels = normalizeAgentModels(
    body && typeof body === 'object' && body.agentModels && typeof body.agentModels === 'object' && !Array.isArray(body.agentModels)
      ? (body.agentModels as AgentModelOverrides)
      : undefined
  );
  const requestedModel = typeof model === 'string' ? model : '';

  const agentId = String(agent || '').trim();

  if (mode === 'manual') {
    return handleManual(
      agentId,
      String(message || ''),
      requestedModel,
      String(provider || 'claude'),
      typeof workingDir === 'string' ? workingDir : undefined,
      parsedAgentModels,
    );
  }

  return handlePipeline(
    agentId,
    String(message || ''),
    requestedModel,
    String(provider || 'claude'),
    typeof workingDir === 'string' ? workingDir : undefined,
    parsedAgentModels,
    {
    securityMode: securityMode === 'strict' ? 'strict' : 'fast',
    permissionMode: permissionMode === 'plan' ? 'plan' : permissionMode === 'dangerously-skip-permissions' ? 'dangerously-skip-permissions' : 'auto',
    runGoal: runGoal === 'plan-only' ? 'plan-only' : 'full-build',
    runFinalAudit: runFinalAudit === true,
    }
  );
}
