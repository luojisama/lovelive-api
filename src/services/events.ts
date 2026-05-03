import type { DataResult, Env, EventItem } from "../types";
import fixtureEvents from "../fixtures/events.json";
import { fetchLlchTimelineEvents } from "../adapters/llchTimeline";
import { fetchOfficialNewsEvents } from "../adapters/officialNews";
import { fetchOfficialSchedule } from "../adapters/officialSchedule";
import { fetchRsshubEvents } from "../adapters/rsshubSchedule";
import { isFresh, readCached, writeCached } from "./cache";
import { normalizeSearchText, stableHash } from "../utils/text";

const CACHE_KEY = "events:normalized:v5";
const TTL_SECONDS = 3 * 60 * 60;

interface EventQuery {
  from?: string | null;
  to?: string | null;
  series?: string | null;
  category?: string | null;
  source?: string | null;
}

export async function getEvents(env: Env, query: EventQuery = {}, forceRefresh = false): Promise<DataResult<EventItem[]>> {
  const mode = env.UPSTREAM_MODE === "live" ? "live" : "fixture";
  const cached = await readCached<EventItem[]>(env, CACHE_KEY);
  if (!forceRefresh && cached && isFresh(cached)) {
    const data = filterEvents(cached.data, query);
    return { data, meta: { count: data.length, source: cached.source, refreshedAt: cached.refreshedAt, upstreamMode: mode } };
  }

  if (mode === "fixture") {
    const data = fixtureEvents as EventItem[];
    const envelope = await writeCached(env, CACHE_KEY, data, TTL_SECONDS, "fixture");
    const filtered = filterEvents(data, query);
    return { data: filtered, meta: { count: filtered.length, source: envelope.source, refreshedAt: envelope.refreshedAt, upstreamMode: mode } };
  }

  try {
    const sourceResults = await Promise.allSettled([fetchOfficialSchedule(), fetchLlchTimelineEvents(), fetchOfficialNewsEvents(), fetchRsshubEvents(env)]);
    const data = dedupeEvents(sourceResults.flatMap((result) => (result.status === "fulfilled" ? result.value : [])));
    if (data.length === 0) throw new Error("no live events parsed");
    const envelope = await writeCached(env, CACHE_KEY, data, TTL_SECONDS, "live");
    const filtered = filterEvents(data, query);
    return { data: filtered, meta: { count: filtered.length, source: envelope.source, refreshedAt: envelope.refreshedAt, upstreamMode: mode } };
  } catch {
    const fallback = cached?.data ?? (fixtureEvents as EventItem[]);
    const filtered = filterEvents(fallback, query);
    return {
      data: filtered,
      meta: {
        count: filtered.length,
        source: cached?.source ?? "fixture",
        refreshedAt: cached?.refreshedAt,
        stale: true,
        upstreamMode: mode
      }
    };
  }
}

export async function getEventById(env: Env, id: string): Promise<DataResult<EventItem | undefined>> {
  const result = await getEvents(env);
  return {
    data: result.data.find((event) => event.id === id),
    meta: result.meta
  };
}

export function filterEvents(events: EventItem[], query: EventQuery): EventItem[] {
  const from = query.from ? Date.parse(query.from) : undefined;
  const to = query.to ? Date.parse(query.to) : undefined;
  const series = query.series ? normalizeSearchText(query.series) : "";
  const category = query.category ? normalizeSearchText(query.category) : "";
  const source = query.source ? normalizeSearchText(query.source) : "";

  return events
    .filter((event) => {
      const startAt = Date.parse(event.startAt);
      if (from && startAt < from) return false;
      if (to && startAt > to) return false;
      if (series && !event.series.some((value) => normalizeSearchText(value).includes(series))) return false;
      if (category && normalizeSearchText(event.category) !== category) return false;
      if (source && normalizeSearchText(event.source) !== source) return false;
      return true;
    })
    .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt));
}

export function dedupeEvents(events: EventItem[]): EventItem[] {
  const seen = new Map<string, EventItem>();
  for (const event of events) {
    const key =
      event.source !== "llch-timeline" && event.sourceUrl && event.sourceUrl !== "https://www.lovelive-anime.jp/schedule/"
        ? `${event.source}:${event.sourceUrl}`
        : `${normalizeSearchText(event.title)}:${event.startAt}:${normalizeSearchText(event.venue ?? "")}`;
    if (!seen.has(key)) {
      seen.set(key, { ...event, id: event.id || `event-${stableHash(key)}` });
    }
  }
  return [...seen.values()];
}
