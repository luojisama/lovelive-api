import type { EventItem } from "../types";
import { stableHash, stripHtml } from "../utils/text";
import { fetchText } from "../services/upstream";

const NEWS_URL = "https://www.lovelive-anime.jp/";

export async function fetchOfficialNewsEvents(): Promise<EventItem[]> {
  const html = await fetchText(NEWS_URL, 60 * 60);
  return parseOfficialNewsHtml(html);
}

export function parseOfficialNewsHtml(html: string): EventItem[] {
  const text = stripHtml(html);
  const entries = [...text.matchAll(/(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})\s+([^ ]+)\s+([^ ]+)\s+(.+?)(?=20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}|もっと見る|$)/g)];
  return entries
    .map((match) => {
      const [, year, month, day, category, series, titleRaw] = match;
      const title = titleRaw.trim().slice(0, 180);
      return {
        id: `official-news-${stableHash(`${year}-${month}-${day}-${title}`)}`,
        title,
        series: [series],
        category: normalizeCategory(category),
        startAt: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00+09:00`,
        timezone: "Asia/Tokyo",
        description: title,
        source: "official-news",
        sourceUrl: NEWS_URL
      } satisfies EventItem;
    })
    .filter((event) => event.category === "event" || event.category === "live" || event.category === "stream");
}

function normalizeCategory(category: string): string {
  if (category.includes("ライブ")) return "live";
  if (category.includes("生配信")) return "stream";
  if (category.includes("イベント") || category.includes("キャンペーン") || category.includes("ご当地")) return "event";
  return "news";
}
