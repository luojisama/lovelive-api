import { Hono } from "hono";
import type { Env } from "./types";
import { fail, notFound, ok } from "./utils/api";
import { getCharacterById, getCharacters, getTodayBirthdays } from "./services/characters";
import { getEventById, getEvents } from "./services/events";
import { getMusic, getMusicById } from "./services/music";
import { proxyMusicCover, withMusicCoverProxy } from "./services/images";
import { assertCardGame } from "./adapters/schoolidoSif";
import { getRandomCard } from "./services/cards";

export const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) =>
  ok({
    name: "lovelive-api",
    version: "0.1.0",
    endpoints: ["/v1/characters", "/v1/birthdays/today", "/v1/events", "/v1/music", "/v1/images/music-cover", "/v1/cards/random"]
  })
);

app.get("/health", (c) => ok({ status: "ok" }));

app.get("/v1/characters", async (c) => {
  const result = await getCharacters(c.env, {
    group: c.req.query("group"),
    q: c.req.query("q"),
    birthdayMonth: c.req.query("birthdayMonth")
  });
  return ok(result.data, result.meta);
});

app.get("/v1/characters/:id", async (c) => {
  const result = await getCharacterById(c.env, c.req.param("id"));
  if (!result.data) return notFound("未找到角色");
  return ok(result.data, result.meta);
});

app.get("/v1/birthdays/today", async (c) => {
  const timeZone = c.req.query("tz") ?? "Asia/Shanghai";
  try {
    const result = await getTodayBirthdays(c.env, timeZone);
    return ok(result.data, result.meta);
  } catch {
    return fail(400, "INVALID_TIMEZONE", "tz 查询参数不是有效时区");
  }
});

app.get("/v1/events", async (c) => {
  const result = await getEvents(c.env, {
    from: c.req.query("from"),
    to: c.req.query("to"),
    series: c.req.query("series"),
    category: c.req.query("category"),
    source: c.req.query("source")
  });
  return ok(result.data, result.meta);
});

app.get("/v1/events/:id", async (c) => {
  const result = await getEventById(c.env, c.req.param("id"));
  if (!result.data) return notFound("未找到活动");
  return ok(result.data, result.meta);
});

app.get("/v1/music", async (c) => {
  const result = await getMusic(c.env, {
    q: c.req.query("q"),
    series: c.req.query("series"),
    album: c.req.query("album"),
    artist: c.req.query("artist"),
    from: c.req.query("from"),
    to: c.req.query("to"),
    source: c.req.query("source")
  });
  const origin = new URL(c.req.url).origin;
  return ok(result.data.map((item) => withMusicCoverProxy(item, origin)), result.meta);
});

app.get("/v1/music/:id", async (c) => {
  const result = await getMusicById(c.env, c.req.param("id"));
  if (!result.data) return notFound("未找到音乐");
  const origin = new URL(c.req.url).origin;
  return ok(withMusicCoverProxy(result.data, origin), result.meta);
});

app.get("/v1/images/music-cover", (c) => proxyMusicCover(c.req.raw));

app.get("/v1/cards/random", async (c) => {
  try {
    const game = assertCardGame(c.req.query("game"));
    const result = await getRandomCard(c.env, {
      game,
      character: c.req.query("character"),
      rarity: c.req.query("rarity")
    });
    return ok(result.data, result.meta);
  } catch (error) {
    return fail(400, "INVALID_GAME", error instanceof Error ? error.message : "game 查询参数无效");
  }
});

app.notFound(() => notFound());

app.onError((error) => {
  return fail(500, "INTERNAL_ERROR", error.message);
});
