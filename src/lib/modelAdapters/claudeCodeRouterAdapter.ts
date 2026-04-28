import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  AdapterSpawnOptions,
  captureCommandOutput,
  collectConfiguredModelIds,
  commandExists,
  extractLikelyModelIds,
  ModelAdapter,
  normalizeModelIds,
  resolveWorkspacePath,
  spawnLocal,
} from './ModelAdapter';

/** Test whether a model name looks like an Anthropic model (full ID or shorthand). */
function isAnthropicModelName(model: string): boolean {
  const m = model.toLowerCase();
  if (/^claude[-_]/.test(m)) return true;
  // Common shorthands the UI may pass (e.g. "haiku", "sonnet", "opus")
  return ['haiku', 'sonnet', 'opus'].some((s) => m.includes(s));
}

/**
 * Look up the CCR provider that serves a given model name.
 * Returns the provider's OpenAI-compatible base URL and API key,
 * or null if the model isn't found in any provider.
 *
 * When `preferredHost` is supplied, providers matching that host are
 * returned first.  This lets the UI pass the user's host selection to
 * disambiguate when the same model appears in multiple providers.
 */
function findCcrProviderForModel(
  model: string,
  preferredHost?: string,
): { name: string; baseUrl: string; apiKey: string } | null {
  const configPath = join(homedir(), '.claude-code-router', 'config.json');
  if (!existsSync(configPath)) return null;
  try {
    const raw = readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw) as {
      Providers?: Array<{
        name?: string;
        api_base_url?: string;
        api_key?: string;
        models?: string[];
      }>;
    };
    if (!Array.isArray(config.Providers)) return null;

    // Collect all matches
    const matches: { name: string; baseUrl: string; apiKey: string; host: string }[] = [];
    for (const p of config.Providers) {
      if (Array.isArray(p.models) && p.models.includes(model)) {
        let baseUrl = (p.api_base_url || '').replace(/\/chat\/completions\/?$/, '');
        if (!baseUrl) continue;
        let host = '';
        try { host = new URL(p.api_base_url || '').hostname; } catch { /* */ }
        matches.push({
          name: p.name || 'unknown',
          baseUrl,
          apiKey: p.api_key || '',
          host,
        });
      }
    }

    if (matches.length === 0) return null;

    // If a preferred host was specified, prefer matches on that host
    if (preferredHost) {
      const preferred = matches.find((m) =>
        m.host === preferredHost ||
        m.name === preferredHost ||
        m.host.includes(preferredHost)
      );
      if (preferred) return preferred;
    }

    return matches[0];
  } catch {
    return null;
  }
}

/**
 * Read the Router's "default" route from CCR config and resolve it to a
 * provider endpoint + model name.  The route format is "providerName,modelId".
 * Used as a last-resort fallback when a requested model is not found in any
 * provider's model list.
 */
function readCcrRouterDefault(): { name: string; baseUrl: string; apiKey: string; model: string } | null {
  const configPath = join(homedir(), '.claude-code-router', 'config.json');
  if (!existsSync(configPath)) return null;
  try {
    const raw = readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw) as {
      Providers?: Array<{ name?: string; api_base_url?: string; api_key?: string }>;
      Router?: Record<string, string>;
    };
    const defaultRoute = config.Router?.default;
    if (!defaultRoute || !defaultRoute.includes(',')) return null;
    const [provName, ...modelParts] = defaultRoute.split(',');
    const modelId = modelParts.join(',').trim();
    const provider = config.Providers?.find((p) => p.name === provName.trim());
    if (!provider?.api_base_url) return null;
    const baseUrl = provider.api_base_url.replace(/\/chat\/completions\/?$/, '');
    return { name: provider.name || provName.trim(), baseUrl, apiKey: provider.api_key || '', model: modelId };
  } catch {
    return null;
  }
}

/**
 * Read models directly from CCR's config.json — the most reliable source.
 * CCR stores provider configs under ~/.claude-code-router/config.json.
 * Shape: { Providers: [{ name: string, models: string[] }, ...] }
 */
