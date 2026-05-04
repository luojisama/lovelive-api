import type { MusicItem } from "../types";
import { fetchText } from "./upstream";
import { decodeHtml, stripHtml } from "../utils/text";

const IMAGE_TTL_SECONDS = 7 * 24 * 60 * 60;
const MUSIC_COVER_ROUTE = "/v1/images/music-cover";
const ALLOWED_IMAGE_HOSTS = new Set([
  "www.lovelive-anime.jp",
  "lovelive-anime.jp",
  "catalog.bandainamcomusiclive.co.jp"
]);

interface BnmlSearchResult {
  releaseUrl: string;
  imageUrl: string;
  releaseDate?: string;
  title?: string;
}

export function withMusicCoverProxy(item: MusicItem, origin: string): MusicItem {
  if (!item.coverUrl && !item.albumTitle) return item;

  const originalCoverUrl = item.coverOriginalUrl ?? item.coverUrl;
  const proxyUrl = createMusicCoverProxyUrl(origin, {
    url: originalCoverUrl,
    albumTitle: item.albumTitle,
    releaseDate: item.releaseDate
  });

  return {
    ...item,
    coverUrl: proxyUrl,
    coverOriginalUrl: originalCoverUrl,
    coverSourceUrl: item.coverSourceUrl ?? item.sourceUrl
  };
}

export function createMusicCoverProxyUrl(
  origin: string,
  params: { url?: string; albumTitle?: string; releaseDate?: string }
): string {
  const url = new URL(MUSIC_COVER_ROUTE, origin);
  if (params.url) url.searchParams.set("url", params.url);
  if (params.albumTitle) url.searchParams.set("albumTitle", params.albumTitle);
  if (params.releaseDate) url.searchParams.set("releaseDate", params.releaseDate);
  return url.toString();
}

export async function proxyMusicCover(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const originalUrl = requestUrl.searchParams.get("url") ?? undefined;
  const albumTitle = requestUrl.searchParams.get("albumTitle") ?? undefined;
  const releaseDate = requestUrl.searchParams.get("releaseDate") ?? undefined;

  if (!originalUrl && !albumTitle) {
    return new Response(JSON.stringify({ error: { code: "INVALID_IMAGE_REQUEST", message: "url 或 albumTitle 至少需要一个" } }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  if (originalUrl) {
    const direct = await fetchAllowedImage(originalUrl);
    if (direct) return direct;
  }

  const fallbackUrl = albumTitle ? await findBnmlCoverUrl(albumTitle, releaseDate) : undefined;
  if (fallbackUrl) {
    const fallback = await fetchAllowedImage(fallbackUrl);
    if (fallback) return fallback;
  }

  return new Response(JSON.stringify({ error: { code: "IMAGE_NOT_FOUND", message: "未找到可用封面图" } }), {
    status: 502,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export function parseBnmlSearchResults(html: string): BnmlSearchResult[] {
  return [...html.matchAll(/<li>\s*<a\s+href="(https:\/\/catalog\.bandainamcomusiclive\.co\.jp\/release\/\d+\/)">([\s\S]*?)<\/a>\s*<\/li>/gi)]
    .map((match): BnmlSearchResult | undefined => {
      const block = match[2];
      const imageUrl = block.match(/<img[^>]+src="(https:\/\/catalog\.bandainamcomusiclive\.co\.jp\/wp-content\/uploads\/[^"]+)"/i)?.[1];
      if (!imageUrl) return undefined;
      const dateText = stripHtml(block.match(/<div\s+class="time"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
      const title = stripHtml(block.match(/<h3\s+class="title"[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? "");
      const result: BnmlSearchResult = {
        releaseUrl: match[1],
        imageUrl: decodeHtml(imageUrl)
      };
      const releaseDate = parseBnmlDate(dateText);
      if (releaseDate) result.releaseDate = releaseDate;
      if (title) result.title = title;
      return result;
    })
    .filter((result): result is BnmlSearchResult => result != null);
}

function createBnmlSearchTerms(albumTitle: string): string[] {
  const terms = [
    ...[...albumTitle.matchAll(/[「『](.*?)[」』]/g)].map((match) => match[1]),
    albumTitle
      .replace(/[【〖].*?[】〗]/g, " ")
      .replace(/^[^「『]*[「『]/, "")
      .replace(/[」』].*$/, "")
      .trim(),
    albumTitle.replace(/[【〖].*?[】〗]/g, " ").replace(/\s+/g, " ").trim()
  ];

  return [...new Set(terms.map((term) => term.replace(/\s+/g, " ").trim()).filter((term) => term.length >= 2))].slice(0, 4);
}

async function findBnmlCoverUrl(albumTitle: string, releaseDate?: string): Promise<string | undefined> {
  for (const term of createBnmlSearchTerms(albumTitle)) {
    const searchUrl = `https://catalog.bandainamcomusiclive.co.jp/?s=${encodeURIComponent(term)}`;
    const html = await fetchText(searchUrl, 6 * 60 * 60);
    const results = parseBnmlSearchResults(html);
    if (results.length === 0) continue;

    const dated = releaseDate ? results.find((result) => result.releaseDate === releaseDate) : undefined;
    return dated?.imageUrl ?? results[0].imageUrl;
  }
  return undefined;
}

async function fetchAllowedImage(url: string): Promise<Response | undefined> {
  const parsed = parseAllowedImageUrl(url);
  if (!parsed) return undefined;

  const cache = (globalThis.caches as unknown as { default?: Cache } | undefined)?.default;
  const request = new Request(parsed.toString(), {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 lovelive-api/0.1",
      "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "referer": refererFor(parsed)
    }
  });

  const cached = await cache?.match(request);
  if (cached) return addImageHeaders(cached);

  const response = await fetch(request);
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.toLowerCase().startsWith("image/")) return undefined;

  const image = new Response(response.body, {
    headers: {
      "cache-control": `public, max-age=${IMAGE_TTL_SECONDS}`,
      "content-type": contentType,
      "access-control-allow-origin": "*"
    }
  });
  await cache?.put(request, image.clone());
  return image;
}

function parseAllowedImageUrl(url: string): URL | undefined {
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) return undefined;
    if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function addImageHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("cache-control", headers.get("cache-control") ?? `public, max-age=${IMAGE_TTL_SECONDS}`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function refererFor(url: URL): string {
  if (url.hostname === "catalog.bandainamcomusiclive.co.jp") return "https://catalog.bandainamcomusiclive.co.jp/";
  return "https://www.lovelive-anime.jp/";
}

function parseBnmlDate(value: string): string | undefined {
  const match = value.match(/(20\d{2})\.(\d{1,2})\.(\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : undefined;
}
