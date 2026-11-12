'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AuditEvent, AuditResult, Mode, Severity } from '@/lib/types';
import { sampleAudits } from '@/lib/sample';

const SEV_COLOR: Record<Severity, string> = {
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-600',
  info: 'bg-sky-500',
};

const PIPELINE = [
  { n: 1, label: 'Discovery', tag: 'nmap', st: 'done' },
  { n: 2, label: 'Hardening', tag: 'lynis', st: 'done' },
  { n: 3, label: 'Deep scan', tag: 'optional', st: 'queued' },
  { n: 4, label: 'Correlate', tag: 'agent', st: 'run' },
  { n: 5, label: 'Checkpoint', tag: 'manual', st: 'manual' },
  { n: 6, label: 'Validate', tag: 'manual', st: 'manual' },
  { n: 7, label: 'Report', tag: 'export', st: 'queued' },
];

const JOBS = [
  { name: 'Nightly self-audit', cron: '0 2 * * *', when: 'next run · tonight 02:00', on: true },
  { name: 'Weekly deep scan', cron: '0 3 * * 0', when: 'next run · Sun 03:00', on: true },
  { name: 'Weekly report + export', cron: '30 3 * * 0', when: 'next run · Sun 03:30', on: false },
];

const DOT: Record<string, string> = {
  done: 'bg-emerald-500',
  run: 'bg-cyan-500 ring-4 ring-cyan-500/25',
  manual: 'bg-amber-500',
  queued: 'bg-sky-500',
};