function readCcrConfigModels(): string[] {
  const configPath = join(homedir(), '.claude-code-router', 'config.json');
  if (!existsSync(configPath)) return [];
  try {
    const raw = readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw) as {
      Providers?: Array<{ name?: string; models?: string[] }>;
      Router?: Record<string, string>;
    };
    const found = new Set<string>();

    // Collect all model ids listed under each provider
    if (Array.isArray(config.Providers)) {
      for (const p of config.Providers) {
        if (Array.isArray(p.models)) {
          for (const m of p.models) {
            if (typeof m === 'string' && m.trim()) found.add(m.trim());
          }
        }
      }
    }

    // Also extract model names referenced by the Router routes (e.g. "lmstudio,model-name")
    if (config.Router && typeof config.Router === 'object') {
      for (const route of Object.values(config.Router)) {
        if (typeof route === 'string') {
          const parts = route.split(',');
          if (parts.length >= 2) {
            const modelPart = parts.slice(1).join(',').trim();
            if (modelPart) found.add(modelPart);
          }
        }
      }
    }

    return Array.from(found).sort();
  } catch {
    return [];
  }
}

/** Enriched model info with provider/host details for UI display */
export interface CcrModelInfo {
  model: string;
  provider: string;
  host: string;
  port: string;
  /** Human-readable label: "model (host:port)" */
  label: string;
}

/**
 * Read models from CCR config with provider and host info.
 * Returns enriched entries that let the UI distinguish identical model names
 * served from different hosts (e.g. localhost vs proxmox).
 */
