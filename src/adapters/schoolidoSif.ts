import type { CardItem } from "../types";
import { fetchText } from "../services/upstream";

const SCHOOLIDO_API_BASE = "https://schoolido.lu/api/cards/";

interface SifCardQuery {
  character?: string | null;
  rarity?: string | null;
}

interface SchoolidoCard {
  id: number;
  idol?: {
    name?: string;
    japanese_name?: string;
  };
  translated_collection?: string | null;
  japanese_collection?: string | null;
  rarity?: string;
  attribute?: string;
  release_date?: string | null;
  card_image?: string | null;
  card_idolized_image?: string | null;
  round_card_image?: string | null;
  round_card_idolized_image?: string | null;
  transparent_image?: string | null;
  transparent_idolized_image?: string | null;
  website_url?: string;
}

interface SchoolidoListResponse {
  count: number;
  results: SchoolidoCard[];
}

export function assertCardGame(value: string | null | undefined): "sif" | "sif2" {
  if (value === "sif" || value === "sif2") return value;
  throw new Error("game 必须是 sif 或 sif2");
}

export async function fetchRandomSifCard(query: SifCardQuery = {}): Promise<CardItem> {
  const firstPage = await fetchSifPage(query, 1);
  if (firstPage.count <= 0 || firstPage.results.length === 0) throw new Error("no SIF cards matched");

  const page = Math.floor(Math.random() * firstPage.count) + 1;
  const selectedPage = page === 1 ? firstPage : await fetchSifPage(query, page);
  const card = selectedPage.results[0] ?? firstPage.results[0];
  return normalizeSchoolidoCard(card);
}

export function normalizeSchoolidoCard(card: SchoolidoCard): CardItem {
  const collection = card.translated_collection || card.japanese_collection || undefined;
  const character = card.idol?.name;
  return {
    id: `sif-${card.id}`,
    game: "sif",
    title: collection ? `${character ?? "SIF"} ${collection}` : character,
    character,
    characterJa: card.idol?.japanese_name,
    rarity: card.rarity,
    attribute: card.attribute,
    collection,
    releaseDate: card.release_date ?? undefined,
    images: {
      card: absoluteSchoolidoUrl(card.card_image),
      idolized: absoluteSchoolidoUrl(card.card_idolized_image),
      icon: absoluteSchoolidoUrl(card.round_card_image),
      iconIdolized: absoluteSchoolidoUrl(card.round_card_idolized_image),
      transparent: absoluteSchoolidoUrl(card.transparent_image),
      transparentIdolized: absoluteSchoolidoUrl(card.transparent_idolized_image)
    },
    source: "schoolido-api",
    sourceUrl: card.website_url ?? `https://schoolido.lu/cards/${card.id}/`
  };
}

async function fetchSifPage(query: SifCardQuery, page: number): Promise<SchoolidoListResponse> {
  const url = new URL(SCHOOLIDO_API_BASE);
  url.searchParams.set("page_size", "1");
  url.searchParams.set("page", String(page));
  if (query.character) url.searchParams.set("name", query.character);
  if (query.rarity) url.searchParams.set("rarity", normalizeSifRarity(query.rarity));

  return JSON.parse(await fetchText(url.toString(), 60 * 60)) as SchoolidoListResponse;
}

function normalizeSifRarity(value: string): string {
  return value.trim().toUpperCase();
}

function absoluteSchoolidoUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("//")) return `https:${value}`;
  return new URL(value, "https://schoolido.lu/").toString();
}
