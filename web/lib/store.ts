import type { AuditResult } from './types';
import { Redis } from '@upstash/redis';

// Guest data expires after 1 hour; owner data is kept.
export const GUEST_TTL_SECONDS = 60 * 60;
const OWNER_KEY = 'owner:audits';
const guestKey = (id: string) => `guest:${id}:audits`;

// Works with Vercel's KV-prefixed vars or Upstash's native ones, so it doesn't
// matter which prefix the Upstash integration uses. If neither is set, fall
// back to an in-memory store so local dev and an un-provisioned deploy still work.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const useKV = Boolean(url && token);
const redis = useKV ? new Redis({ url: url as string, token: token as string }) : null;

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
  if (redis) {
    await redis.lpush(OWNER_KEY, r);
  } else {
    memPush(OWNER_KEY, r);
  }
}

export async function listOwnerAudits(): Promise<AuditResult[]> {
  if (redis) {
    const raw = (await redis.lrange(OWNER_KEY, 0, 49)) as unknown[];
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
  if (redis) {
    await redis.lpush(key, r);
    await redis.expire(key, GUEST_TTL_SECONDS);
  } else {
    memPush(key, r, GUEST_TTL_SECONDS);
  }
}

export async function listGuestAudits(session: string): Promise<AuditResult[]> {
  const key = guestKey(session);
  if (redis) {
    const raw = (await redis.lrange(key, 0, 49)) as unknown[];
    return parseList(raw);
  }
  return memGet(key);
}

export async function deleteGuest(session: string): Promise<void> {
  const key = guestKey(session);
  if (redis) {
    await redis.del(key);
  } else {
    mem.delete(key);
  }
}

// Diagnostic: report the active backend and, for Upstash, a live write-read round-trip.
export async function pingStore(): Promise<{ backend: 'upstash' | 'memory'; ok: boolean; error?: string }> {
  if (!redis) return { backend: 'memory', ok: false };
  const token = 'health:' + Date.now();
  try {
    await redis.set('health:probe', token, { ex: 30 });
    const got = await redis.get('health:probe');
    return { backend: 'upstash', ok: String(got) === token };
  } catch (e) {
    return { backend: 'upstash', ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
