import type { CardGame } from "../types";
import { cardSourceStatus } from "../adapters/schoolidoSif";
import { isIdolStoryBacked } from "../adapters/idolStoryCardsStub";

export function reservedCardMessage(game: CardGame): string {
  const source = isIdolStoryBacked(game) ? "Idol Story" : "School Idol Tomodachi";
  return `${source} 卡面适配器已预留但尚未启用。${cardSourceStatus(game)}`;
}
