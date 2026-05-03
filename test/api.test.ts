import { describe, expect, it } from "vitest";
import { app } from "../src/app";
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

  it("returns reserved card endpoint as 501", async () => {
    const response = await app.request("/v1/cards/random?game=sif2", {}, createTestEnv());
    expect(response.status).toBe(501);
    const json = await response.json() as { error: { code: string } };
    expect(json.error.code).toBe("NOT_IMPLEMENTED");
  });
});
