import type { Character, DataResult, Env } from "../types";
import fixtureCharacters from "../fixtures/characters.json";
import { applyMoegirlMetadata, fetchMoegirlCharacters } from "../adapters/moegirlCharacters";
import { getMonthDayInTimezone } from "../utils/date";
import { normalizeSearchText } from "../utils/text";
import { isFresh, readCached, writeCached } from "./cache";

const CACHE_KEY = "characters:normalized:v2";
const TTL_SECONDS = 7 * 24 * 60 * 60;

interface CharacterQuery {
  group?: string | null;
  q?: string | null;
  birthdayMonth?: string | null;
}

export async function getCharacters(env: Env, query: CharacterQuery = {}, forceRefresh = false): Promise<DataResult<Character[]>> {
  const mode = env.UPSTREAM_MODE === "live" ? "live" : "fixture";
  const cached = await readCached<Character[]>(env, CACHE_KEY);

  if (!forceRefresh && cached) {
    const data = filterCharacters(applyMoegirlMetadata(cached.data), query);
    return {
      data,
      meta: {
        count: data.length,
        source: cached.source,
        refreshedAt: cached.refreshedAt,
        upstreamMode: mode,
        ...(isFresh(cached) ? {} : { stale: true })
      }
    };
  }

  if (forceRefresh && mode === "live") {
    try {
      const data = await fetchMoegirlCharacters(fixtureCharacters as Character[]);
      const envelope = await writeCached(env, CACHE_KEY, data, TTL_SECONDS, "moegirl");
      const filtered = filterCharacters(data, query);
      return { data: filtered, meta: { count: filtered.length, source: envelope.source, refreshedAt: envelope.refreshedAt, upstreamMode: mode } };
    } catch (error) {
      console.warn("[characters] upstream refresh failed", error);
      const fallback = applyMoegirlMetadata(cached?.data ?? (fixtureCharacters as Character[]));
      const filtered = filterCharacters(fallback, query);
      return {
        data: filtered,
        meta: {
          count: filtered.length,
          source: cached?.source ?? "fixture-moegirl",
          refreshedAt: cached?.refreshedAt,
          stale: true,
          upstreamMode: mode
        }
      };
    }
  }

  const data = applyMoegirlMetadata(fixtureCharacters as Character[]);
  const envelope = await writeCached(env, CACHE_KEY, data, TTL_SECONDS, "fixture-moegirl");
  const filtered = filterCharacters(data, query);
  return { data: filtered, meta: { count: filtered.length, source: envelope.source, refreshedAt: envelope.refreshedAt, upstreamMode: mode } };
}

export async function getCharacterById(env: Env, id: string): Promise<DataResult<Character | undefined>> {
  const result = await getCharacters(env);
  return {
    data: result.data.find((character) => character.id === id),
    meta: result.meta
  };
}

export async function getTodayBirthdays(env: Env, timeZone: string, now = new Date()): Promise<DataResult<Character[]>> {
  const result = await getCharacters(env);
  const { month, day } = getMonthDayInTimezone(now, timeZone);
  const data = result.data.filter((character) => character.birthday?.month === month && character.birthday.day === day);
  return {
    data,
    meta: { ...result.meta, count: data.length }
  };
}

export function filterCharacters(characters: Character[], query: CharacterQuery): Character[] {
  const group = query.group ? normalizeSearchText(query.group) : "";
  const search = query.q ? normalizeSearchText(query.q) : "";
  const birthdayMonth = query.birthdayMonth ? Number(query.birthdayMonth) : undefined;

  return characters.filter((character) => {
    if (group && normalizeSearchText(character.group) !== group && normalizeSearchText(character.series) !== group) {
      return false;
    }
    if (birthdayMonth && character.birthday?.month !== birthdayMonth) {
      return false;
    }
    if (search) {
      const haystack = [
        character.id,
        character.group,
        character.series,
        character.names.zhHans,
        character.names.ja,
        character.names.en,
        character.names.romaji,
        ...(character.names.aliases ?? [])
      ]
        .filter(Boolean)
        .map((value) => normalizeSearchText(String(value)))
        .join("|");
      return haystack.includes(search);
    }
    return true;
  });
}
