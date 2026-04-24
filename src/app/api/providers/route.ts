import { NextResponse } from 'next/server';
import getModelAdapter from '@/lib/modelAdapters';

const KNOWN_PROVIDERS = [
  { id: 'occ', label: 'Open Claude Code (occ)' },
  { id: 'openclaude', label: 'OpenClaude' },
  { id: 'claude-cli', label: 'Claude Code CLI' },
  { id: 'openai-http', label: 'OpenAI (HTTP)' },
];

export async function GET() {
  try {
    const providers = KNOWN_PROVIDERS.map((p) => {
      const adapter = getModelAdapter(p.id);
      let available = false;
      try { available = !!adapter && adapter.isAvailable(); } catch { available = false; }
      return { id: p.id, label: p.label, available };
    });

    return NextResponse.json({ providers });
  } catch (err) {
    return NextResponse.json({ providers: KNOWN_PROVIDERS.map(p => ({ id: p.id, label: p.label, available: false })), error: String(err) }, { status: 500 });
  }
}
