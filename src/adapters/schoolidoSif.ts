import type { CardGame } from "../types";

export function assertCardGame(value: string | null | undefined): CardGame {
  if (value === "sif" || value === "sifas" || value === "sif2") return value;
  throw new Error("game 必须是 sif、sifas 或 sif2");
}

export function cardSourceStatus(game: CardGame): string {
  if (game === "sif") {
    return "School Idol Tomodachi 适配器已预留，随机卡面功能尚未启用。";
  }
  return "Idol Story 适配器已预留，随机卡面功能尚未启用。";
}
