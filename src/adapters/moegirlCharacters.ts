import type { Character } from "../types";
import { MOEGIRL_CHARACTER_METADATA } from "../data/characterMetadata";
import { birthdayText, parseMonthDay } from "../utils/date";
import { fetchText } from "../services/upstream";

const MOEGIRL_SOURCE_NAME = "萌娘百科角色页";

export async function fetchMoegirlCharacters(base: Character[]): Promise<Character[]> {
  const seeded = applyMoegirlMetadata(base);
  const enriched = await Promise.all(
    seeded.map(async (character) => {
      const metadata = MOEGIRL_CHARACTER_METADATA[character.id];
      if (!metadata) return character;
      try {
        const html = await fetchText(metadata.pageUrl, 7 * 24 * 60 * 60);
        return mergeParsedMoegirlPage(character, html);
      } catch {
        return character;
      }
    })
  );
  return enriched;
}

export function applyMoegirlMetadata(base: Character[]): Character[] {
  return base.map((character) => {
    const metadata = MOEGIRL_CHARACTER_METADATA[character.id];
    if (!metadata) return character;
    const parsedBirthday = metadata.birthdayText ? parseMonthDay(metadata.birthdayText) : null;
    return {
      ...character,
      birthday: parsedBirthday
        ? { ...parsedBirthday, text: birthdayText(parsedBirthday.month, parsedBirthday.day) }
        : character.birthday,
      color: {
        ...character.color,
        name: character.color?.name ?? "印象色",
        hex: (metadata.colorHex ?? character.color?.hex)?.toLowerCase()
      },
      avatarUrl: metadata.avatarUrl,
      sourceUrl: metadata.pageUrl,
      sources: [{ name: MOEGIRL_SOURCE_NAME, url: metadata.pageUrl }]
    };
  });
}

export function mergeParsedMoegirlPage(character: Character, html: string): Character {
  const parsed = parseMoegirlCharacterPage(html);
  const parsedBirthday = parsed.birthdayText ? parseMonthDay(parsed.birthdayText) : null;
  return {
    ...character,
    birthday: parsedBirthday
      ? { ...parsedBirthday, text: birthdayText(parsedBirthday.month, parsedBirthday.day) }
      : character.birthday,
    color: {
      ...character.color,
      name: character.color?.name ?? "印象色",
      hex: (parsed.colorHex ?? character.color?.hex)?.toLowerCase()
    },
    avatarUrl: parsed.avatarUrl ?? character.avatarUrl
  };
}

export function parseMoegirlCharacterPage(html: string): { birthdayText?: string; colorHex?: string; avatarUrl?: string } {
  const birthdayTextContent = stripTags(html.match(/<th[^>]*>\s*生日\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/)?.[1]);
  const nameCell = html.match(/<span itemprop="name">([\s\S]*?)<\/span>\s*<\/td>/)?.[1] ?? "";
  const colorHex = nameCell.match(/title="(#[0-9a-fA-F]{6})"/)?.[1] ?? nameCell.match(/background:\s*(#[0-9a-fA-F]{6})/)?.[1];
  const avatarUrl = parseFirstCharacterImage(html);
  return { birthdayText: birthdayTextContent, colorHex, avatarUrl };
}

function parseFirstCharacterImage(html: string): string | undefined {
  const tags = [...html.matchAll(/<img[^>]+>/g)].map((match) => match[0]);
  for (const tag of tags) {
    const src = absoluteUrl(readAttribute(tag, "src"));
    const width = Number(readAttribute(tag, "width") ?? 0);
    const height = Number(readAttribute(tag, "height") ?? 0);
    if (!src?.includes("storage.moegirl.org.cn/moegirl/commons")) continue;
    if (/(LLhead|conversion|icon|svg|logo)/i.test(src)) continue;
    if (width >= 120 && height >= 120) return src;
  }
  return undefined;
}

function readAttribute(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`${name}=["']([^"']+)["']`))?.[1];
}

function absoluteUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://zh.moegirl.org.cn${url}`;
  return url;
}

function stripTags(html?: string): string | undefined {
  return html?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
