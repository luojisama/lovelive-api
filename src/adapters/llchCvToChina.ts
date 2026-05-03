import type { EventItem } from "../types";
import { fetchText } from "../services/upstream";
import { decodeHtml, stableHash, stripHtml } from "../utils/text";

const CV_TO_CHINA_URL = "https://ll-ch.com/main/cvtochina/";
const TIMEZONE = "Asia/Shanghai";

export async function fetchLlchCvToChinaEvents(now = new Date()): Promise<EventItem[]> {
  const html = await fetchText(CV_TO_CHINA_URL, 30 * 60);
  return parseLlchCvToChinaHtml(html, now);
}

export function parseLlchCvToChinaHtml(html: string, now = new Date()): EventItem[] {
  const year = getShanghaiYear(now);
  const rows = [...html.replace(/<!--[\s\S]*?-->/g, " ").matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((match) => match[1]);
  return rows
    .map((row) => parseRow(row, year))
    .filter((event): event is EventItem => event != null);
}

function parseRow(row: string, year: number): EventItem | undefined {
  const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => cleanCell(match[1]));
  if (cells.length < 4) return undefined;
  const [dateText, title, timeText, venue, organizer, approval] = cells;
  const date = parseMonthDay(dateText, year);
  if (!date || !title) return undefined;
  const { hour, minute } = parseTime(timeText);
  const startAt = `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`;
  const key = `${title}:${startAt}:${venue}`;
  return {
    id: `llch-cv-${stableHash(key)}`,
    title,
    series: ["LoveLive!"],
    category: "event",
    startAt,
    timezone: TIMEZONE,
    venue,
    performers: extractPerformers(title),
    description: [organizer ? `报审/主办：${organizer}` : "", approval ? `批准文号：${approval}` : ""].filter(Boolean).join("\n"),
    source: "llch-cvtochina",
    sourceUrl: CV_TO_CHINA_URL
  };
}

function parseMonthDay(value: string, year: number): string | undefined {
  const match = value.match(/(\d{1,2})[./月-](\d{1,2})/);
  if (!match) return undefined;
  return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function parseTime(value: string): { hour: number; minute: number } {
  const match = value.match(/(\d{1,2})[:：](\d{2})/);
  return {
    hour: match ? Number(match[1]) : 0,
    minute: match ? Number(match[2]) : 0
  };
}

function extractPerformers(title: string): string[] | undefined {
  const known = ["結那", "逢田梨香子", "斉藤朱夏", "伊波杏樹", "小林愛香", "大西亜玖璃", "相良茉優", "Liyuu"];
  const performers = known.filter((name) => title.includes(name));
  return performers.length > 0 ? performers : undefined;
}

function getShanghaiYear(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      year: "numeric"
    })
      .formatToParts(date)
      .find((part) => part.type === "year")?.value
  );
}

function cleanCell(html: string): string {
  return decodeHtml(stripHtml(html.replace(/<br\s*\/?>/gi, "\n")) ?? "")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}
