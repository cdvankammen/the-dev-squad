import { NextRequest, NextResponse } from 'next/server';
import { resumePipelineRun } from '@/lib/pipeline-control';
import { authorizeLocalOrTokenRequest } from '@/lib/skill-runtime';

export async function POST(req: NextRequest) {
  const auth = authorizeLocalOrTokenRequest(req, 'resume pipeline endpoint');
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message || 'Unauthorized' }, { status: 401 });
  }

  let requestedProjectDir = '';
  try {
    const body = await req.json();
    requestedProjectDir = typeof body?.projectDir === 'string' ? body.projectDir : '';
  } catch {}

  const result = resumePipelineRun(requestedProjectDir || undefined);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Could not resume pipeline' });
  }
  return NextResponse.json(result);
}
