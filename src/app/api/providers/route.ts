import { NextResponse } from 'next/server';
import getModelAdapter from '@/lib/modelAdapters';

const KNOWN_PROVIDERS = [
  { id: 'claude-cli', label: 'Claude Code CLI' },
  { id: 'ccr', label: 'Claude Code Router (ccr)' },
  { id: 'occ', label: 'Open Claude Code (occ)' },
  { id: 'openclaude', label: 'OpenClaude' },
  { id: 'ollama', label: 'Ollama (local LLM)' },
  { id: 'lm-studio', label: 'LM Studio' },
  { id: 'openwebui', label: 'Open WebUI' },
  { id: 'openai-compat', label: 'OpenAI-Compatible Endpoint' },
  { id: 'openai-http', label: 'OpenAI (HTTP)' },
];

const PROVIDER_SUPPORT: Record<string, {
  suggestion: string;
  diagnosticScript?: string;
  fixScript?: string;
  helpHref: string;
}> = {
  'claude-cli': {
    suggestion: 'Make sure the `claude` CLI is on PATH and authenticated in the same shell/environment used to run Next.js.',
    diagnosticScript: 'diagnose-providers.sh',
    helpHref: '/provider-help',
  },
  ccr: {
    suggestion: 'Check ~/.claude-code-router/config.json. Non-Anthropic local model ids must be mapped to a provider host or CCR will reject them before a request is routed.',
    diagnosticScript: 'diag-ccr.sh',
    fixScript: 'fix-ccr.sh',
    helpHref: '/provider-help',
  },
  occ: {
    suggestion: 'Install `occ` (or ensure `npx @ruvnet/open-claude-code` works) and verify any Bedrock/AWS credentials are visible to the dev server process.',
    diagnosticScript: 'diag-openclaude.sh',
    fixScript: 'fix-occ.sh',
    helpHref: '/provider-help',
  },
  openclaude: {
    suggestion: 'Install `openclaude` (or ensure `npx @gitlawb/openclaude` works) and check ~/.openclaude/config.json if you expect local/remote provider routing.',
    diagnosticScript: 'diag-openclaude.sh',
    fixScript: 'fix-openclaude.sh',
    helpHref: '/provider-help',
  },
  ollama: {
    suggestion: 'Start the Ollama daemon and confirm /api/tags responds. If Ollama runs remotely, save the host/port in Endpoint Config.',
    diagnosticScript: 'diag-ollama.sh',
    fixScript: 'fix-ollama.sh',
    helpHref: '/provider-help',
  },
  'lm-studio': {
    suggestion: 'Start the LM Studio server and confirm /api/v1/models or /v1/models responds. If it runs on another machine, save that host/port in Endpoint Config.',
    diagnosticScript: 'diag-lm-studio.sh',
    fixScript: 'fix-lm-studio.sh',
    helpHref: '/provider-help',
  },
  openwebui: {
    suggestion: 'Save the Open WebUI host/API key in Endpoint Config and verify /api/models responds.',
    diagnosticScript: 'diagnose-providers.sh',
    fixScript: 'fix-openwebui.sh',
    helpHref: '/provider-help',
  },
  'openai-compat': {
    suggestion: 'Save the OpenAI-compatible base URL and optional API key in Endpoint Config. This provider discovers via /v1/models and executes through the HTTP shim.',
    diagnosticScript: 'diagnose-providers.sh',
    fixScript: 'fix-openai-compat.sh',
    helpHref: '/provider-help',
  },
  'openai-http': {
    suggestion: 'Save the OpenAI/OpenAI-compatible base URL and API key in Endpoint Config or export OPENAI_BASE_URL / OPENAI_API_KEY. This adapter now reads provider-config.json too.',
    diagnosticScript: 'diagnose-providers.sh',
    fixScript: 'fix-openai-http.sh',
    helpHref: '/provider-help',
  },
};

export async function GET() {
  try {
    const providers = KNOWN_PROVIDERS.map((p) => {
      const adapter = getModelAdapter(p.id);
      let installedOrConfigured = false;
      let executable = false;
      let reason: string | undefined;
      try {
        if (!adapter) {
          installedOrConfigured = false;
          executable = false;
          reason = 'Provider adapter not implemented in this build.';
        } else {
          installedOrConfigured = Boolean(adapter.isAvailable && adapter.isAvailable());
          try {
            executable = typeof adapter.supportsExecution !== 'function' || adapter.supportsExecution() !== false;
          } catch {
            executable = false;
          }
          if (!installedOrConfigured) {
            reason = p.id === 'occ'
              ? 'Open Claude Code is installed only if `occ`/`npx` exists AND Anthropic or AWS/Bedrock credentials are visible to the dev server process.'
              : 'CLI missing or endpoint unreachable.';
          }
          if (installedOrConfigured && !executable) reason = 'Provider is discoverable but does not support executable runner sessions.';
        }
      } catch (err) {
        installedOrConfigured = false;
        executable = false;
        reason = String(err instanceof Error ? err.message : err);
      }
      const support = PROVIDER_SUPPORT[p.id] || {
        suggestion: 'Check the provider CLI or endpoint configuration, then retry model discovery.',
        diagnosticScript: 'diagnose-providers.sh',
        helpHref: '/provider-help',
      };
      return {
        id: p.id,
        label: p.label,
        available: installedOrConfigured && executable,
        installedOrConfigured,
        executable,
        reason,
        suggestion: support.suggestion,
        diagnosticScript: support.diagnosticScript,
        fixScript: support.fixScript,
        helpHref: support.helpHref,
      };
    });

    return NextResponse.json({ providers });
  } catch (err) {
    return NextResponse.json({ providers: KNOWN_PROVIDERS.map(p => ({ id: p.id, label: p.label, available: false, installedOrConfigured: false, executable: false, helpHref: '/provider-help' })), error: String(err) }, { status: 500 });
  }
}
