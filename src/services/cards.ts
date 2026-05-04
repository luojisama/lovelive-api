import type { CardGame, CardItem, DataResult, Env } from "../types";
import fixtureCards from "../fixtures/cards.json";
import { fetchRandomSifCard } from "../adapters/schoolidoSif";
import { fetchRandomSif2Card } from "../adapters/idolStorySif2";
import { isFresh, readCached, writeCached } from "./cache";

interface CardQuery {
  game: CardGame;
  character?: string | null;
  rarity?: string | null;
}

const FIXTURE_CARDS = fixtureCards as Record<CardGame, CardItem[]>;
const POOL_KEY_PREFIX = "cards:pool:v1";
const POOL_TTL_SECONDS = 24 * 60 * 60;
const POOL_MAX_SIZE = 50;
const POOL_HIT_THRESHOLD = 5;

export async function getRandomCard(env: Env, query: CardQuery, forceRefresh = false): Promise<DataResult<CardItem>> {
  const mode = env.UPSTREAM_MODE === "live" ? "live" : "fixture";

  if (mode === "fixture") {
    const card = pickFixtureCard(query);
    return { data: card, meta: { source: "fixture", upstreamMode: mode } };
  }

  const cacheKey = buildPoolKey(query);
  const cached = await readCached<CardItem[]>(env, cacheKey);
  const pool = cached?.data ?? [];

  if (!forceRefresh && cached && isFresh(cached) && pool.length >= POOL_HIT_THRESHOLD) {
    return {
      data: pool[Math.floor(Math.random() * pool.length)],
      meta: { source: cached.source, refreshedAt: cached.refreshedAt, upstreamMode: mode }
    };
  }

  try {
    const fresh = query.game === "sif" ? await fetchRandomSifCard(query) : await fetchRandomSif2Card(query);
    const nextPool = appendUnique(pool, fresh, POOL_MAX_SIZE);
    await writeCached(env, cacheKey, nextPool, POOL_TTL_SECONDS, fresh.source);
    return { data: fresh, meta: { source: fresh.source, upstreamMode: mode } };
  } catch (error) {
    console.warn(`[cards] upstream fetch failed for game=${query.game}`, error);
    if (pool.length > 0) {
      return {
        data: pool[Math.floor(Math.random() * pool.length)],
        meta: { source: cached?.source ?? "cards-pool", refreshedAt: cached?.refreshedAt, stale: true, upstreamMode: mode }
      };
    }
    const card = pickFixtureCard(query);
    return { data: card, meta: { source: "fixture", stale: true, upstreamMode: mode } };
  }
}

function buildPoolKey(query: CardQuery): string {
  return `${POOL_KEY_PREFIX}:${query.game}:${(query.character ?? "").toLowerCase()}:${(query.rarity ?? "").toLowerCase()}`;
}

function appendUnique(pool: CardItem[], card: CardItem, maxSize: number): CardItem[] {
  const next = pool.filter((item) => item.id !== card.id);
  next.push(card);
  return next.length > maxSize ? next.slice(next.length - maxSize) : next;
}

function pickFixtureCard(query: CardQuery): CardItem {
  const cards = FIXTURE_CARDS[query.game] ?? [];
  const filtered = cards.filter((card) => {
    if (query.character && !`${card.character ?? ""} ${card.characterJa ?? ""}`.toLowerCase().includes(query.character.toLowerCase())) return false;
    if (query.rarity && card.rarity?.toLowerCase() !== query.rarity.toLowerCase()) return false;
    return true;
  });
  const pool = filtered.length > 0 ? filtered : cards;
  if (pool.length === 0) throw new Error(`no fixture cards for ${query.game}`);
  return pool[Math.floor(Math.random() * pool.length)];
}
