import type { AuditResult } from './types';
import { Redis as UpstashRedis } from '@upstash/redis';
import type IORedis from 'ioredis';

// Guest data expires after 1 hour; owner data is kept.
export const GUEST_TTL_SECONDS = 60 * 60;
const OWNER_KEY = 'owner:audits';
const guestKey = (id: string) => `guest:${id}:audits`;

// Three possible backends, chosen from whatever the host provides:
//   - 'upstash': Upstash REST (KV_REST_API_* or UPSTASH_REDIS_REST_*). HTTP-based.
//   - 'redis':   a standard TCP Redis URL (KV_REDIS_URL or REDIS_URL), e.g. the
//                rediss://... string a Redis Cloud / Vercel Marketplace store exposes.
//   - 'memory':  in-process fallback so local dev and an un-provisioned deploy still work.
const restUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const restToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const tcpUrl = process.env.KV_REDIS_URL || process.env.REDIS_URL;

export type Backend = 'upstash' | 'redis' | 'memory';
export const backend: Backend = restUrl && restToken ? 'upstash' : tcpUrl ? 'redis' : 'memory';
export const useKV = backend !== 'memory';

const upstash = backend === 'upstash' ? new UpstashRedis({ url: restUrl as string, token: restToken as string }) : null;

// ioredis is a Node-only client; these route handlers run on the Node runtime.
// Instantiate lazily and reuse across warm invocations. A rediss:// URL turns on
// TLS automatically, which Redis Cloud requires.
let tcp: IORedis | null = null;
function getTcp(): IORedis {
  if (!tcp) {
    // Loaded lazily so the module doesn't require ioredis unless this backend is active.
    const Ctor = require('ioredis') as typeof import('ioredis').default;
    tcp = new Ctor(tcpUrl as string, { maxRetriesPerRequest: 3, lazyConnect: false });
  }
  return tcp;
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

// --- backend-agnostic primitives ---
async function pushJson(key: string, v: AuditResult, ttl?: number): Promise<void> {
  if (backend === 'upstash') {
    await upstash!.lpush(key, v);
    if (ttl) await upstash!.expire(key, ttl);
  } else if (backend === 'redis') {
    const r = getTcp();
    await r.lpush(key, JSON.stringify(v));
    if (ttl) await r.expire(key, ttl);
  } else {
    memPush(key, v, ttl);
  }
}

async function listJson(key: string): Promise<AuditResult[]> {
  if (backend === 'upstash') {
    return parseList((await upstash!.lrange(key, 0, 49)) as unknown[]);
  } else if (backend === 'redis') {
    return parseList(await getTcp().lrange(key, 0, 49));
  }
  return memGet(key);
}

async function delKey(key: string): Promise<void> {
  if (backend === 'upstash') {
    await upstash!.del(key);
  } else if (backend === 'redis') {
    await getTcp().del(key);
  } else {
    mem.delete(key);
  }
}

export async function addOwnerAudit(r: AuditResult): Promise<void> {
  await pushJson(OWNER_KEY, r);
}

export async function listOwnerAudits(): Promise<AuditResult[]> {
  return listJson(OWNER_KEY);
}

export function newSessionId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function addGuestAudit(session: string, r: AuditResult): Promise<void> {
  await pushJson(guestKey(session), r, GUEST_TTL_SECONDS);
}

export async function listGuestAudits(session: string): Promise<AuditResult[]> {
  return listJson(guestKey(session));
}

export async function deleteGuest(session: string): Promise<void> {
  await delKey(guestKey(session));
}

// Diagnostic: report the active backend and, for a live store, a write-read round-trip.
export async function pingStore(): Promise<{ backend: Backend; ok: boolean; error?: string }> {
  if (backend === 'memory') return { backend, ok: false };
  const token = 'health:' + Date.now();
  try {
    if (backend === 'upstash') {
      await upstash!.set('health:probe', token, { ex: 30 });
      const got = await upstash!.get('health:probe');
      return { backend, ok: String(got) === token };
    }
    const r = getTcp();
    await r.set('health:probe', token, 'EX', 30);
    const got = await r.get('health:probe');
    return { backend, ok: String(got) === token };
  } catch (e) {
    return { backend, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
