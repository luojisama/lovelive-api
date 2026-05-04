import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { filterMusic } from "../src/services/music";
import { createTestEnv } from "./helpers";

describe("api routes", () => {
  it("filters characters by query", async () => {
    const response = await app.request("/v1/characters?q=香音", {}, createTestEnv());
    expect(response.status).toBe(200);
    const json = await response.json() as { data: Array<{ id: string }>; meta: { count: number } };
    expect(json.data.map((item) => item.id)).toContain("kanon-shibuya");
    expect(json.meta.count).toBeGreaterThan(0);
  });

  it("returns a character detail", async () => {
    const response = await app.request("/v1/characters/kaho-hinoshita", {}, createTestEnv());
    expect(response.status).toBe(200);
    const json = await response.json() as { data: { id: string; color: { hex: string }; avatarIconUrl?: string; avatarIconFilename?: string } };
    expect(json.data.id).toBe("kaho-hinoshita");
    expect(json.data.color.hex).toBe("#f8b500");
    expect(json.data.avatarIconFilename).toBe("Name_kaho_icon_105.png");
    expect(json.data.avatarIconUrl).toContain("Name_kaho_icon_105.png");
  });

  it("returns birthday matches for a timezone date", async () => {
    const env = createTestEnv();
    const result = await app.request("/v1/birthdays/today?tz=Asia/Shanghai", {}, env);
    expect(result.status).toBe(200);
    const json = await result.json() as { data: unknown[] };
    expect(Array.isArray(json.data)).toBe(true);
  });

  it("filters events by category and date range", async () => {
    const response = await app.request("/v1/events?category=live&from=2025-01-01&to=2025-12-31", {}, createTestEnv());
    expect(response.status).toBe(200);
    const json = await response.json() as { data: Array<{ category: string }> };
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data.every((event) => event.category === "live")).toBe(true);
  });

  it("filters music by query", async () => {
    const response = await app.request("https://api.test/v1/music?q=Aspire", {}, createTestEnv());
    expect(response.status).toBe(200);
    const json = await response.json() as { data: Array<{ title: string; albumTitle: string; coverUrl?: string; coverOriginalUrl?: string }>; meta: { count: number } };
    expect(json.meta.count).toBeGreaterThan(0);
    expect(json.data.some((item) => item.title === "Aspire")).toBe(true);
    expect(json.data[0].albumTitle).toBeTruthy();
    expect(json.data[0].coverUrl).toContain("https://api.test/v1/images/music-cover");
    expect(json.data[0].coverOriginalUrl).toBeTruthy();
  });

  it("filters music by common Chinese title aliases", async () => {
    const response = await app.request("/v1/music?q=爱上你万岁", {}, createTestEnv());
    expect(response.status).toBe(200);
    const json = await response.json() as { data: Array<{ title: string; albumTitle: string; source: string }>; meta: { count: number } };
    expect(json.meta.count).toBeGreaterThan(0);
    expect(json.data.some((item) => item.title === "愛してるばんざーい！")).toBe(true);
    expect(json.data[0].source).toBe("official-otonokizaka-music");
    expect(json.data[0].albumTitle).toContain("もぎゅっと");
  });

  it("prioritizes original exact music matches when querying aliases", () => {
    const result = filterMusic(
      [
        {
          id: "compilation",
          title: "愛してるばんざーい！",
          artist: "μ's",
          series: ["μ's"],
          albumTitle: "μ'ｓ Memorial CD-BOX「Complete BEST BOX」",
          releaseDate: "2019-12-25",
          source: "official-otonokizaka-music",
          sourceUrl: "https://www.lovelive-anime.jp/otonokizaka/release.php#cd83"
        },
        {
          id: "original",
          title: "愛してるばんざーい！",
          artist: "μ’s",
          series: ["μ's"],
          albumTitle: "μ’s 4thシングル「もぎゅっと\"love\"で接近中！」",
          coverUrl: "https://www.lovelive-anime.jp/otonokizaka/img/release/cd_10a.jpg",
          releaseDate: "2012-02-15",
          source: "official-otonokizaka-music",
          sourceUrl: "https://www.lovelive-anime.jp/otonokizaka/release.php#cd89"
        }
      ],
      { q: "爱上你万岁" }
    );
    expect(result[0].id).toBe("original");
  });

  it("proxies music covers and falls back to BNML catalog images", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" || input instanceof URL ? new URL(input) : new URL(input.url);
      if (url.hostname === "www.lovelive-anime.jp") {
        return new Response("<html>maintenance</html>", { headers: { "content-type": "text/html; charset=utf-8" } });
      }
      if (url.hostname === "catalog.bandainamcomusiclive.co.jp" && url.pathname === "/") {
        return new Response(
          `
          <li><a href="https://catalog.bandainamcomusiclive.co.jp/release/72459/">
            <img src="https://catalog.bandainamcomusiclive.co.jp/wp-content/uploads/2025/08/LACA-25170-1-scaled.jpg" alt="">
            <div class="time">2025.05.28</div>
            <h3 class="title">Aspire【オリジナル盤】</h3>
          </a></li>
          `,
          { headers: { "content-type": "text/html; charset=utf-8" } }
        );
      }
      if (url.hostname === "catalog.bandainamcomusiclive.co.jp" && url.pathname.endsWith(".jpg")) {
        return new Response("image-bytes", { headers: { "content-type": "image/jpeg" } });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    try {
      const response = await app.request(
        "/v1/images/music-cover?url=https%3A%2F%2Fwww.lovelive-anime.jp%2Fyuigaoka%2Fcommon%2Fapi%2Fimage.php%3Fimg_path%3D%2Fcover.jpeg&albumTitle=Liella!%203rd%E3%82%A2%E3%83%AB%E3%83%90%E3%83%A0%E3%80%8CAspire%E3%80%8D%E3%80%90%E3%82%AA%E3%83%AA%E3%82%B8%E3%83%8A%E3%83%AB%E7%9B%A4%E3%80%91&releaseDate=2025-05-28",
        {},
        createTestEnv()
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/jpeg");
      expect(await response.text()).toBe("image-bytes");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns reserved card endpoint as 501", async () => {
    const response = await app.request("/v1/cards/random?game=sif2", {}, createTestEnv());
    expect(response.status).toBe(501);
    const json = await response.json() as { error: { code: string } };
    expect(json.error.code).toBe("NOT_IMPLEMENTED");
  });
});
