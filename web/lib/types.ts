export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type EventStatus = 'ok' | 'run' | 'info' | 'hold' | 'error';
export type Mode = 'audit' | 'validate' | 'both';

export interface AuditEvent {
  ts: string;
  status: EventStatus;
  title: string;
  detail?: string;
}

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  cve?: string;
  source: string;
  port?: string;
  remediation?: string;
}

export interface AuditResult {
  agent_version: string;
  device: { id: string; hostname?: string; os?: string; address?: string };
  mode: Mode;
  engines: string[];
  started_at: string;
  finished_at: string;
  events?: AuditEvent[];
  findings: Finding[];
  summary: { critical: number; high: number; medium: number; low: number };
}
