import { NextResponse } from 'next/server';
import { newSessionId, GUEST_TTL_SECONDS } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Mint a guest session id. The agent sends it as the X-Session-Id header when
// POSTing results; the session's data is isolated and expires after 1 hour.
export async function POST() {
  return NextResponse.json({ session: newSessionId(), expires_in: GUEST_TTL_SECONDS }, { status: 201 });
}
