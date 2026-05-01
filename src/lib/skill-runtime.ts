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

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function normalizeHeaderHost(value: string): string {
  const trimmed = String(value || '').trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']');
    return end === -1 ? trimmed : trimmed.slice(0, end + 1);
  }
  return trimmed.split(':')[0] || '';
}

function isLoopbackHostName(host: string): boolean {
  const normalized = normalizeHeaderHost(host);
  return LOOPBACK_HOSTNAMES.has(normalized) || normalized === '::ffff:127.0.0.1';
}

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

function isLoopbackRequest(req: NextRequest): boolean {
  try {
    const urlHost = new URL(req.url).hostname.toLowerCase();
    const hostHeader = req.headers.get('host') || '';
    const forwardedHost = req.headers.get('x-forwarded-host') || '';
    const forwarded = req.headers.get('forwarded') || '';
    const forwardedHostMatch = forwarded.match(/host=([^;,]+)/i);

    if (!isLoopbackHostName(urlHost)) return false;
    if (hostHeader && !isLoopbackHostName(hostHeader)) return false;
    if (forwardedHost && !isLoopbackHostName(forwardedHost)) return false;
    if (forwardedHostMatch?.[1] && !isLoopbackHostName(forwardedHostMatch[1])) return false;
    return true;
  } catch {
    return false;
  }
}

export function authorizeSkillRequest(req: NextRequest): SkillAuthResult {
  return authorizeLocalOrTokenRequest(req, 'skill/MCP endpoint');
}

export function authorizeLocalOrTokenRequest(req: NextRequest, surfaceLabel = 'endpoint'): SkillAuthResult {
  const expected = String(process.env.DEV_SQUAD_API_TOKEN || '').trim();
  const allowUnauthLocal = String(process.env.DEV_SQUAD_ALLOW_UNAUTH_LOCAL || '').trim() === '1';

  if (allowUnauthLocal && isLoopbackRequest(req)) {
    return { ok: true };
  }

  if (!expected) {
    return {
      ok: false,
      message: `Unauthorized: set DEV_SQUAD_API_TOKEN (recommended) or DEV_SQUAD_ALLOW_UNAUTH_LOCAL=1 for localhost-only ${surfaceLabel} development`,
    };
  }

  const provided = extractSkillToken(req);
  if (provided && constantTimeEqual(expected, provided)) {
    return { ok: true };
  }

  return {
    ok: false,
    message: `Unauthorized: missing or invalid token for ${surfaceLabel}`,
  };
}

export function buildInternalAuthHeaders(): Record<string, string> {
  const token = String(process.env.DEV_SQUAD_API_TOKEN || '').trim();
  if (!token) return {};
  return {
    authorization: `Bearer ${token}`,
    'x-dev-squad-token': token,
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
    headers: buildInternalAuthHeaders(),
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
    headers: {
      'Content-Type': 'application/json',
      ...buildInternalAuthHeaders(),
    },
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
