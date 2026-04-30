import { NextRequest, NextResponse } from 'next/server';
import { findLatestPendingApproval, updatePendingApproval } from '@/lib/pipeline-approval';
import { authorizeLocalOrTokenRequest } from '@/lib/skill-runtime';

export async function POST(req: NextRequest) {
  const auth = authorizeLocalOrTokenRequest(req, 'approval endpoint');
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message || 'Unauthorized' }, { status: 401 });
  }

  const { approved, requestId, projectDir } = await req.json();
  const latest = findLatestPendingApproval();
  const targetProjectDir = projectDir || latest?.projectDir;

  if (!targetProjectDir) {
    return NextResponse.json({ success: false });
  }

  const success = updatePendingApproval(targetProjectDir, !!approved, requestId);
  return NextResponse.json({ success });
}
