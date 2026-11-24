import { NextResponse } from 'next/server';
import type { AuditResult } from '@/lib/types';
import { listGuestAudits, deleteGuest, listOwnerAudits } from '@/lib/store';

export const dynamic = 'force-dynamic';

function buildMarkdown(audits: AuditResult[]): string {
  if (!audits.length) return '# Self-Audit Report\n\n(no results)\n';
  const a = audits[0];
  const lines = [
    `# Self-Audit Report — ${a.device.id} (${a.device.address ?? ''})`,
    `Generated ${new Date().toISOString()}  ·  engines: ${a.engines.join(', ')}`,
    '',
    '## Summary',
    `${a.summary.critical} critical, ${a.summary.high} high, ${a.summary.medium} medium, ${a.summary.low} low`,
    '',
    '## Findings',
    ...a.findings.map(
      (f) => `- [${f.severity}] ${f.title}${f.cve ? ' (' + f.cve + ')' : ''}\n  source: ${f.source}${f.remediation ? '\n  fix: ' + f.remediation : ''}`,
    ),
  ];
  return lines.join('\n') + '\n';
}

// Guest export (?session=...) returns the data AND deletes the session —
// export-and-delete. Owner export (Bearer AGENT_TOKEN) returns history and
// keeps it. ?format=md returns markdown, otherwise JSON.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = url.searchParams.get('session');
  const format = url.searchParams.get('format') || 'json';

  if (session) {
    const audits = await listGuestAudits(session);
    await deleteGuest(session); // delete on export
    if (format === 'md') {
      return new NextResponse(buildMarkdown(audits), {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="self-audit.md"' },
      });
    }
    return NextResponse.json({ audits, deleted: true });
  }

  const expected = process.env.AGENT_TOKEN;
  if (expected && (req.headers.get('authorization') || '') === `Bearer ${expected}`) {
    const audits = await listOwnerAudits();
    if (format === 'md') {
      return new NextResponse(buildMarkdown(audits), {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="self-audit.md"' },
      });
    }
    return NextResponse.json({ audits });
  }

  return NextResponse.json({ error: 'provide ?session=<id> (guest) or Authorization: Bearer <AGENT_TOKEN> (owner)' }, { status: 400 });
}
