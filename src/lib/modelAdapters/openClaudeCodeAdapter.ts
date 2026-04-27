import { ModelAdapter, AdapterSpawnOptions, spawnLocal, captureCommandOutput, collectConfiguredModelIds, commandExists, normalizeModelIds } from './ModelAdapter';

/** Adapter for ruvnet/open-claude-code (occ) */
export class OpenClaudeCodeAdapter implements ModelAdapter {
  isAvailable(): boolean {
    return commandExists('occ') || commandExists('npx');
  }

  supportsExecution(): boolean {
    return true;
  }

  spawn(opts: AdapterSpawnOptions) {
    if (commandExists('occ')) {
      return spawnLocal('occ', opts.args || [], opts);
    }
    if (commandExists('npx')) {
      return spawnLocal('npx', ['@ruvnet/open-claude-code', ...(opts.args || [])], opts);
    }
    throw new Error('Neither `occ` nor `npx` is available for open-claude-code.');
  }

  async discoverModels(): Promise<string[]> {
    const found = new Set<string>(collectConfiguredModelIds());

    // occ (open-claude-code) launches an interactive REPL when called without a
    // structured sub-command, so we cannot use the pattern of multiple CLI probes.
    // Instead we run it ONCE with no arguments: stdin is closed (ignored) so it
    // reads EOF and exits after printing a short startup banner.  We extract the
    // configured Bedrock model from that banner and convert the ARN to a readable
    // claude model ID.
    try {
      const banner = await captureCommandOutput('occ', [], { timeoutMs: 4000 });
      if (banner) {
        const arnMatch = banner.match(/(arn:aws:bedrock:[^\s|]+)/i);
        if (arnMatch) {
          const arn = arnMatch[1];
          // Turn  "...inference-profile/global.anthropic.claude-sonnet-4-6"  → "claude-sonnet-4-6"
          const modelMatch = arn.match(/(?:anthropic\.|global\.anthropic\.)(claude[-\w]+)/i);
          if (modelMatch) found.add(modelMatch[1]);
        }
      }
    } catch { /* occ not on PATH */ }

    // Check environment variables that occ / Bedrock may use for model selection.
    for (const key of ['ANTHROPIC_BEDROCK_MODEL', 'AWS_BEDROCK_MODEL', 'OCC_MODEL']) {
      const val = process.env[key];
      if (typeof val === 'string' && val.trim()) {
        // If the env var is an ARN, extract the readable name instead of the raw ARN.
        const arnMatch = val.trim().match(/(?:anthropic\.|global\.anthropic\.)(claude[-\w]+)/i);
        found.add(arnMatch ? arnMatch[1] : val.trim());
      }
    }

    // Always include the standard Bedrock-available claude models so the dropdown
    // is never empty.
    for (const m of ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5']) {
      found.add(m);
    }

    // Normalise: convert any Bedrock ARNs / dot-prefixed IDs to short names.
    return normalizeModelIds(found);
  }
}

export default OpenClaudeCodeAdapter;
