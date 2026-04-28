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
          if (!installedOrConfigured) reason = 'CLI missing or endpoint unreachable.';
          if (installedOrConfigured && !executable) reason = 'Provider is discoverable but does not support executable runner sessions.';
        }
      } catch (err) {
        installedOrConfigured = false;
        executable = false;
        reason = String(err instanceof Error ? err.message : err);
      }
      return {
        id: p.id,
        label: p.label,
        available: installedOrConfigured && executable,
        installedOrConfigured,
        executable,
        reason,
      };
    });

    return NextResponse.json({ providers });
  } catch (err) {
    return NextResponse.json({ providers: KNOWN_PROVIDERS.map(p => ({ id: p.id, label: p.label, available: false, installedOrConfigured: false, executable: false })), error: String(err) }, { status: 500 });
  }
}
