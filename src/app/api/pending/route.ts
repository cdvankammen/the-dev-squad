import { NextRequest, NextResponse } from 'next/server';
import { findLatestPendingApproval } from '@/lib/pipeline-approval';
import { authorizeLocalOrTokenRequest } from '@/lib/skill-runtime';

export async function GET(req: NextRequest) {
  const auth = authorizeLocalOrTokenRequest(req, 'pending approval endpoint');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message || 'Unauthorized' }, { status: 401 });
  }

  const latest = findLatestPendingApproval();
  return NextResponse.json(latest?.pending ?? null);
}
