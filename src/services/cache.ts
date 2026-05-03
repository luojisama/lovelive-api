import type { CacheEnvelope, Env } from "../types";

const memoryCache = new Map<string, CacheEnvelope<unknown>>();

export async function readCached<T>(env: Env, key: string): Promise<CacheEnvelope<T> | null> {
  const kvValue = await env.CACHE?.get(key, "json").catch(() => null);
  if (kvValue) return kvValue as CacheEnvelope<T>;
  return (memoryCache.get(key) as CacheEnvelope<T> | undefined) ?? null;
}

export async function writeCached<T>(env: Env, key: string, data: T, ttlSeconds: number, source: string): Promise<CacheEnvelope<T>> {
  const now = new Date();
  const envelope: CacheEnvelope<T> = {
    data,
    refreshedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    source
  };
  memoryCache.set(key, envelope as CacheEnvelope<unknown>);
  await env.CACHE?.put(key, JSON.stringify(envelope), { expirationTtl: Math.max(ttlSeconds * 2, 60) }).catch(() => undefined);
  return envelope;
}

export function isFresh(envelope: CacheEnvelope<unknown>, now = new Date()): boolean {
  return new Date(envelope.expiresAt).getTime() > now.getTime();
}
