'use client';

import { useEffect, useState, useCallback } from 'react';
import type { PipelineRuntimeState } from '@/lib/pipeline-runtime';

export type AgentId = 'A' | 'B' | 'C' | 'D' | 'E' | 'S';
export type Phase = 'concept' | 'planning' | 'plan-review' | 'coding' | 'code-review' | 'testing' | 'security-audit' | 'deploy' | 'complete';
export type AppMode = 'pipeline' | 'manual';
export type SecurityMode = 'fast' | 'strict';
export type PermissionMode = 'auto' | 'plan' | 'dangerously-skip-permissions';
export type RunGoal = 'full-build' | 'plan-only';
export type StopAfterPhase = 'none' | 'plan-review';
export type PipelineStatus = 'idle' | 'running' | 'paused' | 'awaiting-audit-decision' | 'complete' | 'failed';
export type ResumeAction = 'none' | 'continue-approved-plan' | 'resume-stalled-turn' | 'audit-send-to-c' | 'audit-dismiss' | 'audit-deploy';

export type AuditFindingStatus = 'open' | 'sent-to-c' | 're-auditing' | 'resolved' | 'still-open' | 'dismissed';

export interface AuditFindingHistoryEntry {
  time: string;
  action: 'created' | 'sent-to-c' | 'fix-applied' | 'fix-failed-tests' | 're-audit-passed' | 're-audit-failed' | 'dismissed';
  note?: string;
}

export interface AuditFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  text: string;
  status: AuditFindingStatus;
  createdAt: string;
  history: AuditFindingHistoryEntry[];
}

export interface PipelineEvent {
  time: string;
  agent: AgentId | 'system';
  phase: string;
  type: string;
  text: string;
  detail?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCostUsd: number;
}

export interface PipelineState {
  concept: string;
  projectDir: string;
  currentPhase: Phase;
  securityMode: SecurityMode;
  runGoal: RunGoal;
  runFinalAudit: boolean;
  stopAfterPhase: StopAfterPhase;
  pipelineStatus: PipelineStatus;
  resumeAction?: ResumeAction;
  resumeActionTarget?: string;
  activeAgent: string;
  agentStatus: Record<AgentId, string>;
  sessions: Record<string, string>;
  buildComplete: boolean;
  usage: TokenUsage;
  runtime?: PipelineRuntimeState;
  events: PipelineEvent[];
  auditFindings?: AuditFinding[];
  auditDeployPending?: boolean;
  auditActionInFlight?: boolean;
}

export interface PendingApproval {
  requestId: string;
  projectDir: string;
  agent: AgentId | string;
  tool: string;
  input: Record<string, unknown>;
  description: string;
  createdAt: string;
  approved: boolean | null;
  sessionId?: string;
  phase?: string;
  reason?: string;
}

const EMPTY_STATE: PipelineState = {
  concept: '',
  projectDir: '',
  currentPhase: 'concept',
  securityMode: 'fast',
  runGoal: 'full-build',
  runFinalAudit: false,
  stopAfterPhase: 'none',
  pipelineStatus: 'idle',
  resumeAction: 'none',
  resumeActionTarget: undefined,
  activeAgent: '',
  agentStatus: { A: 'idle', B: 'idle', C: 'idle', D: 'idle', E: 'idle', S: 'idle' },
  sessions: {},
  buildComplete: false,
  usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCostUsd: 0 },
  runtime: { activeTurn: null },
  events: [],
  auditFindings: [],
  auditDeployPending: false,
  auditActionInFlight: false,
};

interface UsePipelineOptions {
  pollInterval?: number;
  mode: AppMode;
  model: string;
  provider?: string;
  agentModels?: Record<string, string>;
}

interface SendChatOptions {
  securityMode?: SecurityMode;
  permissionMode?: PermissionMode;
  runGoal?: RunGoal;
  runFinalAudit?: boolean;
  modelOverride?: string;
  providerOverride?: string;
}

