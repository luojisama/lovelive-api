export type UpstreamMode = "fixture" | "live";

export interface Env {
  CACHE?: KVNamespace;
  UPSTREAM_MODE?: UpstreamMode;
  RSSHUB_BASE_URL?: string;
}

export interface SourceRef {
  name: string;
  url: string;
}

export interface CharacterName {
  zhHans: string;
  ja?: string;
  en?: string;
  romaji?: string;
  aliases?: string[];
}

export interface CharacterColor {
  name: string;
  originalName?: string;
  hex?: string;
}

export interface CharacterBirthday {
  month: number;
  day: number;
  text: string;
}

export interface Character {
  id: string;
  names: CharacterName;
  group: string;
  series: string;
  birthday?: CharacterBirthday;
  color?: CharacterColor;
  avatarUrl?: string | null;
  avatarIconUrl?: string | null;
  avatarIconFilename?: string;
  sourceUrl: string;
  sources: SourceRef[];
}

export interface EventItem {
  id: string;
  title: string;
  series: string[];
  category: string;
  startAt: string;
  endAt?: string;
  timezone: string;
  venue?: string;
  performers?: string[];
  description?: string;
  source: string;
  sourceUrl: string;
}

export interface ApiMeta {
  count?: number;
  source?: string;
  refreshedAt?: string;
  stale?: boolean;
  upstreamMode?: UpstreamMode;
}

export interface CacheEnvelope<T> {
  data: T;
  refreshedAt: string;
  expiresAt: string;
  source: string;
}

export interface DataResult<T> {
  data: T;
  meta: ApiMeta;
}

export type CardGame = "sif" | "sifas" | "sif2";
