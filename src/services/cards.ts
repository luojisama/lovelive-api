import type { CardGame, CardItem, DataResult, Env } from "../types";
import fixtureCards from "../fixtures/cards.json";
import { fetchRandomSifCard } from "../adapters/schoolidoSif";
import { fetchRandomSif2Card } from "../adapters/idolStorySif2";

interface CardQuery {
  game: CardGame;
  character?: string | null;
  rarity?: string | null;
}

const FIXTURE_CARDS = fixtureCards as Record<CardGame, CardItem[]>;

export async function getRandomCard(env: Env, query: CardQuery): Promise<DataResult<CardItem>> {
  const mode = env.UPSTREAM_MODE === "live" ? "live" : "fixture";

  if (mode === "fixture") {
    const card = pickFixtureCard(query);
    return { data: card, meta: { source: "fixture", upstreamMode: mode } };
  }

  try {
    const data = query.game === "sif" ? await fetchRandomSifCard(query) : await fetchRandomSif2Card(query);
    return { data, meta: { source: data.source, upstreamMode: mode } };
  } catch {
    const card = pickFixtureCard(query);
    return { data: card, meta: { source: "fixture", stale: true, upstreamMode: mode } };
  }
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
