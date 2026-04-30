import { NextRequest, NextResponse } from 'next/server';
import { stopPipelineRun } from '@/lib/pipeline-control';
import { authorizeLocalOrTokenRequest } from '@/lib/skill-runtime';

export async function POST(req: NextRequest) {
  const auth = authorizeLocalOrTokenRequest(req, 'stop pipeline endpoint');
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message || 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(stopPipelineRun());
}