const CHAT_REQUEST_TIMEOUT_MS = 90_000;
const CONTROL_REQUEST_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = CONTROL_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function readResponseBody(res: Response) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function parseJsonBody(text: string, context: string) {
  if (!text.trim()) {
    throw new Error(`${context} returned an empty response body`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${context} returned non-JSON response: ${text.slice(0, 500)}`);
  }
}

export function usePipelineState({ pollInterval = 400, mode, model, provider, agentModels }: UsePipelineOptions) {
  const [state, setState] = useState<PipelineState>(EMPTY_STATE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch(`/api/state?mode=${mode}&_=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setState(data);
          setError(null);
        }
      } catch (err) {
        if (active) setError(String(err));
      }
    }

    poll();
    const interval = setInterval(poll, pollInterval);
    return () => { active = false; clearInterval(interval); };
  }, [pollInterval, mode]);

  const sendChat = useCallback(async (agent: AgentId, message: string, options?: SendChatOptions) => {
    const res = await fetchWithTimeout('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent,
        message,
        mode,
        model: options?.modelOverride ?? model,
        modelProvider: options?.providerOverride ?? provider,
        securityMode: options?.securityMode,
        permissionMode: options?.permissionMode,
        runGoal: options?.runGoal,
        runFinalAudit: options?.runFinalAudit,
      }),
    }, CHAT_REQUEST_TIMEOUT_MS);

    // Defensive parsing: surface helpful errors when the server returns
    // non-JSON or an empty body instead of letting res.json() throw a
    // generic 'Unexpected end of JSON input'.
    const text = await readResponseBody(res);

    if (!res.ok) {
      throw new Error(`Chat API error ${res.status}: ${text || res.statusText}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Chat API returned non-JSON response: ${text || '<empty body>'}`);
    }

    return parseJsonBody(text, 'Chat API');
  }, [mode, model, provider]);

  const startPipeline = useCallback(async (
    securityMode: SecurityMode,
    runGoal: RunGoal,
    permissionMode?: PermissionMode,
    runFinalAudit?: boolean,
    discoveredOnly?: boolean,
    agentModelsArg?: Record<string, string>
  ) => {
    // Allow callers to pass per-agent model overrides explicitly. If not
    // provided, fall back to the agentModels value captured by the hook.
    const payload: Record<string, unknown> = {
      securityMode,
      permissionMode,
      runGoal,
      runFinalAudit: runFinalAudit === true,
      model,
      modelProvider: provider,
      discoveredOnly: discoveredOnly === true,
      agentModels: agentModelsArg ?? agentModels,
    };

    const res = await fetchWithTimeout('/api/start-pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }, CONTROL_REQUEST_TIMEOUT_MS);
    return parseJsonBody(await readResponseBody(res), 'Start pipeline API');
  }, [model, provider, agentModels]);

  const resumePipeline = useCallback(async () => {
    const res = await fetchWithTimeout('/api/resume-pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, CONTROL_REQUEST_TIMEOUT_MS);
    return parseJsonBody(await readResponseBody(res), 'Resume pipeline API');
  }, []);

  const sendFindingToC = useCallback(async (findingId: string) => {
    const res = await fetchWithTimeout('/api/audit-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send-to-c', findingId }),
    }, CONTROL_REQUEST_TIMEOUT_MS);
    return parseJsonBody(await readResponseBody(res), 'Audit action API');
  }, []);

  const dismissFinding = useCallback(async (findingId: string) => {
    const res = await fetchWithTimeout('/api/audit-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', findingId }),
    }, CONTROL_REQUEST_TIMEOUT_MS);
    return parseJsonBody(await readResponseBody(res), 'Audit action API');
  }, []);

  const deployAfterAudit = useCallback(async () => {
    const res = await fetchWithTimeout('/api/audit-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deploy' }),
    }, CONTROL_REQUEST_TIMEOUT_MS);
    return parseJsonBody(await readResponseBody(res), 'Audit action API');
  }, []);

  const setStopAfterReview = useCallback(async (enabled: boolean) => {
    const res = await fetchWithTimeout('/api/pipeline-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: enabled ? 'stop-after-review' : 'clear-stop-after-review',
      }),
    }, CONTROL_REQUEST_TIMEOUT_MS);
    return parseJsonBody(await readResponseBody(res), 'Pipeline control API');
  }, []);

  const stopPipeline = useCallback(async () => {
    const res = await fetchWithTimeout('/api/stop-pipeline', { method: 'POST' }, CONTROL_REQUEST_TIMEOUT_MS);
    return parseJsonBody(await readResponseBody(res), 'Stop pipeline API');
  }, []);

  const approveBash = useCallback(async (approved: boolean, pending?: PendingApproval | null) => {
    const res = await fetchWithTimeout('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approved,
        requestId: pending?.requestId,
        projectDir: pending?.projectDir,
      }),
    }, CONTROL_REQUEST_TIMEOUT_MS);
    return parseJsonBody(await readResponseBody(res), 'Approve API');
  }, []);

  const getPlan = useCallback(async () => {
    const res = await fetchWithTimeout('/api/plan', {}, CONTROL_REQUEST_TIMEOUT_MS);
    if (!res.ok) return null;
    const data = parseJsonBody(await readResponseBody(res), 'Plan API');
    return data.content as string | null;
  }, []);

  const resetState = useCallback(async () => {
    const res = await fetchWithTimeout('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    }, CONTROL_REQUEST_TIMEOUT_MS);
    const data = parseJsonBody(await readResponseBody(res), 'Reset API');
    if (data?.ok) {
      setState(EMPTY_STATE);
      setError(null);
    }
    return data;
  }, [mode]);

  // Get events for a specific agent
  const agentEvents = useCallback((agent: AgentId) => {
    return state.events.filter(e => e.agent === agent);
  }, [state.events]);

  // Get latest speech for an agent (for bubble display)
  const agentSpeech = useCallback((agent: AgentId): string | null => {
    const events = state.events.filter(e => e.agent === agent && (e.type === 'text' || e.type === 'status' || e.type === 'tool_call'));
    if (events.length === 0) return null;
    const last = events[events.length - 1];
    return last.text.length > 80 ? last.text.slice(0, 77) + '...' : last.text;
  }, [state.events]);

  return {
    state,
    error,
    sendChat,
    startPipeline,
    resumePipeline,
    stopPipeline,
    setStopAfterReview,
    approveBash,
    getPlan,
    resetState,
    agentEvents,
    agentSpeech,
    sendFindingToC,
    dismissFinding,
    deployAfterAudit,
  };
}
