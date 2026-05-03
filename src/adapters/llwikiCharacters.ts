import type { Character, CharacterBirthday, CharacterColor } from "../types";
import { birthdayText, parseMonthDay } from "../utils/date";
import { normalizeSearchText, stripHtml } from "../utils/text";
import { fetchText } from "../services/upstream";
import fixtureCharacters from "../fixtures/characters.json";

const COLOR_URL =
  "https://llwiki.org/mediawiki/index.php?title=LoveLive%21%E7%B3%BB%E5%88%97%E6%87%89%E6%8F%B4%E8%89%B2%E5%88%97%E8%A1%A8&variant=zh-hans";
const BIRTHDAY_URL =
  "https://llwiki.org/mediawiki/index.php?title=LoveLive%21%E7%B3%BB%E5%88%97%E4%B8%BB%E8%A6%81%E4%BA%BA%E7%89%A9%E7%94%9F%E6%97%A5%E5%88%97%E8%A1%A8&variant=zh-hans";

export async function fetchLlwkiCharacters(): Promise<Character[]> {
  const [colorHtml, birthdayHtml] = await Promise.all([
    fetchText(COLOR_URL, 7 * 24 * 60 * 60),
    fetchText(BIRTHDAY_URL, 7 * 24 * 60 * 60)
  ]);
  return mergeLlwkiData(fixtureCharacters as Character[], stripHtml(colorHtml), stripHtml(birthdayHtml));
}

export function mergeLlwkiData(base: Character[], colorText: string, birthdayTextContent: string): Character[] {
  const colors = parseSupportColors(colorText);
  const birthdays = parseBirthdays(birthdayTextContent);

  return base.map((character) => {
    const keys = characterKeys(character);
    const color = keys.map((key) => colors.get(key)).find(Boolean) ?? character.color;
    const birthday = keys.map((key) => birthdays.get(key)).find(Boolean) ?? character.birthday;
    return { ...character, color, birthday };
  });
}

export function parseSupportColors(text: string): Map<string, CharacterColor> {
  const colors = new Map<string, CharacterColor>();
  const normalized = text.replace(/\s+/g, " ");
  const regex = /([^\s#■]+)\s+([^\s#■]+)\s+([^\s#■]+)\s+■\s*(#[0-9a-fA-F]{6})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(normalized)) !== null) {
    const [, name, colorName, originalName, hex] = match;
    colors.set(normalizeSearchText(name), {
      name: colorName,
      originalName,
      hex: hex.toLowerCase()
    });
  }
  return colors;
}

export function parseBirthdays(text: string): Map<string, CharacterBirthday> {
  const birthdays = new Map<string, CharacterBirthday>();
  const normalized = text.replace(/0\s+(\d月)/g, "$1").replace(/\s+/g, " ");
  const regex = /(\d{1,2}\s*月\s*\d{1,2}\s*日)\s+[^ ]+\s+([^ ]+)\s+角色\s+([^ ]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(normalized)) !== null) {
    const [, birthdayRaw, name] = match;
    const parsed = parseMonthDay(birthdayRaw);
    if (!parsed) continue;
    birthdays.set(normalizeSearchText(name), {
      ...parsed,
      text: birthdayText(parsed.month, parsed.day)
    });
  }
  return birthdays;
}

function characterKeys(character: Character): string[] {
  return [
    character.names.zhHans,
    character.names.ja,
    character.names.en,
    character.names.romaji,
    ...(character.names.aliases ?? [])
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeSearchText);
}
