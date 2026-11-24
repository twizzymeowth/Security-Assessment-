'use client';

import { useRef, useState } from 'react';
import type { AuditResult, Severity } from '@/lib/types';
import { sampleAudits } from '@/lib/sample';

const SEV_COLOR: Record<Severity, string> = {
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-600',
  info: 'bg-sky-500',
};

type Engine = 'baseline' | 'openvas' | 'nessus';

const ENGINE_OPTIONS: [Engine, string][] = [
  ['baseline', 'Baseline (nmap + Lynis)'],
  ['openvas', '+ OpenVAS (free)'],
  ['nessus', '+ Nessus (your key)'],
];

const STEPS = [
  { n: 1, label: 'Discovery', tag: 'nmap', desc: 'Open ports, services and versions on this host' },
  { n: 2, label: 'Hardening audit', tag: 'lynis', desc: 'Firewall, SSH, patches and permissions' },
  { n: 3, label: 'Deep CVE scan', tag: 'optional', desc: 'OpenVAS or Nessus — only if you selected one' },
  { n: 4, label: 'Correlate', tag: 'agent', desc: 'Rank findings and attach references' },
  { n: 5, label: 'Checkpoint', tag: 'manual', desc: 'You review and approve before anything runs' },
  { n: 6, label: 'Report', tag: 'export', desc: 'Load the results here, then export' },
];

// Client-side validation against agent/schema.json (required fields + enums).
function validateReport(obj: unknown): { value?: AuditResult; error?: string } {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { error: 'The report must be a JSON object.' };
  const o = obj as Record<string, unknown>;
  const req = ['agent_version', 'device', 'mode', 'engines', 'started_at', 'finished_at', 'findings', 'summary'];
  for (const k of req) if (!(k in o)) return { error: `Missing required field: "${k}".` };
  const device = o.device as Record<string, unknown> | undefined;
  if (!device || typeof device.id !== 'string') return { error: 'device.id (a string) is required.' };
  if (o.mode !== 'audit') return { error: `Invalid mode: "${String(o.mode)}" — this tool is audit-only.` };
  if (!Array.isArray(o.engines)) return { error: 'engines must be an array.' };
  if (!Array.isArray(o.findings)) return { error: 'findings must be an array.' };
  for (const f of o.findings as Record<string, unknown>[]) {
    if (!f || typeof f.id !== 'string' || typeof f.title !== 'string' || typeof f.source !== 'string')
      return { error: 'Each finding needs string id, title and source.' };
    if (!['critical', 'high', 'medium', 'low', 'info'].includes(f.severity as string))
      return { error: `Invalid finding severity: "${String(f.severity)}".` };
  }
  const s = o.summary as Record<string, unknown> | undefined;
  if (!s || ['critical', 'high', 'medium', 'low'].some((k) => typeof s[k] !== 'number'))
    return { error: 'summary needs numeric critical, high, medium and low.' };
  return { value: obj as AuditResult };
}

function buildCommand(engine: Engine): string {
  const parts = ['python3 selfaudit.py --mode audit'];
  if (engine === 'openvas') parts.push('--engine openvas');
  if (engine === 'nessus') parts.push('--engine nessus');
  parts.push('--out selfaudit-report.json');
  return parts.join(' ');
}

const AGENT_URL = 'https://raw.githubusercontent.com/twizzymeowth/Security-Assessment-/main/agent/selfaudit.py';

function buildSetup(engine: Engine): string {
  return [
    '# 1) one-time setup on the device you are auditing',
    'sudo apt install -y nmap lynis',
    `curl -O ${AGENT_URL}`,
    '',
    '# 2) run the read-only self-audit',
    buildCommand(engine),
  ].join('\n');
}

