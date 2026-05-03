import type { DataResult, Env, MusicItem } from "../types";
import { MUSIC_QUERY_ALIASES } from "../data/musicAliases";
import fixtureMusic from "../fixtures/music.json";
import { fetchOfficialMusic } from "../adapters/officialMusic";
import { normalizeSearchText } from "../utils/text";
import { isFresh, readCached, writeCached } from "./cache";

const CACHE_KEY = "music:official:v3";
const TTL_SECONDS = 24 * 60 * 60;

interface MusicQuery {
  q?: string | null;
  series?: string | null;
  album?: string | null;
  artist?: string | null;
  from?: string | null;
  to?: string | null;
  source?: string | null;
}

export async function getMusic(env: Env, query: MusicQuery = {}, forceRefresh = false): Promise<DataResult<MusicItem[]>> {
  const mode = env.UPSTREAM_MODE === "live" ? "live" : "fixture";
  const cached = await readCached<MusicItem[]>(env, CACHE_KEY);
  if (!forceRefresh && cached && isFresh(cached)) {
    const data = filterMusic(cached.data, query);
    return { data, meta: { count: data.length, source: cached.source, refreshedAt: cached.refreshedAt, upstreamMode: mode } };
  }

  if (mode === "fixture") {
    const data = fixtureMusic as MusicItem[];
    const envelope = await writeCached(env, CACHE_KEY, data, TTL_SECONDS, "fixture");
    const filtered = filterMusic(data, query);
    return { data: filtered, meta: { count: filtered.length, source: envelope.source, refreshedAt: envelope.refreshedAt, upstreamMode: mode } };
  }

  try {
    const data = await fetchOfficialMusic();
    if (data.length === 0) throw new Error("no music parsed");
    const envelope = await writeCached(env, CACHE_KEY, data, TTL_SECONDS, "official-music");
    const filtered = filterMusic(data, query);
    return { data: filtered, meta: { count: filtered.length, source: envelope.source, refreshedAt: envelope.refreshedAt, upstreamMode: mode } };
  } catch {
    const fallback = cached?.data ?? (fixtureMusic as MusicItem[]);
    const filtered = filterMusic(fallback, query);
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

export async function getMusicById(env: Env, id: string): Promise<DataResult<MusicItem | undefined>> {
  const result = await getMusic(env);
  return {
    data: result.data.find((item) => item.id === id),
    meta: result.meta
  };
}

export function filterMusic(items: MusicItem[], query: MusicQuery): MusicItem[] {
  const qTerms = query.q ? expandMusicQuery(query.q) : [];
  const series = query.series ? normalizeSearchText(query.series) : "";
  const album = query.album ? normalizeSearchText(query.album) : "";
  const artist = query.artist ? normalizeSearchText(query.artist) : "";
  const source = query.source ? normalizeSearchText(query.source) : "";
  const from = query.from ? Date.parse(query.from) : undefined;
  const to = query.to ? Date.parse(query.to) : undefined;

  return items
    .filter((item) => {
      const releaseTime = item.releaseDate ? Date.parse(item.releaseDate) : undefined;
      if (from && releaseTime && releaseTime < from) return false;
      if (to && releaseTime && releaseTime > to) return false;
      if (series && !item.series.some((value) => normalizeSearchText(value).includes(series))) return false;
      if (album && !normalizeSearchText(item.albumTitle).includes(album)) return false;
      if (artist && !normalizeSearchText(item.artist ?? "").includes(artist)) return false;
      if (source && normalizeSearchText(item.source) !== source) return false;
      if (qTerms.length > 0) {
        const haystack = [item.id, item.title, item.artist, item.albumTitle, item.source, item.sourceUrl, ...item.series]
          .filter(Boolean)
          .map((value) => normalizeSearchText(String(value)))
          .join("|");
        if (!qTerms.some((term) => haystack.includes(term))) return false;
      }
      return true;
    })
    .sort((left, right) => compareMusicItems(left, right, qTerms));
}

function expandMusicQuery(value: string): string[] {
  const normalized = normalizeSearchText(value);
  const aliases =
    MUSIC_QUERY_ALIASES[normalized] ??
    Object.entries(MUSIC_QUERY_ALIASES).find(([key]) => normalizeSearchText(key) === normalized)?.[1] ??
    [];
  return [...new Set([normalized, ...aliases.map((alias) => normalizeSearchText(alias))].filter(Boolean))];
}

function compareMusicItems(left: MusicItem, right: MusicItem, qTerms: string[]): number {
  if (qTerms.length > 0) {
    const scoreDiff = musicQueryScore(right, qTerms) - musicQueryScore(left, qTerms);
    if (scoreDiff !== 0) return scoreDiff;

    if (hasExactTitleMatch(left, qTerms) && hasExactTitleMatch(right, qTerms)) {
      return Date.parse(left.releaseDate ?? "9999-12-31") - Date.parse(right.releaseDate ?? "9999-12-31");
    }
  }

  return Date.parse(right.releaseDate ?? "1970-01-01") - Date.parse(left.releaseDate ?? "1970-01-01");
}

function musicQueryScore(item: MusicItem, qTerms: string[]): number {
  const title = normalizeSearchText(item.title);
  const album = normalizeSearchText(item.albumTitle);
  const artist = normalizeSearchText(item.artist ?? "");
  const source = normalizeSearchText(item.source);
  const series = item.series.map((value) => normalizeSearchText(value)).join("|");
  const haystack = [item.id, title, album, artist, source, item.sourceUrl, series].filter(Boolean).join("|");
  let score = 0;

  for (const term of qTerms) {
    if (title === term) score = Math.max(score, 100);
    else if (title.includes(term)) score = Math.max(score, 80);
    else if (album.includes(term)) score = Math.max(score, 50);
    else if (artist.includes(term)) score = Math.max(score, 40);
    else if (haystack.includes(term)) score = Math.max(score, 10);
  }

  if (item.coverUrl) score += 3;
  if (item.releaseDate) score += 1;
  return score;
}

function hasExactTitleMatch(item: MusicItem, qTerms: string[]): boolean {
  const title = normalizeSearchText(item.title);
  return qTerms.some((term) => title === term);
}
