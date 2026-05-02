import { execFileSync } from 'node:child_process';
import { getBaseUrlForProvider, getProviderConfig } from '@/lib/providerConfig';

export type ProviderId = 'claude' | 'opencode' | 'lm-studio' | 'ollama' | 'openwebui' | 'openai-compat' | 'claude-code-router' | 'openclaude-code';

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  description: string;
  defaultModel: string;
  mode: 'claude-code-cli' | 'opencode-cli' | 'openai-compat-http';
}

export interface ProviderModel {
  id: string;
  label: string;
  providerId: ProviderId;
  source: 'static' | 'opencode' | 'lm-studio';
  paramsString?: string;
  sizeB?: number;
  cooldownExempt?: boolean;
  capability?: 'generation' | 'embeddings' | 'unknown';
  loaded?: boolean;
  ready?: boolean;
  unavailableReason?: string;
}

export interface OpenCodeProviderInfo {
  providers: string[];
  credentialsCount: number;
  raw: string;
}

export interface ProviderModelListResult {
  models: ProviderModel[];
  status: 'ok' | 'empty' | 'error';
  error?: string;
  endpoint?: string;
  readyModels?: ProviderModel[];
  recommendedModel?: ProviderModel;
  preflightOk?: boolean;
  preflightMessage?: string;
}

function normalizeModel(model: ProviderModel): ProviderModel | null {
  const id = String(model.id || '').trim();
  if (!id) return null;
  const label = String(model.label || id).trim() || id;
  return { ...model, id, label };
}

function dedupeModels(models: ProviderModel[]): ProviderModel[] {
  const seen = new Set<string>();
  const result: ProviderModel[] = [];

  for (const model of models) {
    const normalized = normalizeModel(model);
    if (!normalized) continue;
    if (seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    result.push(normalized);
  }

  return result;
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    description: 'Current default engine. Uses the installed Claude CLI and the existing pipeline doctrine.',
    defaultModel: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    mode: 'claude-code-cli',
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    description: 'Local provider router. Runs the OpenCode CLI in JSON mode and discovers models dynamically.',
    defaultModel: 'opencode/gpt-5-nano',
    mode: 'opencode-cli',
  },
  {
    id: 'lm-studio',
    label: 'LM Studio',
    description: 'Direct OpenAI-compatible HTTP provider for local or remote LM Studio servers.',
    defaultModel: '',
    mode: 'openai-compat-http',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    description: 'Local or remote Ollama server through the same JSON/tool-call shim path.',
    defaultModel: '',
    mode: 'openai-compat-http',
  },
  {
    id: 'openwebui',
    label: 'Open WebUI',
    description: 'Open WebUI HTTP API with saved host/port/api-key settings and dynamic model discovery.',
    defaultModel: '',
    mode: 'openai-compat-http',
  },
  {
    id: 'openai-compat',
    label: 'OpenAI-Compatible',
    description: 'Generic OpenAI-compatible HTTP endpoint for self-hosted or routed providers.',
    defaultModel: '',
    mode: 'openai-compat-http',
  },
  {
    id: 'claude-code-router',
    label: 'Claude Code Router',
    description: 'OpenAI-compatible router endpoint for Claude Code Router or a similar local router.',
    defaultModel: '',
    mode: 'openai-compat-http',
  },
  {
    id: 'openclaude-code',
    label: 'OpenClaude Code',
    description: 'OpenAI-compatible OpenClaude/OpenClaude Code endpoint.',
    defaultModel: '',
    mode: 'openai-compat-http',
  },
];

const CLAUDE_MODELS: ProviderModel[] = [
  { id: 'us.anthropic.claude-opus-4-1-20250805-v1:0', label: 'Claude Opus 4.1', providerId: 'claude', source: 'static' },
  { id: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Claude Sonnet 4.5', providerId: 'claude', source: 'static' },
];

function runCommand(command: string, args: string[]): string {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
    env: {
      ...process.env,
      TERM: 'dumb',
    },
  }).trim();
}

function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-9;]*m/g, '');
}

function getModelSource(providerId: ProviderId): ProviderModel['source'] {
  if (providerId === 'lm-studio') return 'lm-studio';
  if (providerId === 'opencode') return 'opencode';
  return 'static';
}

