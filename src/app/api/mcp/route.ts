import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeSkillRequest,
  buildSkillMetadata,
  buildUpdates,
  fetchPipelineState,
  getRequestOrigin,
  normalizeAfter,
  normalizeLimit,
  sendSupervisorMessage,
  type SkillMode,
} from '@/lib/skill-runtime';
import { describeModelListing, getProviderDefinition } from '@/lib/provider-catalog';

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

function resolveMode(input: unknown): SkillMode {
  return input === 'manual' ? 'manual' : 'pipeline';
}

function normalizeId(input: unknown): JsonRpcId {
  if (typeof input === 'string' || typeof input === 'number') return input;
  return null;
}

function rpcResult(id: JsonRpcId, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result });
}

function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return NextResponse.json({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  });
}

function toolResult(structuredContent: unknown) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(structuredContent, null, 2),
      },
    ],
    structuredContent,
  };
}

const TOOLS = [
  {
    name: 'devsquad.supervisor_message',
    description: 'Send a message to Supervisor S only. This can capture concept, start planning, or operate the pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        mode: { type: 'string', enum: ['pipeline', 'manual'] },
        model: { type: 'string' },
        provider: { type: 'string' },
        workingDir: { type: 'string' },
        securityMode: { type: 'string', enum: ['fast', 'strict'] },
        permissionMode: { type: 'string', enum: ['auto', 'plan', 'dangerously-skip-permissions'] },
        runGoal: { type: 'string', enum: ['full-build', 'plan-only'] },
        runFinalAudit: { type: 'boolean' },
        agentModels: { type: 'object', additionalProperties: { type: 'string' } },
      },
      required: ['message'],
      additionalProperties: false,
    },
  },
  {
    name: 'devsquad.pipeline_state',
    description: 'Read normalized pipeline/manual state snapshot.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['pipeline', 'manual'] },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'devsquad.pipeline_updates',
    description: 'Poll incremental event updates after an index.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['pipeline', 'manual'] },
        after: { type: 'number' },
        limit: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'devsquad.provider_models',
    description: 'List models for a provider so an outer shell can choose model/agent overrides before messaging Supervisor S.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    protocol: 'jsonrpc-2.0',
    metadata: buildSkillMetadata(),
    methods: ['initialize', 'tools/list', 'tools/call'],
    tools: TOOLS,
    constraints: 'External callers can control only Supervisor S; A/B/C/D/E are observable through state and updates only.',
  });
}

export async function POST(req: NextRequest) {
  const auth = authorizeSkillRequest(req);
  if (!auth.ok) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32001,
        message: auth.message || 'Unauthorized',
      },
    }, { status: 401 });
  }

  let payload: JsonRpcRequest;
  try {
    payload = (await req.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, 'Parse error');
  }

  const id = normalizeId(payload.id);
  const method = String(payload.method || '').trim();
  const params = payload.params && typeof payload.params === 'object' ? payload.params : {};
  const origin = getRequestOrigin(req);

  if (!method) return rpcError(id, -32600, 'Invalid Request', 'Missing method');

  if (method === 'initialize') {
    return rpcResult(id, {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: 'dev-squad-mcp-gateway',
        version: '0.1.0',
      },
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      instructions:
        'Use tools/list and tools/call. Only Supervisor S is externally controllable. Observe A/B/C/D/E through pipeline state and updates.',
    });
  }

  if (method === 'tools/list') {
    return rpcResult(id, { tools: TOOLS });
  }

  if (method !== 'tools/call') {
    return rpcError(id, -32601, `Method not found: ${method}`);
  }

  const toolName = String(params.name || '').trim();
  const args = params.arguments && typeof params.arguments === 'object' ? (params.arguments as Record<string, unknown>) : {};

  if (!toolName) {
    return rpcError(id, -32602, 'Invalid params', 'Missing tool name');
  }

  try {
    if (toolName === 'devsquad.supervisor_message') {
      const message = String(args.message || '').trim();
      if (!message) return rpcError(id, -32602, 'Invalid params', 'message is required');

      const result = await sendSupervisorMessage(origin, {
        message,
        mode: resolveMode(args.mode),
        model: typeof args.model === 'string' ? args.model : undefined,
        provider: typeof args.provider === 'string' ? args.provider : undefined,
        workingDir: typeof args.workingDir === 'string' ? args.workingDir : undefined,
        securityMode: args.securityMode === 'strict' ? 'strict' : args.securityMode === 'fast' ? 'fast' : undefined,
        permissionMode:
          args.permissionMode === 'plan' || args.permissionMode === 'dangerously-skip-permissions' || args.permissionMode === 'auto'
            ? args.permissionMode
            : undefined,
        runGoal: args.runGoal === 'plan-only' ? 'plan-only' : args.runGoal === 'full-build' ? 'full-build' : undefined,
        runFinalAudit: args.runFinalAudit === true,
        agentModels:
          args.agentModels && typeof args.agentModels === 'object' && !Array.isArray(args.agentModels)
            ? (args.agentModels as Record<string, string>)
            : undefined,
      });

      return rpcResult(
        id,
        toolResult({
          success: true,
          targetAgent: 'S',
          response: result.response,
          state: result.state,
          note: 'Only Supervisor S can be controlled through this MCP gateway.',
        })
      );
    }

    if (toolName === 'devsquad.pipeline_state') {
      const mode = resolveMode(args.mode);
      const state = await fetchPipelineState(origin, mode);
      return rpcResult(id, toolResult({ success: true, mode, state }));
    }

    if (toolName === 'devsquad.pipeline_updates') {
      const mode = resolveMode(args.mode);
      const after = normalizeAfter(args.after);
      const limit = normalizeLimit(args.limit);
      const state = await fetchPipelineState(origin, mode);
      return rpcResult(id, toolResult({ success: true, mode, updates: buildUpdates(state, after, limit) }));
    }

    if (toolName === 'devsquad.provider_models') {
      const provider = getProviderDefinition(typeof args.provider === 'string' ? args.provider : 'lm-studio');
      const result = describeModelListing(provider.id);
      return rpcResult(id, toolResult({
        success: result.status === 'ok',
        providerId: provider.id,
        provider,
        status: result.status,
        error: result.error,
        endpoint: result.endpoint,
        models: result.models,
        note: 'Use these model ids in devsquad.supervisor_message model and agentModels arguments. LM Studio/Ollama model switches between >8B models are cooldown-protected by the orchestrator.',
      }));
    }

    return rpcError(id, -32601, `Unknown tool: ${toolName}`);
  } catch (error) {
    return rpcError(id, -32000, error instanceof Error ? error.message : String(error));
  }
}
