import type { EventItem } from "../types";
import { toIsoDate } from "../utils/date";
import { stableHash, stripHtml } from "../utils/text";
import { fetchText } from "../services/upstream";

const SCHEDULE_URL = "https://www.lovelive-anime.jp/schedule/";

export async function fetchOfficialSchedule(): Promise<EventItem[]> {
  const html = await fetchText(SCHEDULE_URL, 60 * 60);
  return parseOfficialScheduleHtml(html);
}

export function parseOfficialScheduleHtml(html: string): EventItem[] {
  const text = stripHtml(html);
  const year = Number(text.match(/(20\d{2})年/)?.[1]) || new Date().getFullYear();
  const monthMatches = [...text.matchAll(/(\d{1,2})月/g)].map((match) => Number(match[1]));
  const month = monthMatches.find((value) => value >= 1 && value <= 12) ?? new Date().getMonth() + 1;
  const events: EventItem[] = [];
  const dayBlock = /(\d{1,2})\s*\([^)]\)\s+([^。]+?)(?=(?:\d{1,2}\s*\([^)]\))|指定された条件|$)/g;
  let match: RegExpExecArray | null;

  while ((match = dayBlock.exec(text)) !== null) {
    const day = Number(match[1]);
    const body = match[2].trim();
    if (!body || Number.isNaN(day)) continue;
    const category = body.includes("ライブ") ? "live" : body.includes("生配信") ? "stream" : "event";
    const series = extractSeries(body);
    const title = body.replace(series.join(" "), "").trim().slice(0, 180) || body.slice(0, 180);
    const venue = body.match(/(?:会場|■会場)[:：]?\s*([^■。]+)/)?.[1]?.trim();
    events.push({
      id: `official-schedule-${stableHash(`${year}-${month}-${day}-${title}`)}`,
      title,
      series,
      category,
      startAt: toIsoDate(year, month, day),
      timezone: "Asia/Tokyo",
      venue,
      description: body,
      source: "official-schedule",
      sourceUrl: SCHEDULE_URL
    });
  }

  return events;
}

function extractSeries(value: string): string[] {
  const known = ["ラブライブ！", "サンシャイン!!", "虹ヶ咲学園", "スーパースター!!", "蓮ノ空女学院", "幻日のヨハネ", "ミュージカル"];
  const found = known.filter((series) => value.includes(series));
  return found.length > 0 ? found : ["LoveLive!"];
}
