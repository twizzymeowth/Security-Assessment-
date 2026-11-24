import { NextResponse } from 'next/server';
import type { AuditResult } from '@/lib/types';
import { sampleAudits } from '@/lib/sample';
import { addOwnerAudit, listOwnerAudits, addGuestAudit, listGuestAudits, GUEST_TTL_SECONDS } from '@/lib/store';

export const dynamic = 'force-dynamic';

function validate(b: unknown): b is AuditResult {
  const r = b as { device?: { id?: unknown }; findings?: unknown; summary?: unknown } | null;
  return !!(r && r.device && typeof r.device.id === 'string' && Array.isArray(r.findings) && r.summary);
}

// Owner runs are kept; guests are ephemeral. AGENT_TOKEN is the owner key.
// With no AGENT_TOKEN configured (dev), a run with no session id is treated
// as the owner's, so local testing works without setup.
function ownerAuthed(req: Request): boolean {
  const expected = process.env.AGENT_TOKEN;
  if (!expected) return false;
  return (req.headers.get('authorization') || '') === `Bearer ${expected}`;
}

export async function GET(req: Request) {
  const session = new URL(req.url).searchParams.get('session');
  if (session) {
    return NextResponse.json({ audits: await listGuestAudits(session), scope: 'guest', sample: false });
  }
  if (ownerAuthed(req)) {
    return NextResponse.json({ audits: await listOwnerAudits(), scope: 'owner', sample: false });
  }
  if (!process.env.AGENT_TOKEN) {
    const owner = await listOwnerAudits();
    if (owner.length) return NextResponse.json({ audits: owner, scope: 'owner-dev', sample: false });
  }
  return NextResponse.json({ audits: sampleAudits, scope: 'sample', sample: true });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (!validate(body)) {
    return NextResponse.json({ error: 'missing required fields (device.id, findings, summary)' }, { status: 422 });
  }
  const result = body as AuditResult;

  const expected = process.env.AGENT_TOKEN;
  const session = req.headers.get('x-session-id') || new URL(req.url).searchParams.get('session') || '';
  // owner if the token matches, or (no token configured) a non-session run
  const isOwner = expected ? (req.headers.get('authorization') || '') === `Bearer ${expected}` : !session;

  if (isOwner) {
    await addOwnerAudit(result);
    return NextResponse.json({ ok: true, scope: 'owner' }, { status: 201 });
  }
  if (!session) {
    return NextResponse.json(
      { error: 'guest runs need a session: POST /api/session, then send header X-Session-Id' },
      { status: 401 },
    );
  }
  await addGuestAudit(session, result);
  return NextResponse.json({ ok: true, scope: 'guest', session, expires_in: GUEST_TTL_SECONDS }, { status: 201 });
}
