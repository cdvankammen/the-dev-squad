import { NextResponse } from 'next/server';
import getModelAdapter from '@/lib/modelAdapters';

export async function GET() {
  try {
    // Quick health response plus simple adapter availability summary
    const providers = ['occ', 'openclaude', 'claude-cli', 'openai-http'].map((id) => {
      const adapter = getModelAdapter(id);
      let available = false;
      try { available = !!adapter && adapter.isAvailable(); } catch { available = false; }
      return { id, available };
    });

    return NextResponse.json({ ok: true, time: new Date().toISOString(), providers });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