function nowStr() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function Page() {
  const [audits, setAudits] = useState<AuditResult[]>(sampleAudits);
  const [isSample, setIsSample] = useState(true);
  const [mode, setMode] = useState<Mode>('audit');
  const [engine, setEngine] = useState<'none' | 'openvas' | 'nessus'>('none');
  const [approved, setApproved] = useState<string | null>(null);
  const [extra, setExtra] = useState<AuditEvent[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/audits')
      .then((r) => r.json())
      .then((d) => {
        if (!active || !d || !Array.isArray(d.audits) || d.audits.length === 0) return;
        setAudits(d.audits);
        setIsSample(Boolean(d.sample));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const latest = audits[0];
  const events = useMemo(() => [...extra, ...(latest.events || [])], [extra, latest]);
  const maxSev = Math.max(1, latest.summary.critical, latest.summary.high, latest.summary.medium, latest.summary.low);

  function sim(steps: AuditEvent[]) {
    if (running) return;
    setRunning(true);
    let i = 0;
    const tick = () => {
      if (i >= steps.length) {
        setRunning(false);
        return;
      }
      const s = steps[i++];
      setExtra((prev) => [{ ...s, ts: nowStr() }, ...prev]);
      setTimeout(tick, 750);
    };
    tick();
  }

  return (
    <main className='mx-auto max-w-5xl px-4 py-7'>
      {/* masthead */}
      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div className='min-w-0'>
          <div className='font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400'>
            Hosted on Vercel · Control plane · Benign self-audit
          </div>
          <h1 className='mt-1 text-2xl font-semibold tracking-tight sm:text-3xl'>Self-Audit Dashboard</h1>
          <div className='mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-slate-500 dark:text-slate-400'>
            <span>device <b className='text-slate-700 dark:text-slate-200'>{latest.device.id} · {latest.device.address}</b></span>
            <span>os <b className='text-slate-700 dark:text-slate-200'>{latest.device.os}</b></span>
            <span>engines <b className='text-slate-700 dark:text-slate-200'>{latest.engines.join(', ')}</b></span>
          </div>
        </div>
        <span className='inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400'>
          <span className='h-2 w-2 rounded-full bg-emerald-500' />
          Last run passed
        </span>
      </div>

      {isSample && (
        <div className='mt-3 inline-block rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono text-[11px] text-amber-700 dark:text-amber-400'>
          Example data — waiting for your agent to report in
        </div>
      )}

      {/* mode + engine pickers */}
      <div className='mt-5 flex flex-wrap items-center gap-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
        <Picker label='Mode' value={mode} onChange={(v) => setMode(v as Mode)} options={[['audit', 'Audit only'], ['validate', 'Validation'], ['both', 'Both']]} />
        <Picker label='Deep CVE engine' value={engine} onChange={(v) => setEngine(v as typeof engine)} options={[['none', 'Baseline only'], ['openvas', 'OpenVAS (free)'], ['nessus', 'Nessus (BYO key)']]} />
        <p className='min-w-0 flex-1 font-mono text-[11px] text-slate-400'>
          Baseline nmap + Lynis always run. Validation stays manual behind the checkpoint.
        </p>
      </div>

      {/* pipeline */}
      <div className='mt-5 flex flex-wrap gap-2'>
        {PIPELINE.map((s) => (
          <div key={s.n} className='flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium shadow-sm dark:border-slate-800 dark:bg-slate-900'>
            <span className={`h-2.5 w-2.5 rounded-full ${DOT[s.st]}`} />
            <span className='font-mono text-[11px] text-slate-400'>{s.n}</span>
            {s.label}
            <span className='font-mono text-[10px] uppercase tracking-wide text-slate-400'>{s.tag}</span>
          </div>
        ))}
      </div>

      <div className='mt-5 grid gap-4 md:grid-cols-[1.5fr_1fr]'>
        {/* main column */}
        <div className='space-y-4'>
          <Card title='Scheduled jobs' badge='crontab' badgeTone='cyan' hint='runs on your device'>
            <div>
              {JOBS.map((j, i) => (
                <div key={i} className='grid grid-cols-[1fr_auto] gap-x-3 border-t border-slate-200 py-3 first:border-0 first:pt-0 dark:border-slate-800'>
                  <div className='min-w-0'>
                    <div className='text-sm font-semibold'>{j.name}</div>
                    <div className='mt-0.5 font-mono text-xs text-cyan-700 dark:text-cyan-400'>{j.cron}</div>
                    <div className='mt-0.5 font-mono text-[11px] text-slate-400'>{j.when}</div>
                  </div>
                  <span className={`self-start rounded-full border px-2 py-0.5 font-mono text-[11px] ${j.on ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-slate-300 text-slate-400 dark:border-slate-700'}`}>
                    {j.on ? 'enabled' : 'paused'}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card title='Activity timeline' hint='what ran, and when'>
            <div className='mb-3 flex flex-wrap gap-2'>
              <button
                onClick={() => sim([
                  { ts: '', status: 'run', title: 'Manual run: discovery started', detail: `nmap -sV -sC --script vuln ${latest.device.address}` },
                  { ts: '', status: 'info', title: 'Scanning own host…', detail: 'agent → localhost' },
                  { ts: '', status: 'ok', title: 'Discovery complete', detail: 'results streamed to dashboard' },
                ])}
                disabled={running}
                className='rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50'
              >
                ▶ Run self-audit now
              </button>
              <button
                onClick={() => sim([
                  { ts: '', status: 'run', title: 'Lynis hardening audit queued', detail: 'lynis audit system --quick' },
                  { ts: '', status: 'ok', title: 'Hardening audit complete', detail: 'findings updated' },
                ])}
                disabled={running}
                className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-700'
              >
                Re-run hardening
              </button>
            </div>
            <div className='max-h-80 space-y-0 overflow-y-auto'>
              {events.map((e, i) => (
                <div key={i} className='grid grid-cols-[14px_1fr] gap-3 border-t border-slate-200 py-2.5 first:border-0 dark:border-slate-800'>
                  <span className={`mt-1 h-2.5 w-2.5 self-start rounded-full ${e.status === 'ok' ? 'bg-emerald-500' : e.status === 'run' ? 'bg-cyan-500 ring-4 ring-cyan-500/20' : e.status === 'hold' ? 'bg-amber-500' : e.status === 'error' ? 'bg-red-500' : 'bg-sky-500'}`} />
                  <div className='min-w-0'>
                    <span className='font-mono text-[11px] text-slate-400'>{e.ts}</span>
                    <div className='text-sm font-medium'>{e.title}</div>
                    {e.detail && <div className='mt-0.5 break-words font-mono text-xs text-slate-500 dark:text-slate-400'>{e.detail}</div>}
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
            <div className='mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800'>
              {latest.findings.slice(0, 4).map((f) => (
                <div key={f.id} className='text-sm'>
                  <span className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${SEV_COLOR[f.severity]}`} />
                  <span className='font-medium'>{f.title}</span>
                  {f.cve && <span className='ml-1 font-mono text-[11px] text-slate-400'>{f.cve}</span>}
                </div>
              ))}
            </div>
          </Card>

          <Card title='Validation checkpoint' badge='manual' badgeTone='amber'>
            <div className='rounded-xl border border-dashed border-amber-500/60 bg-amber-500/5 p-3.5'>
              <strong className='text-sm'>Human approval required</strong>
              <p className='mt-1.5 text-sm text-slate-600 dark:text-slate-400'>
                Discovery and scanning run on their own. Any benign validation is held here until you approve — the tool never auto-exploits your device.
              </p>
              <button
                onClick={() => setApproved(new Date().toLocaleString())}
                className='mt-3 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white'
              >
                {approved ? 'Re-approve shortlist' : 'Review & approve shortlist'}
              </button>
              {approved && (
                <span className='mt-2 block font-mono text-[11px] text-emerald-600 dark:text-emerald-400'>
                  Approved {approved} — validation unlocked (run it yourself)
                </span>
              )}
            </div>
          </Card>

          <Card title='Export report' badge='on demand' badgeTone='slate'>
            <button
              onClick={() => setReport(buildReport(latest))}
              className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700'
            >
              Generate report
            </button>
            <div className='mt-3 flex flex-wrap gap-2'>
              {['.md', '.json', '.pdf', 'Faraday'].map((f) => (
                <span key={f} className='rounded-md border border-slate-200 bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400'>{f}</span>
              ))}
            </div>
            {report && (
              <pre className='mt-3 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-200'>{report}</pre>
            )}
          </Card>
        </div>
      </div>

      <p className='mt-6 max-w-3xl text-xs leading-relaxed text-slate-400'>
        <b>How it fits together.</b> This dashboard is the control plane. It does not run the tools — a Python agent on your
        device runs nmap + Lynis (and optionally OpenVAS/Nessus) against the host it runs on, on a crontab schedule, and POSTs each
        result here. Read-only audit is automated; validation stays manual behind the checkpoint. The server never scans anything.
      </p>
    </main>
  );
}

function Picker({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className='flex items-center gap-2'>
      <span className='font-mono text-[11px] uppercase tracking-wide text-slate-400'>{label}</span>
      <div className='flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700'>
        {options.map(([v, lbl]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${value === v ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
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
    `# Self-Audit Report — ${a.device.id} (${a.device.address})`,
    `Generated ${new Date().toLocaleString()}  ·  engines: ${a.engines.join(', ')}`,
    '',
    '## Summary',
    `${a.summary.critical} critical, ${a.summary.high} high, ${a.summary.medium} medium, ${a.summary.low} low`,
    '',
    '## Findings',
    ...a.findings.map((f) => `- [${f.severity}] ${f.title}${f.cve ? ' (' + f.cve + ')' : ''}\n  source: ${f.source}${f.remediation ? '\n  fix: ' + f.remediation : ''}`),
    '',
    '## Validation',
    'Benign proof-of-execution only; manual, post-approval.',
  ];
  return lines.join('\n');
}
