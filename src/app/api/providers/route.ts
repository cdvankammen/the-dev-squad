import { NextResponse } from 'next/server';
import getModelAdapter from '@/lib/modelAdapters';

const KNOWN_PROVIDERS = [
  { id: 'claude-cli', label: 'Claude Code CLI' },
  { id: 'ccr', label: 'Claude Code Router (ccr)' },
  { id: 'occ', label: 'Open Claude Code (occ)' },
  { id: 'openclaude', label: 'OpenClaude' },
  { id: 'ollama', label: 'Ollama (local LLM)' },
  { id: 'lm-studio', label: 'LM Studio / OpenAI-compatible' },
  { id: 'openai-http', label: 'OpenAI (HTTP)' },
];

export async function GET() {
  try {
    const providers = KNOWN_PROVIDERS.map((p) => {
      const adapter = getModelAdapter(p.id);
      let installedOrConfigured = false;
      let executable = false;
      try {
        installedOrConfigured = !!adapter && adapter.isAvailable();
        executable = !!adapter && (typeof adapter.supportsExecution !== 'function' || adapter.supportsExecution() !== false);
      } catch {
        installedOrConfigured = false;
        executable = false;
      }
      return {
        id: p.id,
        label: p.label,
        available: installedOrConfigured && executable,
        installedOrConfigured,
        executable,
        note: !executable
          ? 'Provider is discoverable but does not support executable runner sessions.'
          : undefined,
      };
    });

    return NextResponse.json({ providers });
  } catch (err) {
    return NextResponse.json({ providers: KNOWN_PROVIDERS.map(p => ({ id: p.id, label: p.label, available: false, installedOrConfigured: false, executable: false })), error: String(err) }, { status: 500 });
  }
}
