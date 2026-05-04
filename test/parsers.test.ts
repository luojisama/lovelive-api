import { describe, expect, it } from "vitest";
import { parseLlchCvToChinaHtml } from "../src/adapters/llchCvToChina";
import { parseLlchTimelineHtml } from "../src/adapters/llchTimeline";
import { parseMoegirlCharacterPage } from "../src/adapters/moegirlCharacters";
import { parseLegacyOfficialMusicPage, parseOfficialMusicDetail } from "../src/adapters/officialMusic";
import { parseOfficialScheduleHtml } from "../src/adapters/officialSchedule";
import { dedupeEvents } from "../src/services/events";
import { parseBnmlSearchResults } from "../src/services/images";

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

  it("parses ll-ch cv-to-china table rows", () => {
    const events = parseLlchCvToChinaHtml(
      `
      <table>
        <tr><th>日期</th><th>活动名称</th></tr>
        <tr>
          <td>5.23</td><td>結那 FanMeeting in Taipei 2026</td><td>14:30</td>
          <td>台北市松山区复兴南路一段39号9层<br />MOONDOG</td><td>宝島制作</td><td>—</td>
        </tr>
      </table>
      `,
      new Date("2026-05-04T00:00:00+08:00")
    );
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("llch-cvtochina");
    expect(events[0].startAt).toBe("2026-05-23T14:30:00+08:00");
    expect(events[0].performers).toContain("結那");
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

describe("music parsing", () => {
  it("parses BNML catalog search result covers", () => {
    const results = parseBnmlSearchResults(`
      <li><a href="https://catalog.bandainamcomusiclive.co.jp/release/72459/">
        <div class="img"><img src="https://catalog.bandainamcomusiclive.co.jp/wp-content/uploads/2025/08/LACA-25170-1-scaled.jpg" alt=""></div>
        <div class="time">2025.05.28</div>
        <h3 class="title">Aspire【オリジナル盤】</h3>
      </a></li>
    `);
    expect(results).toHaveLength(1);
    expect(results[0].releaseUrl).toBe("https://catalog.bandainamcomusiclive.co.jp/release/72459/");
    expect(results[0].imageUrl).toContain("LACA-25170-1-scaled.jpg");
    expect(results[0].releaseDate).toBe("2025-05-28");
    expect(results[0].title).toBe("Aspire【オリジナル盤】");
  });

  it("parses official music detail into tracks", () => {
    const tracks = parseOfficialMusicDetail(
      `
      <div class="title"><p><span class="subname">Liella! 3rdアルバム</span>「Aspire」【オリジナル盤】</p></div>
      <div class="cover"><img src="img/cd.png" style="background-image:url(../common/api/image.php?img_path=/cover.jpeg)" alt=""></div>
      <dl class="spec">
        <dt>【アーティスト】</dt><dd>Liella!</dd>
        <dt>【発売日】</dt><dd>2025年5月28日(水)</dd>
        <dt>【収録内容】</dt>
        <dd><p class="list">01. Let's be ONE<br />　　歌：Liella!<br />02. Aspire<br />　　歌：Liella!<br />03. Aspire(Off Vocal)</p></dd>
      </dl>
      `,
      "https://www.lovelive-anime.jp/yuigaoka/music/detail.php?p=01_4748",
      { listUrl: "https://www.lovelive-anime.jp/yuigaoka/music/", series: ["Liella!"], source: "official-yuigaoka-music", limit: 1 }
    );
    expect(tracks).toHaveLength(2);
    expect(tracks[0].title).toBe("Let's be ONE");
    expect(tracks[0].albumTitle).toContain("Aspire");
    expect(tracks[0].releaseDate).toBe("2025-05-28");
    expect(tracks[0].coverUrl).toContain("/cover.jpeg");
  });

  it("parses old official music pages into tracks", () => {
    const tracks = parseLegacyOfficialMusicPage(
      `
      <div class="box" id="cd89">
        <div class="titlebase">
          <p>μ’s 4thシングル</p>
          <p><strong>「もぎゅっと"love"で接近中！」【初回生産限定 Lジャケ仕様】</strong></p>
        </div>
        <div class="cover"><img src="img/release/cd_10a.jpg"></div>
        <div class="text">
          【アーティスト】<br>
          μ’s<br>
          <br>
          【発売日】<br>
          2024年3月27日（水）<br>
          <br>
          【収録曲】<br>
          1. もぎゅっと“love”で接近中！<br>
          2. 愛してるばんざーい！<br>
          3. もぎゅっと“love”で接近中！ (Off Vocal)<br>
          4. 愛してるばんざーい！ (Off Vocal)<br>
          オリジナル盤発売日：2012年2月15日<br>
        </div>
      </div>
      `,
      "https://www.lovelive-anime.jp/otonokizaka/release.php",
      {
        listUrl: "https://www.lovelive-anime.jp/otonokizaka/release.php",
        series: ["μ's"],
        source: "official-otonokizaka-music",
        limit: 0,
        mode: "legacy-page"
      }
    );
    const banzai = tracks.find((track) => track.title === "愛してるばんざーい！");
    expect(tracks).toHaveLength(2);
    expect(banzai?.albumTitle).toContain("もぎゅっと");
    expect(banzai?.artist).toBe("μ’s");
    expect(banzai?.releaseDate).toBe("2012-02-15");
    expect(banzai?.coverUrl).toBe("https://www.lovelive-anime.jp/otonokizaka/img/release/cd_10a.jpg");
    expect(banzai?.sourceUrl).toBe("https://www.lovelive-anime.jp/otonokizaka/release.php#cd89");
  });

  it("parses old official track lists with nested credit blocks", () => {
    const tracks = parseLegacyOfficialMusicPage(
      `
      <div class="box" id="cd45">
        <div class="title"><p><span>TVアニメ挿入歌</span>Future Parade</p></div>
        <div class="cover"><img src="img/cd/cd45.png?v2"></div>
        <dl class="spec">
          <dt>【アーティスト】</dt><dd>虹ヶ咲学園スクールアイドル同好会</dd>
          <dt>【発売日】</dt><dd>2022年7月27日(水)</dd>
          <dt>【収録内容】</dt>
          <dd>
            <ul class="track">
              <li>01.Future Parade
                <dl><dt>作詞：</dt><dd>Ayaka Miyake</dd></dl>
              </li>
              <li>02.Level Oops! Adventures
                <dl><dt>作詞・作曲・編曲：</dt><dd>T4K</dd></dl>
              </li>
              <li>03.Future Parade(Off Vocal)</li>
            </ul>
          </dd>
        </dl>
      </div>
      `,
      "https://www.lovelive-anime.jp/nijigasaki/cd.php",
      {
        listUrl: "https://www.lovelive-anime.jp/nijigasaki/cd.php",
        series: ["虹ヶ咲学園"],
        source: "official-nijigasaki-music",
        limit: 0,
        mode: "legacy-page"
      }
    );
    expect(tracks.map((track) => track.title)).toEqual(["Future Parade", "Level Oops! Adventures"]);
    expect(tracks[0].artist).toBe("虹ヶ咲学園スクールアイドル同好会");
    expect(tracks[0].releaseDate).toBe("2022-07-27");
  });
});
