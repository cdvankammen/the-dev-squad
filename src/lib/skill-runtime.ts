import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

export type SkillMode = 'pipeline' | 'manual';

export interface SupervisorMessageArgs {
  message: string;
  mode?: SkillMode;
  model?: string;
  provider?: string;
  workingDir?: string;
  securityMode?: 'fast' | 'strict';
  permissionMode?: 'auto' | 'plan' | 'dangerously-skip-permissions';
  runGoal?: 'full-build' | 'plan-only';
  runFinalAudit?: boolean;
  agentModels?: Record<string, string>;
}

export interface SkillAuthResult {
  ok: boolean;
  message?: string;
}

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function extractSkillToken(req: NextRequest): string {
  const auth = String(req.headers.get('authorization') || '').trim();
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return String(req.headers.get('x-dev-squad-token') || '').trim();
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function isLocalSkillRequest(req: NextRequest): boolean {
  try {
    const host = new URL(req.url).hostname.toLowerCase();
    return LOCALHOST_HOSTNAMES.has(host);
  } catch {
    return false;
  }
}

export function authorizeSkillRequest(req: NextRequest): SkillAuthResult {
  const expected = String(process.env.DEV_SQUAD_API_TOKEN || '').trim();
  if (!expected) {
    if (!isLocalSkillRequest(req)) {
      return {
        ok: false,
        message: 'Unauthorized: DEV_SQUAD_API_TOKEN is required for non-local skill/MCP access',
      };
    }
    return { ok: true };
  }

  const provided = extractSkillToken(req);
  if (provided && constantTimeEqual(expected, provided)) {
    return { ok: true };
  }

  return {
    ok: false,
    message: 'Unauthorized: missing or invalid token for skill/MCP endpoint',
  };
}

export function getRequestOrigin(req: NextRequest): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    try {
      return { raw: await res.text() };
    } catch {
      return { raw: '' };
    }
  }
}

export async function fetchPipelineState(origin: string, mode: SkillMode = 'pipeline'): Promise<Record<string, unknown>> {
  const res = await fetch(`${origin}/api/state?mode=${encodeURIComponent(mode)}`, {
    method: 'GET',
    cache: 'no-store',
  });
  const data = await parseJsonSafe(res);
  if (!res.ok || !data || typeof data !== 'object') {
    throw new Error(`Could not read state (${res.status})`);
  }
  return data as Record<string, unknown>;
}

export function normalizeAfter(input: unknown): number {
  const parsed = Number.parseInt(String(input ?? ''), 10);
  if (!Number.isFinite(parsed)) return -1;
  return parsed;
}

export function normalizeLimit(input: unknown): number {
  const parsed = Number.parseInt(String(input ?? ''), 10);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(500, parsed));
}

export function buildUpdates(state: Record<string, unknown>, after: number, limit: number) {
  const events = Array.isArray(state.events) ? (state.events as Array<Record<string, unknown>>) : [];
  const start = Math.max(0, after + 1);
  const sliced = events.slice(start, start + limit);
  const nextAfter = sliced.length > 0 ? start + sliced.length - 1 : after;
  return {
    after,
    nextAfter,
    totalEvents: events.length,
    events: sliced,
  };
}

export async function sendSupervisorMessage(
  origin: string,
  args: SupervisorMessageArgs,
): Promise<{ response: unknown; state: Record<string, unknown> }> {
  const mode: SkillMode = args.mode === 'manual' ? 'manual' : 'pipeline';

  const payload = {
    agent: 'S',
    message: args.message,
    mode,
    model: args.model,
    provider: args.provider,
    workingDir: args.workingDir,
    securityMode: args.securityMode,
    permissionMode: args.permissionMode,
    runGoal: args.runGoal,
    runFinalAudit: args.runFinalAudit,
    agentModels: args.agentModels,
  };

  const chatRes = await fetch(`${origin}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const response = await parseJsonSafe(chatRes);
  if (!chatRes.ok) {
    throw new Error(`Supervisor message failed (${chatRes.status})`);
  }

  const state = await fetchPipelineState(origin, mode);
  return { response, state };
}

export function buildSkillMetadata() {
  return {
    name: 'dev-squad-skill',
    version: '0.1.0',
    description: 'Supervisor-only skill interface for controlling and observing The Dev Squad pipeline.',
    constraints: {
      controllableAgents: ['S'],
      readOnlyAgents: ['A', 'B', 'C', 'D', 'E'],
    },
    tools: [
      {
        name: 'devsquad.supervisor_message',
        description: 'Send a message to Supervisor S only. Use this to capture concepts, start runs, or ask for guidance.',
      },
      {
        name: 'devsquad.pipeline_state',
        description: 'Get normalized manual/pipeline state snapshot.',
      },
      {
        name: 'devsquad.pipeline_updates',
        description: 'Poll incremental event updates since a given index.',
      },
    ],
  };
}
