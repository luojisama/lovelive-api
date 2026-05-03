import { describe, expect, it } from "vitest";
import { parseLlchTimelineHtml } from "../src/adapters/llchTimeline";
import { parseMoegirlCharacterPage } from "../src/adapters/moegirlCharacters";
import { parseOfficialScheduleHtml } from "../src/adapters/officialSchedule";
import { dedupeEvents } from "../src/services/events";

describe("moegirl parsers", () => {
  it("parses birthday, color and avatar from a character page", () => {
    const parsed = parseMoegirlCharacterPage(`
      <table>
        <tr><td><img src="https://storage.moegirl.org.cn/moegirl/commons/1/1b/Member06_maki.png!/fw/280?v=1" width="280" height="540" /></td></tr>
        <tr><th>生日</th><td><a>4月19日</a></td></tr>
        <tr><th>姓名</th><td><span itemprop="name"><span title="#FF6239" style="background: #FF6239;"></span>西木野真姬</span></td></tr>
      </table>
    `);
    expect(parsed.birthdayText).toBe("4月19日");
    expect(parsed.colorHex).toBe("#FF6239");
    expect(parsed.avatarUrl).toContain("Member06_maki.png");
  });
});

describe("event parsing", () => {
  it("parses official schedule-like html", () => {
    const events = parseOfficialScheduleHtml("<h2>2025年</h2><p>9月</p><div>6(土) サンシャイン!! 虹ヶ咲学園 ライブイベント ■会場：パシフィコ横浜 国立大ホール</div>");
    expect(events).toHaveLength(1);
    expect(events[0].category).toBe("live");
    expect(events[0].venue).toBe("パシフィコ横浜 国立大ホール");
  });

  it("parses ll-ch timeline live days in Beijing time", () => {
    const events = parseLlchTimelineHtml(
      `
      <section id="cd-timeline">
        <div class="cd-timeline-block">
          <div class="cd-timeline-content">
            <h2><center><img /></center>ラブライブ！蓮ノ空女学院スクールアイドルクラブ 6th Live Dream</h2>
            <p>
              活动场馆：兵庫・神戸ワールド記念ホール<br />
              配信日期：DAY1 - 5月23日（六） 16:00 <span>北京时间</span><br />
              　　　　　DAY2 - 5月24日（日） 14:00 <span>北京时间</span><br />
              　出　演：蓮ノ空女学院スクールアイドルクラブ<br />
            </p>
            <a href="https://www.lovelive-anime.jp/hasunosora/live-event/live_detail.php?p=6thBGP" class="btn-official">官方公告</a>
            <span class="cd-date">莲之空女学院</span>
          </div>
        </div>
      </section>
      `,
      new Date("2026-05-04T00:00:00+08:00")
    );
    expect(events).toHaveLength(2);
    expect(events[0].source).toBe("llch-timeline");
    expect(events[0].category).toBe("live");
    expect(events[0].startAt).toBe("2026-05-23T16:00:00+08:00");
    expect(events[1].title).toContain("DAY2");
  });

  it("dedupes by source url or normalized content", () => {
    const events = dedupeEvents([
      {
        id: "a",
        title: "Same Event",
        series: ["LoveLive!"],
        category: "event",
        startAt: "2025-01-01T00:00:00+09:00",
        timezone: "Asia/Tokyo",
        source: "official-news",
        sourceUrl: "https://example.test/a"
      },
      {
        id: "b",
        title: "Same Event",
        series: ["LoveLive!"],
        category: "event",
        startAt: "2025-01-01T00:00:00+09:00",
        timezone: "Asia/Tokyo",
        source: "official-news",
        sourceUrl: "https://example.test/a"
      }
    ]);
    expect(events).toHaveLength(1);
  });
});
