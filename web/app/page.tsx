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
  if (!['audit', 'validate', 'both'].includes(o.mode as string)) return { error: `Invalid mode: "${String(o.mode)}".` };
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

  function startScan() {
    setCommand(buildCommand(engine));
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

      {/* load report */}
      <section className='mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
        <div className='mb-3 flex items-center justify-between gap-2'>
          <h2 className='flex items-center gap-2 text-sm font-semibold'>
            Load your results
            <span className='rounded-full border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-cyan-700 dark:text-cyan-400'>in browser</span>
          </h2>
          {!isSample && (
            <button onClick={loadSample} className='font-mono text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'>
              reset to example
            </button>
          )}
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
          className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${dragging ? 'border-cyan-500 bg-cyan-500/5' : 'border-slate-300 dark:border-slate-700'}`}
        >
          <p className='text-sm font-medium'>Drag &amp; drop the results file, or paste the JSON</p>
          <p className='mt-1 font-mono text-[11px] text-slate-400'>from the command below (<code>selfaudit-report.json</code>) — it never leaves this page</p>
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

      {/* engine picker */}
      <div className='mt-5 flex flex-wrap items-center gap-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
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
          Baseline nmap + Lynis is free and needs no license. OpenVAS/Nessus are optional. Audit only — read-only, never auto-exploits.
        </p>
      </div>

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

          <Card title='Validation checkpoint' badge='manual' badgeTone='amber'>
            <div className='rounded-xl border border-dashed border-amber-500/60 bg-amber-500/5 p-3.5'>
              <strong className='text-sm'>Human approval required</strong>
              <p className='mt-1.5 text-sm text-slate-600 dark:text-slate-400'>
                Approve the selected options, then start the scan. Nothing runs on this page — approving generates the exact command you run on your device, then you load the results above.
              </p>
              <button
                onClick={() => setApproved(new Date().toLocaleString())}
                className='mt-3 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white'
              >
                {approved ? 'Re-approve options' : 'Approve options'}
              </button>
              {approved && (
                <span className='mt-2 block font-mono text-[11px] text-emerald-600 dark:text-emerald-400'>Approved {approved}</span>
              )}
              <button
                onClick={startScan}
                disabled={!approved}
                className='mt-3 block w-full rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40'
              >
                ▶ Start scan
              </button>
              {command && (
                <div className='mt-3'>
                  <div className='font-mono text-[11px] text-slate-400'>Run this on the device you&apos;re auditing:</div>
                  <pre className='mt-1 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-200'>{command}</pre>
                  <div className='mt-2 flex items-center gap-2'>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(command).then(() => setCopied(true)).catch(() => {});
                      }}
                      className='rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700'
                    >
                      {copied ? 'Copied' : 'Copy command'}
                    </button>
                    <span className='font-mono text-[11px] text-slate-400'>then load the results above</span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card title='Export report' badge='on demand' badgeTone='slate' hint='saved locally'>
            <p className='text-sm text-slate-600 dark:text-slate-400'>Download the current report. Everything is generated in your browser — nothing is sent anywhere.</p>
            <div className='mt-3 flex flex-wrap gap-2'>
              <button onClick={() => download(`self-audit-${latest.device.id}.json`, JSON.stringify(latest, null, 2), 'application/json')} className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700'>
                Export .json
              </button>
              <button onClick={() => download(`self-audit-${latest.device.id}.md`, buildReport(latest), 'text/markdown')} className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700'>
                Export .md
              </button>
              <button onClick={() => window.print()} className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700'>
                Export .pdf
              </button>
            </div>
            <p className='mt-2 font-mono text-[11px] text-slate-400'>PDF opens your browser&apos;s print dialog — choose &ldquo;Save as PDF&rdquo;.</p>
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

function buildReport(a: AuditResult): string {
  const lines = [
    `# Self-Audit Report — ${a.device.id}${a.device.address ? ' (' + a.device.address + ')' : ''}`,
    `Generated ${new Date().toLocaleString()}  ·  engines: ${a.engines.join(', ')}`,
    '',
    '## Summary',
    `${a.summary.critical} critical, ${a.summary.high} high, ${a.summary.medium} medium, ${a.summary.low} low`,
    '',
    '## Findings',
    ...a.findings.map((f) => `- [${f.severity}] ${f.title}${f.cve ? ' (' + f.cve + ')' : ''}\n  source: ${f.source}${f.remediation ? '\n  fix: ' + f.remediation : ''}`),
  ];
  return lines.join('\n');
}
