import { NextResponse } from 'next/server';
import type { AuditResult } from '@/lib/types';
import { sampleAudits } from '@/lib/sample';

// In-memory store. NOTE: on Vercel this does not persist across invocations or
// cold starts — swap for Vercel KV / Postgres for durable storage. Good enough
// to wire up the agent end-to-end.
const store: AuditResult[] = [];

export async function GET() {
  const audits = store.length ? store : sampleAudits;
  return NextResponse.json({ audits, sample: store.length === 0 });
}

export async function POST(req: Request) {
  const expected = process.env.AGENT_TOKEN;
  if (expected) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const r = body as Partial<AuditResult>;
  if (!r || !r.device || !r.device.id || !Array.isArray(r.findings) || !r.summary) {
    return NextResponse.json({ error: 'missing required fields (device.id, findings, summary)' }, { status: 422 });
  }
  store.unshift(r as AuditResult);
  return NextResponse.json({ ok: true, stored: store.length }, { status: 201 });
}
