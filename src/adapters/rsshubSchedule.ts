import type { Env, EventItem } from "../types";
import { stableHash, decodeHtml } from "../utils/text";
import { fetchText } from "../services/upstream";

export async function fetchRsshubEvents(env: Env): Promise<EventItem[]> {
  const baseUrl = (env.RSSHUB_BASE_URL ?? "https://rsshub.app").replace(/\/$/, "");
  const xml = await fetchText(`${baseUrl}/lovelive-anime/schedules`, 60 * 60);
  return parseRsshubFeed(xml);
}

export function parseRsshubFeed(xml: string): EventItem[] {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
  return items.map((item) => {
    const title = readTag(item, "title") ?? "LoveLive schedule item";
    const link = readTag(item, "link") ?? "https://www.lovelive-anime.jp/schedule/";
    const pubDate = readTag(item, "pubDate");
    const description = readTag(item, "description");
    const parsedDate = pubDate ? new Date(pubDate) : null;
    const startAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date(0).toISOString();
    return {
      id: `rsshub-${stableHash(`${link}-${title}-${startAt}`)}`,
      title,
      series: ["LoveLive!"],
      category: title.includes("ライブ") ? "live" : "event",
      startAt,
      timezone: "Asia/Tokyo",
      description,
      source: "rsshub",
      sourceUrl: link
    };
  });
}

function readTag(item: string, tag: string): string | undefined {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeHtml(match[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim()) : undefined;
}
