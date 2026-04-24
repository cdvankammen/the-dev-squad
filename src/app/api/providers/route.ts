import { NextResponse } from 'next/server';
import getModelAdapter from '@/lib/modelAdapters';

const KNOWN_PROVIDERS = [
  { id: 'occ', label: 'Open Claude Code (occ)' },
  { id: 'openclaude', label: 'OpenClaude' },
  { id: 'claude-cli', label: 'Claude Code CLI' },
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
          ? 'Use openclaude/occ/claude-cli for executable tool sessions. Direct HTTP runner support is not implemented yet.'
          : undefined,
      };
    });

    return NextResponse.json({ providers });
  } catch (err) {
    return NextResponse.json({ providers: KNOWN_PROVIDERS.map(p => ({ id: p.id, label: p.label, available: false, installedOrConfigured: false, executable: false })), error: String(err) }, { status: 500 });
  }
}
