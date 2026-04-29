import { execFileSync } from 'node:child_process';

export type ProviderId = 'claude' | 'opencode';

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  description: string;
  defaultModel: string;
  mode: 'claude-code-cli' | 'opencode-cli';
}

export interface ProviderModel {
  id: string;
  label: string;
  providerId: ProviderId;
  source: 'static' | 'opencode';
}

export interface OpenCodeProviderInfo {
  providers: string[];
  credentialsCount: number;
  raw: string;
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    description: 'Current default engine. Uses the installed Claude CLI and the existing pipeline doctrine.',
    defaultModel: 'claude-sonnet-4-6',
    mode: 'claude-code-cli',
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    description: 'Local provider router. Runs the OpenCode CLI in JSON mode and discovers models dynamically.',
    defaultModel: 'opencode/gpt-5-nano',
    mode: 'opencode-cli',
  },
];

const CLAUDE_MODELS: ProviderModel[] = [
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', providerId: 'claude', source: 'static' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', providerId: 'claude', source: 'static' },
];

function runCommand(command: string, args: string[]): string {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      TERM: 'dumb',
    },
  }).trim();
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
    return [...CLAUDE_MODELS];
  }

  const output = runCommand('opencode', ['models']);
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((id) => ({
      id,
      label: id,
      providerId: 'opencode' as const,
      source: 'opencode' as const,
    }));
}

export function inspectOpenCodeProviders(): OpenCodeProviderInfo {
  const raw = runCommand('opencode', ['providers', 'list']);
  const providers: string[] = [];
  let credentialsCount = 0;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const credentialMatch = trimmed.match(/^(\d+)\s+credentials?$/i);
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
