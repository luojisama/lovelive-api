import { app } from "./app";
import type { Env } from "./types";
import { getCharacters } from "./services/characters";
import { getEvents } from "./services/events";
import { getMusic } from "./services/music";

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refreshCaches(env));
  }
};

async function refreshCaches(env: Env): Promise<void> {
  await Promise.all([getCharacters(env, {}, true), getEvents(env, {}, true), getMusic(env, {}, true)]);
}
