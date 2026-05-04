import type { CardItem } from "../types";
import { fetchText } from "../services/upstream";
import { decodeHtml, stripHtml } from "../utils/text";

const IDOL_STORY_SIF2_CARDS_URL = "https://idol.st/SIF2/cards/";

interface Sif2CardQuery {
  character?: string | null;
  rarity?: string | null;
}

export async function fetchRandomSif2Card(query: Sif2CardQuery = {}): Promise<CardItem> {
  const firstUrl = buildSif2CardsUrl(query, 1);
  const firstHtml = await fetchText(firstUrl, 60 * 60);
  const maxPage = parseIdolStoryMaxPage(firstHtml);
  const firstCards = parseIdolStorySif2Cards(firstHtml);
  if (firstCards.length === 0) throw new Error("no SIF2 cards matched");

  const page = Math.floor(Math.random() * maxPage) + 1;
  const cards = page === 1 ? firstCards : parseIdolStorySif2Cards(await fetchText(buildSif2CardsUrl(query, page), 60 * 60));
  const pool = cards.length > 0 ? cards : firstCards;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function parseIdolStorySif2Cards(html: string): CardItem[] {
  const cards: CardItem[] = [];
  const blocks = html.match(/<div class="col-md-4"[^>]*data-item="SIF2\/card"[\s\S]*?(?=<div class="col-md-4"[^>]*data-item="SIF2\/card"|<div class="pagination"|$)/g) ?? [];

  for (const block of blocks) {
    const id = block.match(/data-item-id="(\d+)"/)?.[1];
    const href = block.match(/<a\s+href="([^"]+)"[^>]*data-ajax-url="\/ajax\/SIF2\/card\/\d+\/"[^>]*data-ajax-title="([^"]+)"/)?.[1];
    const rawTitle = block.match(/data-ajax-title="([^"]+)"/)?.[1];
    const imageMatches = [...block.matchAll(/<img\s+src="([^"]+)"[^>]*class="sif2-card-image\s+(normal|idolized)"/g)];
    if (!id || !href || !rawTitle || imageMatches.length === 0) continue;

    const parsedTitle = parseSif2Title(decodeHtml(rawTitle));
    const images = Object.fromEntries(
      imageMatches.map((match) => [match[2] === "normal" ? "card" : "idolized", new URL(decodeHtml(match[1]), IDOL_STORY_SIF2_CARDS_URL).toString()])
    ) as { card?: string; idolized?: string };

    cards.push({
      id: `sif2-${id}`,
      game: "sif2",
      title: parsedTitle.title,
      character: parsedTitle.character,
      rarity: parsedTitle.rarity,
      attribute: parsedTitle.attribute,
      images,
      source: "idol-story-sif2-html",
      sourceUrl: new URL(decodeHtml(href), "https://idol.st/").toString()
    });
  }

  return cards;
}

export function parseIdolStoryMaxPage(html: string): number {
  const pages = [...html.matchAll(/page=(\d+)/g)].map((match) => Number(match[1])).filter((page) => page > 0);
  return Math.max(1, ...pages);
}

function buildSif2CardsUrl(query: Sif2CardQuery, page: number): string {
  const url = new URL(IDOL_STORY_SIF2_CARDS_URL);
  url.searchParams.set("page", String(page));
  if (query.character) url.searchParams.set("search", query.character);
  const rarity = normalizeSif2Rarity(query.rarity);
  if (rarity != null) url.searchParams.set("i_rarity", String(rarity));
  return url.toString();
}

function parseSif2Title(value: string): { rarity?: string; character?: string; attribute?: string; title?: string } {
  const clean = stripHtml(value).replace(/\s+/g, " ").trim();
  const match = clean.match(/^(R|SR|UR)\s+(.+?)\s+(Smile|Pure|Cool|スマイル|ピュア|クール)\s+「(.+)」$/);
  if (!match) return { title: clean };
  return {
    rarity: match[1],
    character: match[2],
    attribute: normalizeSif2Attribute(match[3]),
    title: match[4]
  };
}

function normalizeSif2Rarity(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized === "R") return 0;
  if (normalized === "SR") return 1;
  if (normalized === "UR") return 2;
  return undefined;
}

function normalizeSif2Attribute(value: string): string {
  if (value === "スマイル") return "Smile";
  if (value === "ピュア") return "Pure";
  if (value === "クール") return "Cool";
  return value;
}