function readCcrConfigModelsWithHosts(): CcrModelInfo[] {
  const configPath = join(homedir(), '.claude-code-router', 'config.json');
  if (!existsSync(configPath)) return [];
  try {
    const raw = readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw) as {
      Providers?: Array<{ name?: string; api_base_url?: string; models?: string[] }>;
    };
    if (!Array.isArray(config.Providers)) return [];

    const results: CcrModelInfo[] = [];
    for (const p of config.Providers) {
      if (!Array.isArray(p.models) || !p.api_base_url) continue;
      // Parse host/port from the api_base_url
      let host = 'unknown';
      let port = '';
      try {
        const u = new URL(p.api_base_url);
        host = u.hostname;
        port = u.port;
      } catch { /* ignore */ }

      // Friendly host alias
      const hostAlias = host === '127.0.0.1' || host === 'localhost'
        ? 'localhost'
        : host === '10.2.0.90' ? 'proxmox' : host;

      for (const m of p.models) {
        if (typeof m !== 'string' || !m.trim()) continue;
        const label = port
          ? `${m.trim()} (${hostAlias}:${port})`
          : `${m.trim()} (${hostAlias})`;
        results.push({
          model: m.trim(),
          provider: p.name || 'unknown',
          host,
          port,
          label,
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

/** Adapter for Claude Code Router (`ccr`) wrapper CLI */
export class ClaudeCodeRouterAdapter implements ModelAdapter {
  private resolveCommand(): string | null {
    if (process.env.CCR_BIN && process.env.CCR_BIN.trim()) {
      return process.env.CCR_BIN.trim();
    }
    if (commandExists('ccr')) return 'ccr';
    return null;
  }

  isAvailable(): boolean {
    return Boolean(this.resolveCommand());
  }

  supportsExecution(): boolean {
    return true;
  }

  spawn(opts: AdapterSpawnOptions) {
    const cmd = this.resolveCommand();
    if (!cmd) {
      throw new Error('`ccr` was not found on PATH. Install/configure Claude Code Router first.');
    }

    const args = [...(opts.args || [])];

    // ── Local-model bypass ──────────────────────────────────────────────
    // Claude Code CLI (which `ccr code` wraps) validates model names
    // client-side and rejects non-Anthropic identifiers like
    // "llama3.2:latest" before any network request is made.
    //
    // When the user selects a local model via CCR, we bypass `ccr code`
    // entirely and spawn the http-runner-shim pointed directly at the
    // underlying provider's OpenAI-compatible endpoint.  This leverages
    // the upgraded multi-turn agent loop in the shim, giving local models
    // full tool-calling support.
    const modelIdx = args.indexOf('--model');
    if (modelIdx >= 0 && modelIdx + 1 < args.length) {
      const requestedModel = args[modelIdx + 1];
      if (!isAnthropicModelName(requestedModel)) {
        // First: check if the model is listed in any CCR provider
        const providerInfo = findCcrProviderForModel(requestedModel);
        if (providerInfo) {
          return this.spawnViaHttpShim(opts, args, providerInfo);
        }
        // Second: fall back to CCR Router's default route so the user still
        // gets a working local model instead of a hard failure.
        const routerDefault = readCcrRouterDefault();
        if (routerDefault) {
          console.warn(
            `[CCR] Model "${requestedModel}" not found in provider configs; ` +
            `using Router default → ${routerDefault.name}/${routerDefault.model}`
          );
          // Replace the model name in args with the Router's default model
          args[modelIdx + 1] = routerDefault.model;
          return this.spawnViaHttpShim(opts, args, routerDefault);
        }
        console.warn(
          `[CCR] Local model "${requestedModel}" not found in any CCR provider config and no Router default; ` +
          `falling through to ccr code (will likely fail due to model validation).`
        );
      }
    }
    // ────────────────────────────────────────────────────────────────────

    // ccr requires --verbose whenever stream-json is requested.
    const outIdx = args.indexOf('--output-format');
    if (outIdx >= 0 && args[outIdx + 1] === 'stream-json' && !args.includes('--verbose')) {
      args.splice(outIdx, 0, '--verbose');
    }

    // In `ccr code --print` mode, passing the prompt via stdin is more reliable
    // than positional argv forwarding. Only extract a trailing prompt when the
    // args do not already include an explicit prompt flag (e.g. -p / --system-prompt).
    let promptFromArgs: string | null = null;
    const hasExplicitPromptFlag = args.includes('-p') || args.includes('--prompt') || args.includes('--system-prompt') || args.includes('--system-prompt-file');
    if (!hasExplicitPromptFlag && args.length > 0) {
      const last = args[args.length - 1];
      if (typeof last === 'string' && !last.startsWith('-')) {
        promptFromArgs = last;
        args.pop();
      }
    }

    const child = spawnLocal(cmd, ['code', ...args], opts);
    if (promptFromArgs && child.stdin) {
      child.stdin.write(`${promptFromArgs}\n`);
      child.stdin.end();
    }
    return child;
  }

  /**
   * Spawn the http-runner-shim pointed at a specific CCR provider's endpoint.
   * Used when the selected model is a local model that would fail validation
   * in Claude Code CLI.
   */
  private spawnViaHttpShim(
    opts: AdapterSpawnOptions,
    args: string[],
    provider: { name: string; baseUrl: string; apiKey: string },
  ) {
    const shimPath = resolveWorkspacePath('scripts', 'http-runner-shim.mjs');

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...opts.env,
      MODEL_PROVIDER: `ccr:${provider.name}`,
      OPENAI_BASE_URL: provider.baseUrl,
      OPENAI_API_KEY: provider.apiKey || 'ccr',
    };

    return spawnLocal(
      process.execPath,
      [shimPath, '--provider', `ccr:${provider.name}`, ...args],
      { cwd: opts.cwd, env, args },
    );
  }

  async discoverModels(): Promise<string[]> {
    const cmd = this.resolveCommand();
    // Seed with any models declared in claude settings / env — normalize away Bedrock ARNs.
    const found = new Set<string>(normalizeModelIds(collectConfiguredModelIds()));

    // Primary: read CCR's config.json directly — this is the most reliable source
    // because CCR does not expose a machine-readable --list-models CLI flag.
    const configModels = readCcrConfigModels();
    for (const m of configModels) found.add(m);

    // If config provided models, return early — no need to call the CLI.
    if (configModels.length > 0) {
      return Array.from(found).sort();
    }

    // Fallback: try various CLI flags (these rarely work but worth trying)
    if (!cmd) return Array.from(found).sort();

    const tries: string[][] = [
      [cmd, 'model', '--json'],
      [cmd, 'model', 'list', '--json'],
      [cmd, 'model', 'list'],
      [cmd, 'models', '--json'],
      [cmd, 'models'],
      [cmd, 'list-models'],
      [cmd, '--list-models'],
    ];

    for (const t of tries) {
      try {
        const out = await captureCommandOutput(t[0], t.slice(1), { timeoutMs: 2500 });
        if (!out) continue;
        try {
          const parsed = JSON.parse(out);
          if (Array.isArray(parsed)) {
            for (const v of parsed) {
              if (typeof v === 'string') found.add(v);
              if (v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string') {
                found.add((v as { id: string }).id);
              }
            }
            continue;
          }
        } catch {
          // non-json output, parse heuristically
        }

        for (const token of extractLikelyModelIds(out)) found.add(token);
      } catch {
        // try next command
      }
    }

    return Array.from(found).sort();
  }

  /**
   * Discover models with full host/provider metadata.
   * Returns enriched model info for the UI to show host labels.
   */
  async discoverModelsWithHosts(): Promise<CcrModelInfo[]> {
    return readCcrConfigModelsWithHosts();
  }
}

export default ClaudeCodeRouterAdapter;
