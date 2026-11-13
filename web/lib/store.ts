import type { AuditResult } from './types';

// Guest data expires after 1 hour; owner data is kept.
export const GUEST_TTL_SECONDS = 60 * 60;
const OWNER_KEY = 'owner:audits';
const guestKey = (id: string) => `guest:${id}:audits`;

// Use Vercel KV when configured; otherwise fall back to an in-memory store
// so local dev and an un-provisioned deploy still work (non-durable).
export const useKV = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

async function kvClient() {
  const mod = await import('@vercel/kv');
  return mod.kv;
}

// --- in-memory fallback ---
type Entry = { value: AuditResult[]; expiresAt?: number };
const mem = new Map<string, Entry>();
function memGet(key: string): AuditResult[] {
  const e = mem.get(key);
  if (!e) return [];
  if (e.expiresAt && e.expiresAt < Date.now()) {
    mem.delete(key);
    return [];
  }
  return e.value;
}
function memPush(key: string, v: AuditResult, ttl?: number) {
  const value = [v, ...memGet(key)];
  mem.set(key, { value, expiresAt: ttl ? Date.now() + ttl * 1000 : undefined });
}

function parseList(raw: unknown[]): AuditResult[] {
  return raw.map((x) => (typeof x === 'string' ? (JSON.parse(x) as AuditResult) : (x as AuditResult)));
}

export async function addOwnerAudit(r: AuditResult): Promise<void> {
  if (useKV) {
    const kv = await kvClient();
    await kv.lpush(OWNER_KEY, r as unknown as string);
  } else {
    memPush(OWNER_KEY, r);
  }
}

export async function listOwnerAudits(): Promise<AuditResult[]> {
  if (useKV) {
    const kv = await kvClient();
    const raw = (await kv.lrange(OWNER_KEY, 0, 49)) as unknown[];
    return parseList(raw);
  }
  return memGet(OWNER_KEY);
}

export function newSessionId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function addGuestAudit(session: string, r: AuditResult): Promise<void> {
  const key = guestKey(session);
  if (useKV) {
    const kv = await kvClient();
    await kv.lpush(key, r as unknown as string);
    await kv.expire(key, GUEST_TTL_SECONDS);
  } else {
    memPush(key, r, GUEST_TTL_SECONDS);
  }
}

export async function listGuestAudits(session: string): Promise<AuditResult[]> {
  const key = guestKey(session);
  if (useKV) {
    const kv = await kvClient();
    const raw = (await kv.lrange(key, 0, 49)) as unknown[];
    return parseList(raw);
  }
  return memGet(key);
}

export async function deleteGuest(session: string): Promise<void> {
  const key = guestKey(session);
  if (useKV) {
    const kv = await kvClient();
    await kv.del(key);
  } else {
    mem.delete(key);
  }
}
