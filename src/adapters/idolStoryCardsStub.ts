import type { CardGame } from "../types";

export function isIdolStoryBacked(game: CardGame): boolean {
  return game === "sifas" || game === "sif2";
}
