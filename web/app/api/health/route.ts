import { NextResponse } from 'next/server';
import { pingStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Returns { backend: "upstash" | "memory", ok, error? }. Always 200 so the
// body is readable; `ok` reflects whether a live store round-trip succeeded.
export async function GET() {
  return NextResponse.json(await pingStore());
}