function estimateModelSizeBFromText(...parts: unknown[]): number | undefined {
  const text = parts.map((part) => String(part || '')).join(' ').toLowerCase();
  const explicit = text.match(/(?:^|[-_/\s:])([0-9]+(?:\.[0-9]+)?)\s*(?:b|bn|billion)(?:$|[-_/\s:])/);
  if (explicit) {
    const parsed = Number.parseFloat(explicit[1] || '');
    if (Number.isFinite(parsed)) return parsed;
  }
  const efficient = text.match(/(?:^|[-_/\s:])e([0-9]+(?:\.[0-9]+)?)b(?:$|[-_/\s:])/);
  if (efficient) {
    const parsed = Number.parseFloat(efficient[1] || '');
    if (Number.isFinite(parsed)) return parsed;
  }
  if (/\b(nano|tiny|mini|small)\b/.test(text)) return 4;
  return undefined;
}

function providerNeedsStrictReadyCheck(providerId: ProviderId): boolean {
  return providerId === 'lm-studio' || providerId === 'openwebui' || providerId === 'ollama';
}

function normalizeCapability(record?: Record<string, unknown>, id?: string, label?: string): ProviderModel['capability'] {
  const explicit = String(record?.type || record?.capability || record?.object || '').trim().toLowerCase();
  const haystack = [id, label, record?.display_name, record?.name, record?.model]
    .map((part) => String(part || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');

  if (explicit.includes('embed') || /\bembed(ding|s)?\b|nomic-embed/.test(haystack)) {
    return 'embeddings';
  }
  if (explicit.includes('llm') || explicit.includes('chat') || explicit.includes('completion')) {
    return 'generation';
  }
  return 'generation';
}

function normalizeLoadedState(record?: Record<string, unknown>): boolean | undefined {
  const loadedInstances = Array.isArray(record?.loaded_instances) ? record.loaded_instances : null;
  if (loadedInstances) return loadedInstances.length > 0;

  const state = String(record?.state || record?.status || '').trim().toLowerCase();
  if (!state) return undefined;
  if (['loaded', 'ready', 'running', 'active'].some((token) => state.includes(token))) return true;
  if (['not-loaded', 'unloaded', 'stopped', 'inactive'].some((token) => state.includes(token))) return false;
  return undefined;
}

export function isRunnableProviderModel(providerId: ProviderId, model: ProviderModel): boolean {
  if (model.capability === 'embeddings') return false;
  if (providerId === 'lm-studio') return model.ready === true;
  if (providerNeedsStrictReadyCheck(providerId)) return model.ready !== false;
  return true;
}

function pickRecommendedModel(providerId: ProviderId, models: ProviderModel[]): ProviderModel | undefined {
  const runnable = models.filter((model) => isRunnableProviderModel(providerId, model));
  const candidates = runnable.length > 0 ? runnable : models.filter((model) => model.capability !== 'embeddings');
  if (candidates.length === 0) return undefined;

  return [...candidates].sort((left, right) => {
    const leftStrictPenalty = left.ready === false ? 1 : 0;
    const rightStrictPenalty = right.ready === false ? 1 : 0;
    if (leftStrictPenalty !== rightStrictPenalty) return leftStrictPenalty - rightStrictPenalty;

    const leftCooldownPenalty = left.cooldownExempt === false ? 1 : 0;
    const rightCooldownPenalty = right.cooldownExempt === false ? 1 : 0;
    if (leftCooldownPenalty !== rightCooldownPenalty) return leftCooldownPenalty - rightCooldownPenalty;

    const leftSize = Number.isFinite(left.sizeB) ? Number(left.sizeB) : Number.POSITIVE_INFINITY;
    const rightSize = Number.isFinite(right.sizeB) ? Number(right.sizeB) : Number.POSITIVE_INFINITY;
    if (leftSize !== rightSize) return leftSize - rightSize;

    return left.label.localeCompare(right.label);
  })[0];
}

function finalizeModelListResult(providerId: ProviderId, base: ProviderModelListResult): ProviderModelListResult {
  const models = dedupeModels(base.models || []);
  const readyModels = models.filter((model) => isRunnableProviderModel(providerId, model));
  const recommendedModel = pickRecommendedModel(providerId, models);

  if (base.status === 'error') {
    return {
      ...base,
      models,
      readyModels,
      recommendedModel,
      preflightOk: false,
      preflightMessage: base.error || `Could not reach ${getProviderDefinition(providerId).label}.`,
    };
  }

  if (!providerNeedsStrictReadyCheck(providerId)) {
    return {
      ...base,
      models,
      readyModels,
      recommendedModel,
      preflightOk: models.length > 0,
      preflightMessage:
        models.length > 0
          ? `${models.length} model${models.length === 1 ? '' : 's'} available.`
          : base.error || 'No models were returned.',
    };
  }

  if (readyModels.length > 0) {
    return {
      ...base,
      models,
      readyModels,
      recommendedModel,
      preflightOk: true,
      preflightMessage: recommendedModel
        ? `${readyModels.length} usable model${readyModels.length === 1 ? '' : 's'} ready. Recommended: ${recommendedModel.label}.`
        : `${readyModels.length} usable model${readyModels.length === 1 ? '' : 's'} ready.`,
    };
  }

  const provider = getProviderDefinition(providerId);
  return {
    ...base,
    models,
    readyModels,
    recommendedModel,
    preflightOk: false,
    preflightMessage:
      providerId === 'lm-studio'
        ? 'LM Studio is reachable, but no loaded generation model is ready. Load a chat model in LM Studio before starting.'
        : providerId === 'openwebui'
          ? 'Open WebUI responded, but no usable generation model is available yet.'
          : providerId === 'ollama'
            ? 'Ollama responded, but no usable generation model is available yet.'
            : base.error || `No usable generation model is ready for ${provider.label}.`,
  };
}

function buildProviderModel(providerId: ProviderId, id: string, label?: string, record?: Record<string, unknown>): ProviderModel {
  const paramsString = String(record?.params_string || record?.parameter_size || '').trim() || undefined;
  const sizeB = estimateModelSizeBFromText(paramsString, id, label, record?.display_name, record?.name);
  const capability = normalizeCapability(record, id, label);
  const loaded = normalizeLoadedState(record);
  const ready = capability === 'generation'
    ? providerId === 'lm-studio'
      ? loaded === true
      : loaded !== false
    : false;
  return {
    id,
    label: String(label || id).trim() || id,
    providerId,
    source: getModelSource(providerId),
    ...(paramsString ? { paramsString } : {}),
    ...(sizeB !== undefined ? { sizeB, cooldownExempt: sizeB <= 8 } : {}),
    ...(capability ? { capability } : {}),
    ...(loaded !== undefined ? { loaded } : {}),
    ...(capability !== 'unknown' ? { ready } : {}),
    ...(capability === 'embeddings'
      ? { unavailableReason: 'Embedding models cannot run the pipeline.' }
      : providerId === 'lm-studio' && loaded === false
        ? { unavailableReason: 'Model is listed in LM Studio but not loaded.' }
        : {}),
  };
}

function readJsonFromUrl(url: string, providerId: ProviderId) {
  const cfg = getProviderConfig(providerId);
  const args = ['-sS', '--connect-timeout', '3', '--max-time', '5'];
  if (cfg.apiKey) {
    args.push('-H', `Authorization: Bearer ${cfg.apiKey}`);
  }
  args.push(url);
  const output = runCommand('curl', args);
  return output ? JSON.parse(output) : null;
}

function mapModelList(providerId: ProviderId, parsed: unknown): ProviderModel[] {
  if (Array.isArray(parsed)) {
    return dedupeModels(parsed
      .map((model) => {
        if (typeof model === 'string') {
          return buildProviderModel(providerId, model, model);
        }
        const record = model as Record<string, unknown>;
        const id = String(record.key || record.id || record.name || record.model || record.display_name || '').trim();
        const label = String(record.display_name || record.name || record.id || record.key || id).trim();
        return buildProviderModel(providerId, id, label, record);
      })
      .filter((model) => model.id));
  }

  if (!parsed || typeof parsed !== 'object') return [];

  const asRecord = parsed as Record<string, unknown>;
  const data = Array.isArray(asRecord.data) ? asRecord.data : [];
  const models = Array.isArray(asRecord.models) ? asRecord.models : [];

  if (models.length > 0) {
    return dedupeModels(models
      .map((model) => {
        if (typeof model === 'string') {
          return buildProviderModel(providerId, model, model);
        }
        const record = model as Record<string, unknown>;
        const id = String(record.key || record.id || record.name || record.model || record.display_name || '').trim();
        const label = String(record.display_name || record.name || record.id || record.key || id).trim();
        return buildProviderModel(providerId, id, label, record);
      })
      .filter((model) => model.id));
  }

  if (data.length > 0) {
    return dedupeModels(data
      .map((model) => {
        const record = model as Record<string, unknown>;
        const id = String(record.id || record.name || record.model || '').trim();
        const label = String(record.name || record.id || id).trim();
        return buildProviderModel(providerId, id, label, record);
      })
      .filter((model) => model.id));
  }

  return [];
}

function listOpenAiCompatModelsDetailed(providerId: ProviderId, endpoints: string[]): ProviderModelListResult {
  const appPort = String(process.env.PORT || '3000');
  let lastError = '';
  let sawReachableEmpty = false;

  for (const endpoint of endpoints) {
    try {
      try {
        const parsedUrl = new URL(endpoint);
        if (['localhost', '127.0.0.1'].includes(parsedUrl.hostname) && parsedUrl.port === appPort) {
          continue;
        }
      } catch {
        // ignore URL parse problems and let curl handle them
      }
      const parsed = readJsonFromUrl(endpoint, providerId);
      const mapped = dedupeModels(mapModelList(providerId, parsed));
      if (mapped.length > 0) {
        return finalizeModelListResult(providerId, { models: mapped, status: 'ok', endpoint });
      }
      sawReachableEmpty = true;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      // try next endpoint
    }
  }

  if (sawReachableEmpty) {
    return finalizeModelListResult(providerId, {
      models: [],
      status: 'empty',
      error: lastError || undefined,
    });
  }

  return finalizeModelListResult(providerId, {
    models: [],
    status: 'error',
    error: lastError || 'Could not reach any model discovery endpoint.',
  });
}

function listOpenAiCompatModels(providerId: ProviderId, endpoints: string[]) {
  return listOpenAiCompatModelsDetailed(providerId, endpoints).models;
}

export function getProviderDefinition(providerId?: string): ProviderDefinition {
  return PROVIDERS.find((provider) => provider.id === providerId) || PROVIDERS[0];
}

export function getProviderDefaultModel(providerId?: string): string {
  return getProviderDefinition(providerId).defaultModel;
}

export function listProviders(): ProviderDefinition[] {
  return [...PROVIDERS];
}

export function listModels(providerId?: string): ProviderModel[] {
  return describeModelListing(providerId).models;
}

export function describeModelListing(providerId?: string): ProviderModelListResult {
  const resolved = getProviderDefinition(providerId);
  if (resolved.id === 'claude') {
    return finalizeModelListResult(resolved.id, { models: dedupeModels([...CLAUDE_MODELS]), status: 'ok' });
  }

  if (resolved.id === 'lm-studio') {
    const base = getBaseUrlForProvider('lm-studio').replace(/\/$/, '');
    return listOpenAiCompatModelsDetailed('lm-studio', [`${base}/api/v1/models`, `${base}/v1/models`]);
  }

  if (resolved.id === 'ollama') {
    const base = getBaseUrlForProvider('ollama').replace(/\/$/, '');
    const tags = listOpenAiCompatModelsDetailed('ollama', [`${base}/api/tags`]);
    if (tags.models.length > 0 || tags.status === 'ok') return tags;
    const compat = listOpenAiCompatModelsDetailed('ollama', [`${base}/v1/models`]);
    if (compat.models.length > 0 || compat.status === 'ok') return compat;
    if (tags.status === 'empty' || compat.status === 'empty') {
      return { models: [], status: 'empty', error: compat.error || tags.error };
    }
    return { models: [], status: 'error', error: compat.error || tags.error };
  }

  if (resolved.id === 'openwebui') {
    const base = getBaseUrlForProvider('openwebui').replace(/\/$/, '');
    return listOpenAiCompatModelsDetailed('openwebui', [
      `${base}/api/models`,
      `${base}/api/v1/models`,
      `${base}/v1/models`,
      `${base}/ollama/api/tags`,
    ]);
  }

  if (resolved.id === 'openai-compat' || resolved.id === 'claude-code-router' || resolved.id === 'openclaude-code') {
    const base = getBaseUrlForProvider(resolved.id).replace(/\/$/, '');
    return listOpenAiCompatModelsDetailed(resolved.id, [`${base}/v1/models`, `${base}/api/models`]);
  }

  const output = runCommand('opencode', ['models']);
  return finalizeModelListResult(resolved.id, {
    models: dedupeModels(output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((id) => ({
        id,
        label: id,
        providerId: 'opencode' as const,
        source: 'opencode' as const,
      }))),
    status: 'ok',
  });
}

export function inspectOpenCodeProviders(): OpenCodeProviderInfo {
  const raw = stripAnsi(runCommand('opencode', ['providers', 'list']));
  const providers: string[] = [];
  let credentialsCount = 0;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const credentialMatch = trimmed.match(/^(\d+)\s+credentials?$/i) || trimmed.match(/^└\s+(\d+)\s+credentials?$/i);
    if (credentialMatch) {
      credentialsCount = Number(credentialMatch[1] || 0);
      continue;
    }
    if (trimmed.startsWith('●')) {
      providers.push(trimmed.replace(/^●\s*/, '').trim());
    }
  }

  return { providers, credentialsCount, raw };
}
