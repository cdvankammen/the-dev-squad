import { NextRequest, NextResponse } from 'next/server';
import { setStopAfterReview } from '@/lib/pipeline-control';
import { authorizeLocalOrTokenRequest } from '@/lib/skill-runtime';

export async function POST(req: NextRequest) {
  const auth = authorizeLocalOrTokenRequest(req, 'pipeline control endpoint');
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message || 'Unauthorized' }, { status: 401 });
  }

  let action = '';
  try {
    const body = await req.json();
    action = typeof body?.action === 'string' ? body.action : '';
  } catch {}

  if (action !== 'stop-after-review' && action !== 'clear-stop-after-review') {
    return NextResponse.json({ success: false, error: 'Unsupported pipeline control action' });
  }

  const result = setStopAfterReview(action === 'stop-after-review');
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Could not update pipeline control' });
  }
  return NextResponse.json(result);
}
