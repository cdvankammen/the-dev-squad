'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
  selectedModel?: string;
  selectedProvider?: string;
  requestedWorkingDir?: string;
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
  workingDir?: string;
  agentModels?: Record<string, string | undefined>;
}

interface SendChatOptions {
  securityMode?: SecurityMode;
  permissionMode?: PermissionMode;
  runGoal?: RunGoal;
  runFinalAudit?: boolean;
}

function shouldUpdatePipelineState(prev: PipelineState, next: PipelineState): boolean {
  const prevLastEvent = prev.events[prev.events.length - 1];
  const nextLastEvent = next.events[next.events.length - 1];
  const prevTurn = prev.runtime?.activeTurn;
  const nextTurn = next.runtime?.activeTurn;

  return !(
    prev.projectDir === next.projectDir &&
    prev.currentPhase === next.currentPhase &&
    prev.pipelineStatus === next.pipelineStatus &&
    prev.activeAgent === next.activeAgent &&
    prev.buildComplete === next.buildComplete &&
    prev.stopAfterPhase === next.stopAfterPhase &&
    prev.selectedModel === next.selectedModel &&
    prev.selectedProvider === next.selectedProvider &&
    prev.requestedWorkingDir === next.requestedWorkingDir &&
    prev.events.length === next.events.length &&
    prevLastEvent?.time === nextLastEvent?.time &&
    prevLastEvent?.type === nextLastEvent?.type &&
    prevLastEvent?.text === nextLastEvent?.text &&
    prevTurn?.status === nextTurn?.status &&
    prevTurn?.lastEventAt === nextTurn?.lastEventAt &&
    prevTurn?.sessionId === nextTurn?.sessionId
  );
}

async function readJsonResponse<T extends Record<string, unknown> = Record<string, unknown>>(res: Response, fallback: T, context: string): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();

  if (!trimmed) {
    if (res.ok) return fallback;
    return {
      ...fallback,
      success: false,
      ok: false,
      error: `${context} failed with HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`,
    } as T;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    if (res.ok) return fallback;
    return {
      ...fallback,
      success: false,
      ok: false,
      error: `${context} returned invalid JSON (${res.status})`,
    } as T;
  }
}

export function usePipelineState({ pollInterval = 400, mode, model, provider, workingDir, agentModels }: UsePipelineOptions) {
  const [state, setState] = useState<PipelineState>(EMPTY_STATE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;
    let controller: AbortController | null = null;

    async function poll() {
      try {
        controller?.abort();
        controller = new AbortController();
        const res = await fetch(`/api/state?mode=${mode}&_=${Date.now()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setState((prev) => (shouldUpdatePipelineState(prev, data) ? data : prev));
          setError(null);
        }
      } catch (err) {
        if (active && !(err instanceof DOMException && err.name === 'AbortError')) {
          setError(String(err));
        }
      } finally {
        if (active) {
          const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
          const nextDelay = hidden ? Math.max(pollInterval * 4, 5000) : pollInterval;
          timer = window.setTimeout(() => {
            void poll();
          }, nextDelay);
        }
      }
    }

    void poll();
    return () => {
      active = false;
      controller?.abort();
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [pollInterval, mode]);

  const sendChat = useCallback(async (agent: AgentId, message: string, options?: SendChatOptions) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent,
        message,
        mode,
        model,
        provider,
        workingDir,
        agentModels,
        securityMode: options?.securityMode,
        permissionMode: options?.permissionMode,
        runGoal: options?.runGoal,
        runFinalAudit: options?.runFinalAudit,
      }),
    });
    return readJsonResponse<Record<string, unknown>>(res, {}, 'Chat request');
  }, [mode, model, provider, workingDir, agentModels]);

  const startPipeline = useCallback(async (securityMode: SecurityMode, runGoal: RunGoal, permissionMode?: PermissionMode, runFinalAudit?: boolean) => {
    const res = await fetch('/api/start-pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        securityMode,
        permissionMode,
        runGoal,
        runFinalAudit: runFinalAudit === true,
        model,
        provider,
        workingDir,
        agentModels,
      }),
    });
    return readJsonResponse<Record<string, unknown>>(res, {}, 'Start pipeline');
  }, [agentModels, model, provider, workingDir]);

  const resumePipeline = useCallback(async () => {
    const res = await fetch('/api/resume-pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return readJsonResponse<Record<string, unknown>>(res, {}, 'Resume pipeline');
  }, []);

  const sendFindingToC = useCallback(async (findingId: string) => {
    const res = await fetch('/api/audit-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send-to-c', findingId }),
    });
    return readJsonResponse<Record<string, unknown>>(res, {}, 'Send audit finding to C');
  }, []);

  const dismissFinding = useCallback(async (findingId: string) => {
    const res = await fetch('/api/audit-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', findingId }),
    });
    return readJsonResponse<Record<string, unknown>>(res, {}, 'Dismiss audit finding');
  }, []);

  const deployAfterAudit = useCallback(async () => {
    const res = await fetch('/api/audit-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deploy' }),
    });
    return readJsonResponse<Record<string, unknown>>(res, {}, 'Deploy after audit');
  }, []);

  const setStopAfterReview = useCallback(async (enabled: boolean) => {
    const res = await fetch('/api/pipeline-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: enabled ? 'stop-after-review' : 'clear-stop-after-review',
      }),
    });
    return readJsonResponse<Record<string, unknown>>(res, {}, 'Set stop-after-review');
  }, []);

  const stopPipeline = useCallback(async () => {
    const res = await fetch('/api/stop-pipeline', { method: 'POST' });
    return readJsonResponse<Record<string, unknown>>(res, {}, 'Stop pipeline');
  }, []);

  const approveBash = useCallback(async (approved: boolean, pending?: PendingApproval | null) => {
    const res = await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approved,
        requestId: pending?.requestId,
        projectDir: pending?.projectDir,
      }),
    });
    return readJsonResponse<Record<string, unknown>>(res, {}, 'Approve Bash request');
  }, []);

  const getPlan = useCallback(async () => {
    const res = await fetch('/api/plan');
    if (!res.ok) return null;
    const data = await res.json();
    return data.content as string | null;
  }, []);

  const resetState = useCallback(async () => {
    const res = await fetch('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    const data = await readJsonResponse<Record<string, unknown>>(res, { ok: true }, 'Reset state');
    if (data?.ok) {
      setState(EMPTY_STATE);
      setError(null);
    }
    return data;
  }, [mode]);

  // Get events for a specific agent
  const eventsByAgent = useMemo(() => {
    const grouped: Partial<Record<AgentId, PipelineEvent[]>> = { A: [], B: [], C: [], D: [], E: [], S: [] };
    for (const event of state.events) {
      if (event.agent in grouped) {
        grouped[event.agent as AgentId]!.push(event);
      }
    }
    return grouped;
  }, [state.events]);

  const agentEvents = useCallback((agent: AgentId) => {
    return eventsByAgent[agent] || [];
  }, [eventsByAgent]);

  // Get latest speech for an agent (for bubble display)
  const agentSpeech = useCallback((agent: AgentId): string | null => {
    const events = (eventsByAgent[agent] || []).filter((e: PipelineEvent) => e.type === 'text' || e.type === 'status' || e.type === 'tool_call');
    if (events.length === 0) return null;
    const last = events[events.length - 1];
    return last.text.length > 80 ? last.text.slice(0, 77) + '...' : last.text;
  }, [eventsByAgent]);

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
