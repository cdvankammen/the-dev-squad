import { execFileSync } from 'node:child_process';
import { getBaseUrlForProvider, getProviderConfig } from '@/lib/providerConfig';

export type ProviderId = 'claude' | 'opencode' | 'lm-studio' | 'ollama' | 'openwebui' | 'openai-compat';

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
}

export interface OpenCodeProviderInfo {
  providers: string[];
  credentialsCount: number;
  raw: string;
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
  if (!parsed || typeof parsed !== 'object') return [];

  const asRecord = parsed as Record<string, unknown>;
  const data = Array.isArray(asRecord.data) ? asRecord.data : [];
  const models = Array.isArray(asRecord.models) ? asRecord.models : [];

  if (models.length > 0) {
    return dedupeModels(models
      .map((model) => {
        if (typeof model === 'string') {
          return { id: model, label: model, providerId, source: getModelSource(providerId) };
        }
        const record = model as Record<string, unknown>;
        const id = String(record.key || record.id || record.name || record.model || record.display_name || '').trim();
        const label = String(record.display_name || record.name || record.id || record.key || id).trim();
        return { id, label, providerId, source: getModelSource(providerId) };
      })
      .filter((model) => model.id));
  }

  if (data.length > 0) {
    return dedupeModels(data
      .map((model) => {
        const record = model as Record<string, unknown>;
        const id = String(record.id || record.name || record.model || '').trim();
        const label = String(record.name || record.id || id).trim();
        return { id, label, providerId, source: getModelSource(providerId) };
      })
      .filter((model) => model.id));
  }

  return [];
}

function listOpenAiCompatModels(providerId: ProviderId, endpoints: string[]) {
  const appPort = String(process.env.PORT || '3000');
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
      if (mapped.length > 0) return mapped;
    } catch {
      // try next endpoint
    }
  }
  return [];
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
  const resolved = getProviderDefinition(providerId);
  if (resolved.id === 'claude') {
    return dedupeModels([...CLAUDE_MODELS]);
  }

  if (resolved.id === 'lm-studio') {
    const base = getBaseUrlForProvider('lm-studio').replace(/\/$/, '');
    return listOpenAiCompatModels('lm-studio', [`${base}/api/v1/models`, `${base}/v1/models`]);
  }

  if (resolved.id === 'ollama') {
    const base = getBaseUrlForProvider('ollama').replace(/\/$/, '');
    const tags = listOpenAiCompatModels('ollama', [`${base}/api/tags`]);
    if (tags.length > 0) return tags;
    return listOpenAiCompatModels('ollama', [`${base}/v1/models`]);
  }

  if (resolved.id === 'openwebui') {
    const base = getBaseUrlForProvider('openwebui').replace(/\/$/, '');
    return listOpenAiCompatModels('openwebui', [`${base}/api/models`, `${base}/v1/models`]);
  }

  if (resolved.id === 'openai-compat') {
    const base = getBaseUrlForProvider('openai-compat').replace(/\/$/, '');
    return listOpenAiCompatModels('openai-compat', [`${base}/v1/models`, `${base}/api/models`]);
  }

  const output = runCommand('opencode', ['models']);
  return dedupeModels(output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((id) => ({
      id,
      label: id,
      providerId: 'opencode' as const,
      source: 'opencode' as const,
    })));
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
