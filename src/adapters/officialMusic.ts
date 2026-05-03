import type { MusicItem } from "../types";
import { fetchText } from "../services/upstream";
import { decodeHtml, stableHash, stripHtml } from "../utils/text";

export interface MusicSource {
  listUrl: string;
  series: string[];
  source: string;
  limit: number;
  mode?: "detail-list" | "legacy-page";
}

const MUSIC_SOURCES: MusicSource[] = [
  {
    listUrl: "https://www.lovelive-anime.jp/otonokizaka/release.php",
    series: ["μ's"],
    source: "official-otonokizaka-music",
    limit: 0,
    mode: "legacy-page"
  },
  {
    listUrl: "https://www.lovelive-anime.jp/uranohoshi/cd.php",
    series: ["Aqours"],
    source: "official-uranohoshi-music",
    limit: 0,
    mode: "legacy-page"
  },
  {
    listUrl: "https://www.lovelive-anime.jp/nijigasaki/cd.php",
    series: ["虹ヶ咲学園"],
    source: "official-nijigasaki-music",
    limit: 0,
    mode: "legacy-page"
  },
  {
    listUrl: "https://www.lovelive-anime.jp/yuigaoka/music/",
    series: ["Liella!"],
    source: "official-yuigaoka-music",
    limit: 12,
    mode: "detail-list"
  },
  {
    listUrl: "https://www.lovelive-anime.jp/hasunosora/music/cd/",
    series: ["蓮ノ空女学院"],
    source: "official-hasunosora-music",
    limit: 12,
    mode: "detail-list"
  }
];

export async function fetchOfficialMusic(): Promise<MusicItem[]> {
  const results = await Promise.allSettled(MUSIC_SOURCES.map((source) => fetchOfficialMusicSource(source)));
  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

async function fetchOfficialMusicSource(source: MusicSource): Promise<MusicItem[]> {
  const listHtml = await fetchText(source.listUrl, 6 * 60 * 60);
  if (source.mode === "legacy-page") {
    return parseLegacyOfficialMusicPage(listHtml, source.listUrl, source);
  }

  const urls = parseOfficialMusicList(listHtml, source).slice(0, source.limit);
  const details = await Promise.allSettled(
    urls.map(async (sourceUrl) => parseOfficialMusicDetail(await fetchText(sourceUrl, 6 * 60 * 60), sourceUrl, source))
  );
  return details.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

export function parseOfficialMusicList(html: string, source: MusicSource): string[] {
  const urls = new Set<string>();
  const hrefs = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>/g)].map((match) => match[1]);
  for (const href of hrefs) {
    if (source.source === "official-yuigaoka-music" && !/(?:detail\.php\?p=|cd\d+\.php)/.test(href)) continue;
    if (source.source === "official-hasunosora-music" && !/^\.\.\/\d+\/?$/.test(href)) continue;
    urls.add(new URL(href, source.listUrl).toString());
  }
  return [...urls];
}

export function parseOfficialMusicDetail(html: string, sourceUrl: string, source: MusicSource): MusicItem[] {
  const albumTitle = parseAlbumTitle(html) ?? "LoveLive! music";
  const albumType = parseAlbumType(html);
  const releaseDate = parseReleaseDate(html);
  const coverUrl = parseCoverUrl(html, sourceUrl);
  const albumArtist = parseAlbumArtist(html);
  const tracks = parseTracks(html);

  return tracks.map((track) => {
    const key = `${source.source}:${sourceUrl}:${track.trackNumber}:${track.title}`;
    return {
      id: `music-${stableHash(key)}`,
      title: track.title,
      artist: track.artist ?? albumArtist,
      series: source.series,
      albumTitle,
      albumType,
      coverUrl,
      releaseDate,
      trackNumber: track.trackNumber,
      source: source.source,
      sourceUrl
    } satisfies MusicItem;
  });
}

export function parseLegacyOfficialMusicPage(html: string, sourceUrl: string, source: MusicSource): MusicItem[] {
  return extractLegacyAlbumSections(html).flatMap((section) => {
    const albumTitle = parseLegacyAlbumTitle(section.html) ?? "LoveLive! music";
    const releaseDate = parseLegacyReleaseDate(section.html);
    const coverUrl = parseLegacyCoverUrl(section.html, sourceUrl);
    const albumArtist = parseLegacyAlbumArtist(section.html);
    const tracks = parseLegacyTracks(section.html);
    const albumSourceUrl = section.id ? `${sourceUrl}#${section.id}` : sourceUrl;

    return tracks.map((track) => {
      const key = `${source.source}:${albumSourceUrl}:${track.trackNumber}:${track.title}`;
      return {
        id: `music-${stableHash(key)}`,
        title: track.title,
        artist: track.artist ?? albumArtist,
        series: source.series,
        albumTitle,
        albumType: "CD",
        coverUrl,
        releaseDate,
        trackNumber: track.trackNumber,
        source: source.source,
        sourceUrl: albumSourceUrl
      } satisfies MusicItem;
    });
  });
}