function download(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Page() {
  const [audits, setAudits] = useState<AuditResult[]>(sampleAudits);
  const [isSample, setIsSample] = useState(true);
  const [engine, setEngine] = useState<Engine>('baseline');
  const [approved, setApproved] = useState<string | null>(null);
  const [command, setCommand] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const latest = audits[0];
  const maxSev = Math.max(1, latest.summary.critical, latest.summary.high, latest.summary.medium, latest.summary.low);

  function ingestText(text: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError('That is not valid JSON.');
      return;
    }
    const { value, error: err } = validateReport(parsed);
    if (err || !value) {
      setError(err || 'The report did not match the expected schema.');
      return;
    }
    setAudits([value]);
    setIsSample(false);
    setError(null);
    setShowPaste(false);
    setPasteText('');
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    file.text().then(ingestText).catch(() => setError('Could not read that file.'));
  }

  function loadSample() {
    setAudits(sampleAudits);
    setIsSample(true);
    setError(null);
  }

  function approveAndShow() {
    setApproved(new Date().toLocaleString());
    setCommand(buildSetup(engine));
    setCopied(false);
  }

  return (
    <main className='mx-auto max-w-5xl px-4 py-7'>
      {/* masthead */}
      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div className='min-w-0'>
          <div className='font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400'>
            Runs in your browser · Nothing is uploaded · Benign self-audit
          </div>
          <h1 className='mt-1 text-2xl font-semibold tracking-tight sm:text-3xl'>Self-Audit Dashboard</h1>
          <div className='mt-2 font-mono text-xs text-slate-500 dark:text-slate-400'>
            mode <b className='text-slate-700 dark:text-slate-200'>audit only</b> · engine <b className='text-slate-700 dark:text-slate-200'>{ENGINE_OPTIONS.find(([v]) => v === engine)?.[1]}</b>
          </div>
        </div>
        <span className='inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400'>
          <span className='h-2 w-2 rounded-full bg-emerald-500' />
          {isSample ? 'Example loaded' : 'Report loaded'}
        </span>
      </div>

      {/* run on your device + load results */}
      <section className='mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
        <div className='mb-3 flex items-center justify-between gap-2'>
          <h2 className='flex items-center gap-2 text-sm font-semibold'>
            Run on your device
            <span className='rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400'>manual</span>
          </h2>
          {!isSample && (
            <button onClick={loadSample} className='font-mono text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'>
              reset to example
            </button>
          )}
        </div>

        {/* engine picker */}
        <div className='flex flex-wrap items-center gap-x-6 gap-y-2'>
          <div className='flex items-center gap-2'>
            <span className='font-mono text-[11px] uppercase tracking-wide text-slate-400'>Engine</span>
            <div className='flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700'>
              {ENGINE_OPTIONS.map(([v, lbl]) => (
                <button
                  key={v}
                  onClick={() => {
                    setEngine(v);
                    setCommand(null);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${engine === v ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <p className='min-w-0 flex-1 font-mono text-[11px] text-slate-400'>
            Baseline nmap + Lynis is free and needs no license. OpenVAS/Nessus are optional. Read-only — never exploits.
          </p>
        </div>

        <p className='mt-3 text-sm text-slate-600 dark:text-slate-400'>
          The scan runs on your machine — this page can&apos;t scan it. Approve your options to get the exact commands, run them on the device you&apos;re auditing, then load the results below.
        </p>

        <div className='mt-3 flex flex-wrap items-center gap-2'>
          <button onClick={approveAndShow} className='rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white'>
            {command ? 'Re-approve & regenerate' : 'Approve options & show commands'}
          </button>
          {approved && <span className='font-mono text-[11px] text-emerald-600 dark:text-emerald-400'>approved {approved}</span>}
        </div>

        {command && (
          <div className='mt-3'>
            <div className='font-mono text-[11px] text-slate-400'>
              Run on the device you&apos;re auditing ({ENGINE_OPTIONS.find(([v]) => v === engine)?.[1]}):
            </div>
            <pre className='mt-1 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-200'>{command}</pre>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(command).then(() => setCopied(true)).catch(() => {});
              }}
              className='mt-2 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700'
            >
              {copied ? 'Copied' : 'Copy commands'}
            </button>
          </div>
        )}

        <div className='my-4 border-t border-slate-200 dark:border-slate-800' />

        <div className='mb-2 flex items-center gap-2 text-sm font-semibold'>
          Load the results
          <span className='rounded-full border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-cyan-700 dark:text-cyan-400'>in browser</span>
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`rounded-xl border-2 border-dashed p-4 text-center transition-colors ${dragging ? 'border-cyan-500 bg-cyan-500/5' : 'border-slate-300 dark:border-slate-700'}`}
        >
          <p className='text-sm font-medium'>Drag &amp; drop <code>selfaudit-report.json</code>, or use the buttons</p>
          <p className='mt-1 font-mono text-[11px] text-slate-400'>the file never leaves this page</p>
          <div className='mt-3 flex flex-wrap justify-center gap-2'>
            <button onClick={() => fileRef.current?.click()} className='rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white'>
              Choose file…
            </button>
            <button onClick={() => setShowPaste((v) => !v)} className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700'>
              {showPaste ? 'Hide paste' : 'Paste JSON'}
            </button>
            <input ref={fileRef} type='file' accept='application/json,.json' className='hidden' onChange={(e) => handleFiles(e.target.files)} />
          </div>
        </div>

        {showPaste && (
          <div className='mt-3'>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder='Paste the results JSON here…'
              className='h-36 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-950'
            />
            <div className='mt-2 flex justify-end'>
              <button
                onClick={() => ingestText(pasteText)}
                className='rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50'
                disabled={!pasteText.trim()}
              >
                Load pasted JSON
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className='mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 font-mono text-[11px] text-red-700 dark:text-red-400'>{error}</div>
        )}
        {isSample && !error && (
          <div className='mt-3 inline-block rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono text-[11px] text-amber-700 dark:text-amber-400'>
            Showing example data — run a scan and load the results to see your own
          </div>
        )}
      </section>

      <div className='mt-5 grid gap-4 md:grid-cols-[1.5fr_1fr]'>
        {/* main column */}
        <div className='space-y-4'>
          <Card title='Results' badge='this report' badgeTone='cyan' hint={`${latest.findings.length} findings`}>
            {latest.findings.length === 0 ? (
              <p className='text-sm text-slate-500 dark:text-slate-400'>No findings in this report.</p>
            ) : (
              <div className='max-h-96 space-y-0 overflow-y-auto'>
                {latest.findings.map((f) => (
                  <div key={f.id} className='border-t border-slate-200 py-3 first:border-0 first:pt-0 dark:border-slate-800'>
                    <div className='flex items-center gap-2'>
                      <span className={`h-2.5 w-2.5 rounded-full ${SEV_COLOR[f.severity]}`} />
                      <span className='text-sm font-semibold'>{f.title}</span>
                      {f.cve && <span className='font-mono text-[11px] text-slate-400'>{f.cve}</span>}
                    </div>
                    <div className='mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-[18px] font-mono text-[11px] text-slate-400'>
                      <span className='uppercase'>{f.severity}</span>
                      <span>source: {f.source}</span>
                      {f.port && <span>port: {f.port}</span>}
                    </div>
                    {f.remediation && <div className='mt-1 pl-[18px] text-xs text-slate-500 dark:text-slate-400'>fix: {f.remediation}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title='Steps' badge='what runs' badgeTone='slate' hint='on your device'>
            <div>
              {STEPS.map((s) => (
                <div key={s.n} className='grid grid-cols-[18px_1fr] gap-2 border-t border-slate-200 py-2.5 first:border-0 first:pt-0 dark:border-slate-800'>
                  <span className='font-mono text-[11px] text-slate-400'>{s.n}</span>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-2 text-sm font-medium'>
                      {s.label}
                      <span className='font-mono text-[10px] uppercase tracking-wide text-slate-400'>{s.tag}</span>
                    </div>
                    <div className='mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400'>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* side column */}
        <div className='space-y-4'>
          <Card title='Findings by severity' badge='auto' badgeTone='cyan'>
            <div className='space-y-1.5'>
              {(['critical', 'high', 'medium', 'low'] as Severity[]).map((k) => (
                <div key={k} className='grid grid-cols-[72px_1fr_28px] items-center gap-2.5'>
                  <span className='text-xs font-semibold capitalize'>{k}</span>
                  <span className='h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800'>
                    <span className={`block h-full rounded-full ${SEV_COLOR[k]}`} style={{ width: `${Math.round((latest.summary[k as 'critical'] / maxSev) * 100)}%` }} />
                  </span>
                  <span className='text-right font-mono text-sm tabular-nums'>{latest.summary[k as 'critical']}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title='Export report' badge='on demand' badgeTone='slate' hint='saved locally'>
            <p className='text-sm text-slate-600 dark:text-slate-400'>A formatted assessment report — executive summary, severity breakdown, and per-finding detail. Generated in your browser; nothing is sent anywhere.</p>
            <div className='mt-3 flex flex-wrap gap-2'>
              <button onClick={() => exportPdf(latest)} className='rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900'>
                Export .pdf
              </button>
              <button onClick={() => download(`self-audit-${latest.device.id}.md`, buildMarkdown(latest), 'text/markdown')} className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700'>
                Export .md
              </button>
              <button onClick={() => download(`self-audit-${latest.device.id}.csv`, buildCsv(latest), 'text/csv')} className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700'>
                Export .csv
              </button>
              <button onClick={() => download(`self-audit-${latest.device.id}.json`, JSON.stringify(latest, null, 2), 'application/json')} className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700'>
                Export .json
              </button>
            </div>
            <p className='mt-2 font-mono text-[11px] text-slate-400'>PDF opens a print view — choose &ldquo;Save as PDF&rdquo;. CSV is the findings table for a spreadsheet.</p>
          </Card>
        </div>
      </div>

      <p className='mt-6 max-w-3xl text-xs leading-relaxed text-slate-400'>
        <b>How it fits together.</b> Pick your engine, approve, and press start — the page hands you the exact command to run on your
        device. A Python agent runs nmap + Lynis (and optionally OpenVAS/Nessus) against the host it runs on and writes a results
        file. You load that file here, and it validates, renders and exports entirely in your browser. Nothing is uploaded and no
        server stores your results.
      </p>
    </main>
  );
}

function Card({ title, badge, badgeTone = 'slate', hint, children }: { title: string; badge?: string; badgeTone?: 'cyan' | 'amber' | 'slate'; hint?: string; children: React.ReactNode }) {
  const tone = badgeTone === 'cyan'
    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400'
    : badgeTone === 'amber'
    ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
    : 'border-slate-300 text-slate-500 dark:border-slate-700';
  return (
    <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
      <div className='mb-3.5 flex items-center justify-between gap-2'>
        <h2 className='flex items-center gap-2 text-sm font-semibold'>
          {title}
          {badge && <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${tone}`}>{badge}</span>}
        </h2>
        {hint && <span className='font-mono text-[11px] text-slate-400'>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

type Counts = { critical: number; high: number; medium: number; low: number; info: number; total: number };
function counts(a: AuditResult): Counts {
  const info = a.findings.filter((f) => f.severity === 'info').length;
  const { critical, high, medium, low } = a.summary;
  return { critical, high, medium, low, info, total: critical + high + medium + low + info };
}

function execNarrative(a: AuditResult, c: Counts): string {
  const head = `This read-only self-audit of ${a.device.id} identified ${c.total} finding${c.total === 1 ? '' : 's'}`;
  const tail = c.critical || c.high
    ? ' Prioritise the critical and high-severity items, which carry the greatest exposure.'
    : ' No critical or high-severity issues were identified; remaining items are hardening improvements.';
  return `${head} — ${c.critical} critical, ${c.high} high, ${c.medium} medium, ${c.low} low${c.info ? `, ${c.info} informational` : ''}.${tail}`;
}

function buildMarkdown(a: AuditResult): string {
  const c = counts(a);
  const esc = (s?: string) => (s ?? '').replace(/\|/g, '\\|');
  const lines: string[] = [
    '# Self-Audit Report',
    '',
    `**Device:** ${a.device.id}${a.device.hostname && a.device.hostname !== a.device.id ? ' (' + a.device.hostname + ')' : ''}  `,
    ...(a.device.os ? [`**OS:** ${a.device.os}  `] : []),
    `**Generated:** ${new Date().toLocaleString()}  `,
    `**Engines:** ${a.engines.join(', ')}  `,
    `**Mode:** ${a.mode} (read-only)`,
    '',
    '## Executive summary',
    '',
    execNarrative(a, c),
    '',
    '## Severity breakdown',
    '',
    '| Severity | Count |',
    '| --- | ---: |',
    `| Critical | ${c.critical} |`,
    `| High | ${c.high} |`,
    `| Medium | ${c.medium} |`,
    `| Low | ${c.low} |`,
    ...(c.info ? [`| Info | ${c.info} |`] : []),
    `| **Total** | **${c.total}** |`,
    '',
    '## Findings',
    '',
    '| # | Severity | Finding | Source | Reference |',
    '| ---: | --- | --- | --- | --- |',
    ...a.findings.map((f, i) => `| ${i + 1} | ${f.severity} | ${esc(f.title)} | ${esc(f.source)}${f.port ? ' :' + esc(f.port) : ''} | ${esc(f.cve) || '—'} |`),
    '',
    '## Detailed findings',
    '',
  ];
  a.findings.forEach((f, i) => {
    lines.push(`### ${i + 1}. ${f.title}`);
    lines.push('');
    lines.push(`- **Severity:** ${f.severity}`);
    lines.push(`- **Source:** ${f.source}${f.port ? ` (port ${f.port})` : ''}`);
    if (f.cve) lines.push(`- **Reference:** ${f.cve}`);
    lines.push(`- **Remediation:** ${f.remediation || 'Review and remediate per your hardening baseline.'}`);
    lines.push('');
  });
  lines.push('---', '', '_Generated by the Self-Audit Dashboard — read-only assessment, no exploitation performed._');
  return lines.join('\n') + '\n';
}

function buildCsv(a: AuditResult): string {
  const q = (v?: string) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows: string[][] = [['id', 'severity', 'title', 'cve', 'source', 'port', 'remediation']];
  for (const f of a.findings) rows.push([f.id, f.severity, f.title, f.cve || '', f.source, f.port || '', f.remediation || '']);
  return rows.map((r) => r.map(q).join(',')).join('\r\n') + '\r\n';
}

function buildHtmlReport(a: AuditResult): string {
  const c = counts(a);
  const esc = (s?: string) => String(s ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch] as string));
  const col: Record<Severity, string> = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#059669', info: '#0284c7' };
  const metaCount = (label: string, n: number, c2: string) =>
    `<div class="metric"><div class="n" style="color:${c2}">${n}</div><div class="l">${label}</div></div>`;
  const rows = a.findings
    .map(
      (f, i) => `<tr>
      <td class="num">${i + 1}</td>
      <td><span class="pill" style="background:${col[f.severity]}">${esc(f.severity)}</span></td>
      <td><div class="t">${esc(f.title)}${f.cve ? ` <span class="cve">${esc(f.cve)}</span>` : ''}</div><div class="rem">${esc(f.remediation || 'Review and remediate per your hardening baseline.')}</div></td>
      <td class="src">${esc(f.source)}${f.port ? ' :' + esc(f.port) : ''}</td>
    </tr>`,
    )
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Self-Audit Report — ${esc(a.device.id)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font: 14px/1.5 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; background: #fff; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 40px 32px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .06em; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin: 32px 0 14px; }
  .meta { color: #475569; font-size: 12.5px; margin-top: 8px; }
  .meta b { color: #0f172a; }
  .summary { margin-top: 10px; }
  .metrics { display: flex; gap: 10px; flex-wrap: wrap; margin: 6px 0 2px; }
  .metric { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 16px; text-align: center; min-width: 78px; }
  .metric .n { font-size: 22px; font-weight: 700; }
  .metric .l { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #e2e8f0; padding: 8px 8px; }
  td { border-bottom: 1px solid #eef2f6; padding: 10px 8px; vertical-align: top; }
  td.num, td.src { color: #64748b; font-size: 12px; white-space: nowrap; }
  .t { font-weight: 600; }
  .cve { font-weight: 400; color: #64748b; font-size: 11.5px; font-family: ui-monospace, Menlo, Consolas, monospace; }
  .rem { color: #475569; font-size: 12px; margin-top: 3px; }
  .pill { color: #fff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; padding: 2px 8px; border-radius: 999px; }
  .foot { margin-top: 36px; color: #94a3b8; font-size: 11.5px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  @media print { .wrap { padding: 0; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style></head>
<body><div class="wrap">
  <h1>Self-Audit Report</h1>
  <div class="meta">
    <b>${esc(a.device.id)}</b>${a.device.os ? ' · ' + esc(a.device.os) : ''}<br>
    Generated ${esc(new Date().toLocaleString())} · Engines: ${esc(a.engines.join(', '))} · Mode: ${esc(a.mode)} (read-only)
  </div>
  <h2>Executive summary</h2>
  <div class="summary">${esc(execNarrative(a, c))}</div>
  <div class="metrics">
    ${metaCount('Critical', c.critical, col.critical)}
    ${metaCount('High', c.high, col.high)}
    ${metaCount('Medium', c.medium, col.medium)}
    ${metaCount('Low', c.low, col.low)}
    ${c.info ? metaCount('Info', c.info, col.info) : ''}
    ${metaCount('Total', c.total, '#0f172a')}
  </div>
  <h2>Findings</h2>
  ${a.findings.length ? `<table><thead><tr><th>#</th><th>Severity</th><th>Finding &amp; remediation</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>No findings in this report.</p>'}
  <div class="foot">Generated by the Self-Audit Dashboard — read-only assessment, no exploitation performed. Nothing was uploaded; this report was produced in the browser.</div>
</div>
<script>window.onload=function(){window.focus();window.print();};</script>
</body></html>`;
}

function exportPdf(a: AuditResult) {
  const w = window.open('', '_blank');
  if (!w) {
    window.print();
    return;
  }
  w.document.write(buildHtmlReport(a));
  w.document.close();
}
