import { ChildProcessWithoutNullStreams, execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export interface AdapterSpawnOptions {
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ModelAdapter {
  // Return true if this adapter is available in the current environment
  isAvailable(): boolean;

  // Whether this adapter can actually execute a Claude-Code-like session in
  // the current repo. Discovery-only adapters should return false so the UI
  // and API do not silently fall back to another provider.
  supportsExecution?(): boolean;

  // Spawn a child process that implements the selected model provider's
  // streaming / CLI behavior. The returned ChildProcess must provide `stdout`
  // and `stderr` streams and support `on('close', ...)`.
  spawn(opts: AdapterSpawnOptions): ChildProcessWithoutNullStreams;

  // Optional: discover available model ids for this provider (best-effort).
  // Implementations should return an array of model id strings or an empty
  // array when discovery is not possible.
  discoverModels?: () => Promise<string[]>;
}

/**
 * Helper to spawn a local process using the same semantics used in the repo.
 * This is provided for convenience in adapter implementations.
 */
export function spawnLocal(command: string, args: string[], opts: AdapterSpawnOptions) {
  return spawn(command, args, {
    cwd: opts.cwd,
    env: opts.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

export function commandExists(command: string): boolean {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  try {
    execFileSync(probe, [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getClaudeSettingsFiles(): string[] {
  const cwd = process.cwd();
  return [
    resolve(cwd, '.claude/settings.json'),
    resolve(cwd, 'pipeline/.claude/settings.json'),
    join(homedir(), '.claude/settings.json'),
  ];
}

export function collectConfiguredModelIds(): string[] {
  const found = new Set<string>();

  const addValue = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) found.add(value.trim());
  };

  const addArray = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const item of value) addValue(item);
  };

  const addObjectKeys = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    for (const key of Object.keys(value as Record<string, unknown>)) addValue(key);
  };

  const addObjectValues = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    for (const item of Object.values(value as Record<string, unknown>)) addValue(item);
  };

  for (const filePath of getClaudeSettingsFiles()) {
    const settings = readJsonFile(filePath);
    if (!settings) continue;
    addValue(settings.model);
    addArray(settings.availableModels);
    addObjectKeys(settings.modelOverrides);
    addObjectKeys(settings.agentModels);
    addObjectValues(settings.agentRouting);

    const envBlock = settings.env;
    if (envBlock && typeof envBlock === 'object' && !Array.isArray(envBlock)) {
      const env = envBlock as Record<string, unknown>;
      for (const key of [
        'ANTHROPIC_MODEL',
        'ANTHROPIC_DEFAULT_OPUS_MODEL',
        'ANTHROPIC_DEFAULT_SONNET_MODEL',
        'ANTHROPIC_DEFAULT_HAIKU_MODEL',
        'OPENAI_MODEL',
      ]) {
        addValue(env[key]);
      }
    }
  }

  for (const key of [
    'ANTHROPIC_MODEL',
    'ANTHROPIC_DEFAULT_OPUS_MODEL',
    'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    'OPENAI_MODEL',
    'LM_STUDIO_MODEL',
  ]) {
    addValue(process.env[key]);
  }

  return Array.from(found).sort();
}

/**
 * Convert a raw model identifier to its most human-readable form.
 *
 * Bedrock ARNs like:
 *   arn:aws:bedrock:us-east-1:012345:inference-profile/global.anthropic.claude-sonnet-4-6
 * are reduced to just:
 *   claude-sonnet-4-6
 *
 * Plain model IDs (e.g. "claude-opus-4-6", "gpt-4o") are returned unchanged.
 * Prefixed IDs ("anthropic.claude-3-5", "global.anthropic.claude-sonnet-4-6")
 * have their prefix stripped.
 */
export function normalizeModelId(id: string): string {
  const lower = id.toLowerCase();

  // Full Bedrock ARN  →  extract model short name from the trailing segment
  if (lower.startsWith('arn:aws:bedrock:')) {
    const arnMatch = id.match(
      /(?:inference-profile|foundation-model|application-inference-profile)\/(?:global\.|us\.|eu\.|ap\.)?anthropic\.(claude[-\w]+)/i,
    );
    if (arnMatch) return arnMatch[1];
    // Fallback: last path segment after last '/' that contains 'claude'
    const segments = id.split('/');
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      const dotIdx = seg.lastIndexOf('.');
      if (dotIdx >= 0 && /claude/i.test(seg)) return seg.slice(dotIdx + 1);
      if (/claude/i.test(seg)) return seg;
    }
  }

  // Dot-prefixed IDs like "global.anthropic.claude-sonnet-4-6" or "anthropic.claude-3-5"
  if (/^(?:global\.|us\.|eu\.|ap\.)?anthropic\.(claude[-\w]+)/i.test(id)) {
    return id.replace(/^(?:global\.|us\.|eu\.|ap\.)?anthropic\./i, '');
  }

  return id;
}

/**
 * Normalize and deduplicate a collection of model IDs.
 * Any Bedrock ARNs or dot-prefixed IDs are converted to their short form,
 * then the set is deduplicated (keeping only one entry per unique short name).
 */
export function normalizeModelIds(ids: Iterable<string>): string[] {
  const seen = new Set<string>();
  for (const raw of ids) {
    const normalized = normalizeModelId(raw);
    if (normalized) seen.add(normalized);
  }
  return Array.from(seen).sort();
}

export function extractLikelyModelIds(text: string): string[] {
  const found = new Set<string>();
  const tokens = text.match(/[A-Za-z0-9:./_\-]{2,}/g) || [];

  for (const rawToken of tokens) {
    const token = rawToken
      .trim()
      .replace(/^[^A-Za-z0-9]+/, '')
      .replace(/[^A-Za-z0-9:_./-]+$/, '');

    if (!token) continue;
    if (/^(open-claude-code|openclaude|claude-code|models?|list-models)$/i.test(token)) continue;
    if (/^[a-z]{2}-[a-z]+-\d$/i.test(token)) continue; // region names like us-east-1
    if (/^1mopen-claude-code$/i.test(token)) continue;

    const lower = token.toLowerCase();
    const alias = /^(opus|sonnet|haiku)$/i.test(token);
    const hasKnownPrefix =
      lower.startsWith('bedrock/') ||
      lower.startsWith('anthropic.') ||
      lower.startsWith('global.anthropic.') ||
      lower.startsWith('us.anthropic.') ||
      lower.startsWith('arn:aws:bedrock:');
    const includesKnownModelMarker = /(claude|gpt|gemini|llama|mistral|qwen|deepseek)/i.test(token);
    const hasUnexpectedSlash = token.includes('/') && !hasKnownPrefix;
    const looksLikePlainModelId = includesKnownModelMarker && !hasUnexpectedSlash;
    const looksLikeBedrockArn = lower.startsWith('arn:aws:bedrock:') && /(claude|inference-profile\/.+claude|application-inference-profile\/.+claude|foundation-model\/.+claude)/i.test(token);

    if (alias || looksLikeBedrockArn || lower.startsWith('bedrock/') || lower.startsWith('anthropic.') || lower.startsWith('global.anthropic.') || lower.startsWith('us.anthropic.') || looksLikePlainModelId) {
      found.add(token);
    }
  }

  return Array.from(found).sort();
}

/**
 * Best-effort helper to run a command and capture its stdout until it exits
 * or the optional timeout elapses. This is intentionally forgiving: adapters
 * should not fail hard when discovery cannot be performed.
 */
export async function captureCommandOutput(
  command: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number }
): Promise<string> {
  try {
    const proc = spawn(command, args, {
      cwd: opts?.cwd,
      env: opts?.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    if (proc.stdout) {
      proc.stdout.setEncoding('utf8');
      proc.stdout.on('data', (c) => { out += String(c); });
    }
    if (proc.stderr) {
      proc.stderr.setEncoding('utf8');
      proc.stderr.on('data', () => { /* ignore stderr during discovery */ });
    }

    return await new Promise((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        resolve(out);
      };
      proc.on('error', done);
      proc.on('close', done);
      if (opts?.timeoutMs) {
        setTimeout(() => {
          if (!finished) {
            try { proc.kill(); } catch {}
            done();
          }
        }, opts.timeoutMs);
      }
    });
  } catch {
    return '';
  }
}