function extractLegacyAlbumSections(html: string): Array<{ id?: string; html: string }> {
  const starts = [
    ...html.matchAll(/(?:<a\s+id="(cd\d+)"\s*><\/a>\s*)?<div\s+class="box"(?:\s+id="([^"]+)")?[^>]*>/gi)
  ];
  return starts
    .map((match, index) => {
      const start = match.index ?? 0;
      const end = starts[index + 1]?.index ?? html.length;
      const sectionHtml = html.slice(start, end);
      const id = match[2] ?? match[1] ?? sectionHtml.match(/<a\s+id="(cd\d+)"/i)?.[1];
      return { id, html: sectionHtml };
    })
    .filter((section) => /【収録(?:曲|内容)】/.test(section.html) && parseLegacyAlbumTitle(section.html) != null);
}

function parseLegacyAlbumTitle(html: string): string | undefined {
  const labeled = readLegacyLabel(html, "タイトル");
  if (labeled) return compactText(labeled);

  const titleHtml =
    html.match(/<div\s+class="titlebase"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
    html.match(/<div\s+class="llbox"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
    html.match(/<div\s+class="title"[^>]*>([\s\S]*?)<\/div>/i)?.[1];

  const title = stripHtml(titleHtml ?? "");
  return title ? compactText(title) : undefined;
}

function parseLegacyReleaseDate(html: string): string | undefined {
  const original = html.match(/オリジナル盤発売日[:：]\s*(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (original) return formatDateParts(original[1], original[2], original[3]);

  const release = readLegacyLabel(html, "発売日") ?? stripHtml(html);
  const japanese = release.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  return japanese ? formatDateParts(japanese[1], japanese[2], japanese[3]) : undefined;
}

function parseLegacyCoverUrl(html: string, sourceUrl: string): string | undefined {
  const cover = html.match(/<div\s+class="cover"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i)?.[1];
  return cover ? new URL(cover, sourceUrl).toString() : undefined;
}

function parseLegacyAlbumArtist(html: string): string | undefined {
  const artist = readLegacyLabel(html, "アーティスト");
  return artist?.split("\n").map((line) => line.trim()).filter(Boolean)[0];
}

function parseLegacyTracks(html: string): Array<{ trackNumber: number; title: string; artist?: string }> {
  const trackHtml = readLegacyLabelHtml(html, "収録曲") ?? readLegacyLabelHtml(html, "収録内容") ?? "";
  const lines = legacyTrackLines(trackHtml);
  const tracks: Array<{ trackNumber: number; title: string; artist?: string }> = [];

  for (const line of lines) {
    const match = line.match(/^(\d{1,2})[.．]\s*(.+)$/);
    if (!match) continue;
    const title = cleanTrackTitle(match[2]);
    if (!title) continue;
    tracks.push({ trackNumber: Number(match[1]), title });
  }

  return tracks;
}

function parseAlbumTitle(html: string): string | undefined {
  const hasuLead = stripHtml(html.match(/<span class="head--title__lead">([\s\S]*?)<\/span>/)?.[1] ?? "");
  const hasuMain = stripHtml(html.match(/<span class="head--title__main">([\s\S]*?)<\/span>/)?.[1] ?? "");
  if (hasuLead && hasuMain) return `${hasuLead}「${hasuMain}」`.trim();
  if (hasuLead || hasuMain) return (hasuLead || hasuMain).trim();

  const yuigaokaTitle = stripHtml(html.match(/<div class="title">([\s\S]*?)<\/div>/)?.[1] ?? "");
  if (yuigaokaTitle) return yuigaokaTitle.replace(/\s+/g, " ").trim();

  return stripHtml(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "")
    ?.split(/[｜|]/)[0]
    ?.trim();
}

function parseAlbumType(html: string): string | undefined {
  return (
    stripHtml(html.match(/<p class="head--category">\s*<span>([\s\S]*?)<\/span>/)?.[1] ?? "") ||
    stripHtml(html.match(/<h2>\s*(CD|Blu-ray|配信限定)\s*<\/h2>/)?.[1] ?? "")
  );
}

function parseReleaseDate(html: string): string | undefined {
  const dotted = html.match(/<p class="head--date">\s*(20\d{2})\.(\d{1,2})\.(\d{1,2})\s*<\/p>/);
  if (dotted) return `${dotted[1]}-${dotted[2].padStart(2, "0")}-${dotted[3].padStart(2, "0")}`;

  const block = readSpecBlock(html, "発売日") ?? stripHtml(html);
  const japanese = block?.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (!japanese) return undefined;
  return `${japanese[1]}-${japanese[2].padStart(2, "0")}-${japanese[3].padStart(2, "0")}`;
}

function parseCoverUrl(html: string, sourceUrl: string): string | undefined {
  const hasuJacket = html.match(/<div class="jacket--image">[\s\S]*?<img[^>]+src="([^"]+)"/i)?.[1];
  if (hasuJacket) return new URL(hasuJacket, sourceUrl).toString();

  const yuigaokaJacket = html.match(/<div class="cover">[\s\S]*?background-image:\s*url\(([^)]+)\)/i)?.[1]?.replace(/^['"]|['"]$/g, "");
  if (yuigaokaJacket) return new URL(yuigaokaJacket, sourceUrl).toString();

  const background = html.match(/background-image:\s*url\(([^)]+)\)/)?.[1]?.replace(/^['"]|['"]$/g, "");
  if (background) return new URL(background, sourceUrl).toString();

  const jacket = html.match(/<(?:div|span)[^>]+(?:jacket|cover)[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i)?.[1];
  if (jacket) return new URL(jacket, sourceUrl).toString();
  return undefined;
}

function parseAlbumArtist(html: string): string | undefined {
  const spec = readSpecBlock(html, "アーティスト");
  return spec?.split("\n").map((line) => line.trim()).filter(Boolean)[0];
}

function parseTracks(html: string): Array<{ trackNumber: number; title: string; artist?: string }> {
  const trackBlocks = [...html.matchAll(/<li>\s*<p class="head">([\s\S]*?)<\/p>([\s\S]*?)(?=<\/li>)/g)];
  if (trackBlocks.length > 0) {
    return trackBlocks.map((match) => parseTrack(stripHtml(match[1]) ?? "", stripHtml(match[2]) ?? "")).filter(isTrack);
  }

  const listHtml = html.match(/<p class="list">([\s\S]*?)<\/p>/)?.[1] ?? readSpecBlockHtml(html, "収録内容") ?? "";
  const lines = htmlToLines(listHtml);
  const tracks: Array<{ trackNumber: number; title: string; artist?: string }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trackLine = lines[index].match(/^(\d{1,2})\.\s*(.+)$/);
    if (!trackLine) continue;
    const title = cleanTrackTitle(trackLine[2]);
    if (!title) continue;
    const nextLines = lines.slice(index + 1, index + 8);
    tracks.push({
      trackNumber: Number(trackLine[1]),
      title,
      artist: parseTrackArtist(nextLines.join("\n"))
    });
  }
  return tracks;
}

function parseTrack(head: string, body: string): { trackNumber: number; title: string; artist?: string } | undefined {
  const match = head.match(/^(\d{1,2})\.\s*(.+)$/);
  if (!match) return undefined;
  const title = cleanTrackTitle(match[2]);
  if (!title) return undefined;
  return {
    trackNumber: Number(match[1]),
    title,
    artist: parseTrackArtist(body)
  };
}

function cleanTrackTitle(value: string): string | undefined {
  const title = decodeHtml(value).replace(/\s+/g, " ").trim();
  if (!title || /\(Off Vocal\)|（Off Vocal）|off vocal/i.test(title)) return undefined;
  return title;
}

function parseTrackArtist(value: string): string | undefined {
  return value.match(/歌\s*[:：]\s*([^\n]+)/)?.[1]?.trim();
}

function readLegacyLabel(html: string, label: string): string | undefined {
  const block = readLegacyLabelHtml(html, label);
  return block ? htmlToLines(block).join("\n") : undefined;
}

function readLegacyLabelHtml(html: string, label: string): string | undefined {
  if (/^収録/.test(label)) {
    const trackLists = [...html.matchAll(/<ul\s+class="track"[^>]*>[\s\S]*?<\/ul>/gi)].map((match) => match[0]);
    if (trackLists.length > 0) return trackLists.join("\n");
  }

  const spec = readSpecBlockHtml(html, label);
  if (spec) return spec;

  const escaped = escapeRegExp(label);
  return html.match(new RegExp(`【${escaped}】\\s*<br\\s*\\/?>\\s*([\\s\\S]*?)(?=<br\\s*\\/?>\\s*【|<\\/div>|<\\/dd>|$)`, "i"))?.[1];
}

function readSpecBlock(html: string, label: string): string | undefined {
  const block = readSpecBlockHtml(html, label);
  return block ? htmlToLines(block).join("\n") : undefined;
}

function readSpecBlockHtml(html: string, label: string): string | undefined {
  return (
    html.match(new RegExp(`<h4>\\s*${label}\\s*<\\/h4>\\s*<div class="spec--block__text">([\\s\\S]*?)<\\/div>`, "i"))?.[1] ??
    html.match(new RegExp(`<dt>\\s*【${label}】\\s*<\\/dt>\\s*<dd>([\\s\\S]*?)<\\/dd>`, "i"))?.[1]
  );
}

function htmlToLines(html: string): string[] {
  return decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u3000/g, " ")
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function legacyTrackLines(html: string): string[] {
  return decodeHtml(
    html
      .replace(/<span[^>]*class="uta"[^>]*>[\s\S]*?<\/span>/gi, "\n")
      .replace(/<dl[\s\S]*?<\/dl>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u3000/g, " ")
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function compactText(value: string): string {
  return decodeHtml(value).replace(/\s+/g, " ").trim();
}

function formatDateParts(year: string, month: string, day: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isTrack(value: { trackNumber: number; title: string; artist?: string } | undefined): value is { trackNumber: number; title: string; artist?: string } {
  return value != null;
}
