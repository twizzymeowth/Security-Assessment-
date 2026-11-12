import type { AuditResult } from './types';

// Example data so the dashboard renders before any real agent reports in.
// Clearly marked as a sample in the UI; replaced once an agent POSTs results.
export const sampleAudits: AuditResult[] = [
  {
    agent_version: '0.1.0',
    device: { id: 'my-laptop', hostname: 'my-laptop', os: 'Ubuntu 24.04', address: '127.0.0.1' },
    mode: 'audit',
    engines: ['nmap', 'lynis'],
    started_at: '2026-11-12T02:00:04Z',
    finished_at: '2026-11-12T02:00:52Z',
    events: [
      { ts: '02:00:04', status: 'ok', title: 'Nightly self-audit started (cron)', detail: 'nmap -sV -sC --script vuln 127.0.0.1' },
      { ts: '02:00:31', status: 'ok', title: 'Discovery complete', detail: '6 open ports · 22 ssh, 80 http, 443 https, 445 smb, 3306 mysql, 8080 http-alt' },
      { ts: '02:00:33', status: 'run', title: 'Lynis hardening audit started', detail: 'lynis audit system --quick' },
      { ts: '02:00:52', status: 'ok', title: 'Hardening audit complete', detail: '16 findings · 1 critical, 3 high, 7 medium, 5 low' },
      { ts: '02:00:52', status: 'hold', title: 'Validation held for approval', detail: 'nothing runs against the device until you approve the checkpoint' },
    ],
    findings: [
      { id: 'f1', severity: 'critical', title: 'SMBv1 enabled on port 445', cve: 'CVE-2017-0144', source: 'nmap', port: '445', remediation: 'Disable SMBv1; restrict SMB to the LAN.' },
      { id: 'f2', severity: 'high', title: 'OpenSSH password auth permitted', source: 'lynis', remediation: 'Set PasswordAuthentication no; use keys.' },
      { id: 'f3', severity: 'high', title: 'Outdated MySQL exposed on 3306', cve: 'CVE-2023-21980', source: 'nmap', port: '3306', remediation: 'Update MySQL; bind to localhost.' },
      { id: 'f4', severity: 'high', title: 'No host firewall active', source: 'lynis', remediation: 'Enable ufw / nftables with a default-deny policy.' },
      { id: 'f5', severity: 'medium', title: 'HTTP service without TLS redirect', source: 'nmap', port: '80', remediation: 'Redirect 80 to 443.' },
    ],
    summary: { critical: 1, high: 3, medium: 7, low: 5 },
  },
];
