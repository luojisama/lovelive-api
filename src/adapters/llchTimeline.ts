import type { EventItem } from "../types";
import { fetchText } from "../services/upstream";
import { decodeHtml, stableHash, stripHtml } from "../utils/text";

const LLCH_TIMELINE_URL = "https://ll-ch.com/timeline.html";
const TIMEZONE = "Asia/Shanghai";

export async function fetchLlchTimelineEvents(now = new Date()): Promise<EventItem[]> {
  const html = await fetchText(LLCH_TIMELINE_URL, 30 * 60);
  return parseLlchTimelineHtml(html, now);
}

export function parseLlchTimelineHtml(html: string, now = new Date()): EventItem[] {
  const yearContext = getShanghaiYearMonth(now);
  const blocks = [...html.matchAll(/<div class="cd-timeline-block">([\s\S]*?)(?=\s*<div class="cd-timeline-block">|\s*<\/section>)/g)].map(
    (match) => match[1]
  );

  return blocks.flatMap((block) => parseLlchTimelineBlock(block, yearContext));
}

function parseLlchTimelineBlock(block: string, yearContext: { year: number; month: number }): EventItem[] {
  const title = cleanTitle(readElement(block, "h2") ?? "");
  const descriptionHtml = readElement(block, "p") ?? "";
  const lines = htmlToLines(descriptionHtml);
  const dateLines = lines.filter((line) => /\d{1,2}\s*月\s*\d{1,2}\s*日/.test(line));
  if (!title || dateLines.length === 0) return [];

  const description = lines.join("\n");
  const venue = readLineValue(lines, "活动场馆") ?? readLineValue(lines, "会场") ?? cleanText(block.match(/<span class="cd-date">([\s\S]*?)<\/span>/)?.[1]);
  const performers = parsePerformers(description);
  const sourceUrl = absoluteUrl(block.match(/<a[^>]+class="[^"]*btn-official[^"]*"[^>]+href="([^"]+)"/)?.[1]);
  const series = extractSeries(`${title}\n${description}\n${venue ?? ""}`);
  const category = normalizeLlchCategory(`${title}\n${description}`);

  return dateLines.flatMap((line) => {
    const dates = parseLlchDateLine(line, yearContext);
    return dates.map((date, index) => {
      const label = date.label || (dates.length > 1 ? `DAY${index + 1}` : "");
      const eventTitle = label ? `${title} ${label}` : title;
      const key = `${eventTitle}-${date.startAt}-${sourceUrl}`;
      return {
        id: `llch-${stableHash(key)}`,
        title: eventTitle,
        series,
        category,
        startAt: date.startAt,
        endAt: date.endAt,
        timezone: TIMEZONE,
        venue,
        performers,
        description,
        source: "llch-timeline",
        sourceUrl
      } satisfies EventItem;
    });
  });
}

function parseLlchDateLine(line: string, yearContext: { year: number; month: number }): Array<{ label?: string; startAt: string; endAt?: string }> {
  const normalized = line.replace(/\s+/g, " ").trim();
  const label = normalized.match(/\b(DAY\s*\d+|Day\.\s*\d+|昼公演|夜公演)\b/i)?.[1]?.replace(/\s+/g, "");
  const datePattern =
    /(?:(DAY\s*\d+|Day\.\s*\d+|昼公演|夜公演)\s*[-－:：]?\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日(?:[（(][^)）]+[)）])?\s*(?:(\d{1,2})[:：](\d{2}))?(?:\s*[－\-~～]\s*(\d{1,2})[:：](\d{2}))?/gi;
  const matches = [...normalized.matchAll(datePattern)];
  return matches.map((match) => {
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = match[4] == null ? 0 : Number(match[4]);
    const minute = match[5] == null ? 0 : Number(match[5]);
    const endHour = match[6] == null ? undefined : Number(match[6]);
    const endMinute = match[7] == null ? undefined : Number(match[7]);
    const year = inferYear(month, yearContext);
    const startAt = toShanghaiIso(year, month, day, hour, minute);
    const endAt =
      endHour == null || endMinute == null
        ? undefined
        : toShanghaiIso(year, month, day, endHour, endMinute, endHour < hour ? 1 : 0);
    return { label: (match[1] ?? label)?.replace(/\s+/g, ""), startAt, endAt };
  });
}

function inferYear(month: number, context: { year: number; month: number }): number {
  if (context.month >= 10 && month <= 3) return context.year + 1;
  return context.year;
}

function toShanghaiIso(year: number, month: number, day: number, hour: number, minute: number, addDays = 0): string {
  const date = new Date(Date.UTC(year, month - 1, day + addDays));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`;
}

function getShanghaiYearMonth(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "numeric"
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value)
  };
}

function normalizeLlchCategory(value: string): string {
  if (/live|ライブ|演唱会|公演|fmt|fan\s*meeting|ファンミ/i.test(value)) return "live";
  if (/生放送|直播|配信|节目|番組|地上波|ラジオ|ちゅーとりえら/i.test(value)) return "stream";
  return "event";
}

function extractSeries(value: string): string[] {
  const seriesMap: Array<[RegExp, string]> = [
    [/μ's|ミューズ|muse/i, "μ's"],
    [/Aqours|サンシャイン/i, "Aqours"],
    [/虹ヶ咲|虹咲|nijigasaki/i, "虹ヶ咲学園"],
    [/Liella|結丘|スーパースター/i, "Liella!"],
    [/蓮ノ空|莲之空|hasunosora/i, "蓮ノ空女学院"],
    [/いきづらい部|bluebird/i, "BLUEBIRD"],
    [/ミュージカル|musical/i, "School Idol Musical"]
  ];
  const found = seriesMap.filter(([pattern]) => pattern.test(value)).map(([, name]) => name);
  return found.length > 0 ? found : ["LoveLive!"];
}

function parsePerformers(description: string): string[] | undefined {
  const line = description
    .split("\n")
    .find((value) => value.includes("出演") || value.includes("出　演") || value.includes("出 演"));
  if (!line) return undefined;
  return line
    .replace(/.*(?:出演|出\s*演)\s*[:：]\s*/, "")
    .replace(/[（）()]/g, " ")
    .split(/[、，,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function readLineValue(lines: string[], label: string): string | undefined {
  const line = lines.find((value) => value.includes(label));
  return line?.replace(new RegExp(`.*${label}\\s*[:：]\\s*`), "").trim();
}

function readElement(html: string, tag: string): string | undefined {
  return html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1];
}

function htmlToLines(html: string): string[] {
  return decodeHtml(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u3000/g, " ")
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function cleanTitle(html: string): string {
  return (cleanText(html.replace(/<center[\s\S]*?<\/center>/gi, "")) ?? "")
    .replace(/\s*(重点场次|周更节目|重点|海外|付费|免费)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(html?: string): string | undefined {
  if (!html) return undefined;
  return stripHtml(html).replace(/\s+/g, " ").trim();
}

function absoluteUrl(url?: string): string {
  if (!url) return LLCH_TIMELINE_URL;
  return new URL(url, LLCH_TIMELINE_URL).toString();
}
