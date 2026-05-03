# LoveLive 聚合 API

这是一个可部署到 Cloudflare Workers 的 LoveLive 聚合 API，提供角色资料、生日、活动、音乐查询，以及预留的游戏卡面接口。

## 本地开发

```bash
pnpm install
pnpm dev
pnpm smoke:local
```

本地默认使用 `UPSTREAM_MODE=fixture`，测试不依赖远程站点。需要验证真实上游解析时，可以运行：

```bash
pnpm dev:live
```

Wrangler/Miniflare 会在本地模拟 `CACHE` KV 绑定。需要预填本地 KV 时运行：

```bash
pnpm seed:local
```

## API

所有成功响应统一为：

```json
{ "data": {}, "meta": {} }
```

错误响应统一为：

```json
{ "error": { "code": "ERROR_CODE", "message": "错误说明" } }
```

接口速览：

| 接口 | 用途 |
| --- | --- |
| `GET /v1/characters` | 查角色、生日、印象色、头像 |
| `GET /v1/birthdays/today` | 查今天生日角色 |
| `GET /v1/events` | 查官方/补充源聚合活动 |
| `GET /v1/music` | 查官方音乐、封面、发售日、所属专辑 |
| `GET /v1/cards/random` | 预留 SIF/SIFAS/SIF2 随机卡面 |

### `GET /v1/characters`

获取角色列表。默认返回已规范化的角色资料，包含中文名、日文名、英文名、所属团体、所属企划、生日、印象色、头像、头像小图和来源。

查询参数：

- `group`：按团体或企划筛选，例如 `Liella!`、`μ's`、`莲之空女学院学园偶像俱乐部`。
- `q`：按角色名、别名、英文名、日文名或 id 模糊查询，例如 `香音`、`maki`。
- `birthdayMonth`：按生日月份筛选，取值 `1` 到 `12`。

### `GET /v1/characters/:id`

获取单个角色详情。`:id` 使用接口返回的稳定 id，例如 `kanon-shibuya`、`maki-nishikino`。未找到时返回 `404 NOT_FOUND`。

角色图片字段：

- `avatarUrl`：萌娘百科角色页立绘或主要角色图。
- `avatarIconUrl`：萌娘百科 `Name_*_icon*.png` 系列头像小图，适合列表、机器人消息卡片和轻量 UI 使用。
- `avatarIconFilename`：头像小图原始文件名，便于调用方做缓存或排查来源。

### `GET /v1/birthdays/today`

获取指定时区当天生日角色。

查询参数：

- `tz`：IANA 时区名，默认 `Asia/Shanghai`。例如 `Asia/Tokyo`、`Asia/Shanghai`。

如果 `tz` 不是有效时区，返回 `400 INVALID_TIMEZONE`。

### `GET /v1/events`

获取规范化活动列表。活动会从多个来源聚合并去重，按开始时间升序返回。

查询参数：

- `from`：起始时间，支持 `YYYY-MM-DD` 或完整 ISO 时间。
- `to`：结束时间，支持 `YYYY-MM-DD` 或完整 ISO 时间。
- `series`：按企划/团体筛选，例如 `Liella`、`蓮ノ空`、`虹ヶ咲`。
- `category`：活动类型。常用值为 `live`、`stream`、`event`。
- `source`：按来源筛选。常用值为 `official-schedule`、`official-news`、`rsshub`、`llch-timeline`、`llch-cvtochina`。

说明：

- `official-schedule` 和 `official-news` 是官方来源。
- `llch-timeline` 来自 `ll-ch.com/timeline.html`，覆盖近期线上直播、演唱会、FMT、生放送等活动，时效性更强。
- `llch-cvtochina` 来自 `ll-ch.com/main/cvtochina/`，覆盖 LoveLive 系列声优近期访华活动。
- `rsshub` 是结构化 fallback，建议生产环境接自建 RSSHub。

### `GET /v1/events/:id`

获取单个活动详情。`:id` 使用 `/v1/events` 返回的 id。未找到时返回 `404 NOT_FOUND`。

活动字段说明：

- `title`：活动标题。
- `series`：关联企划或团体。
- `category`：活动类型。
- `startAt` / `endAt`：开始/结束时间，保留来源时区偏移。
- `timezone`：来源标注时区，例如 `Asia/Tokyo` 或 `Asia/Shanghai`。
- `venue`：场馆或来源标注地点，可能为空。
- `performers`：出演者，来源可解析时返回。
- `source` / `sourceUrl`：规范化来源和原始链接。

### `GET /v1/music`

获取官方音乐曲目。每条数据是一首歌，不是一张 CD。字段保持简单：

- `title`：歌名。
- `artist`：演唱者，能解析到单曲演唱者时优先使用单曲演唱者。
- `series`：所属企划或团体。
- `albumTitle`：所属专辑、单曲或音乐商品名。
- `albumType`：商品类型，例如 `CD`。
- `coverUrl`：官方封面图。
- `releaseDate`：发售日期，格式 `YYYY-MM-DD`。
- `sourceUrl`：官方音乐详情页。

查询参数：

- `q`：按歌名、专辑名、演唱者模糊查询，例如 `Aspire`、`AURORA`。
- `series`：按企划/团体筛选，例如 `Liella`、`蓮ノ空`。
- `album`：按专辑或单曲标题筛选。
- `artist`：按演唱者筛选。
- `from` / `to`：按发售日期筛选，支持 `YYYY-MM-DD`。
- `source`：按来源筛选。当前常用值为 `official-yuigaoka-music`、`official-hasunosora-music`。

首版接入 Liella! 和蓮ノ空官方音乐页；后续可继续扩展 μ's、Aqours、虹咲等旧站音乐页。

### `GET /v1/music/:id`

获取单首歌详情。`:id` 使用 `/v1/music` 返回的 id。未找到时返回 `404 NOT_FOUND`。

### `GET /v1/cards/random`

预留随机卡面接口。本版本不会返回伪数据；未接入的游戏返回 `501 NOT_IMPLEMENTED`。

查询参数：

- `game`：必填，取值 `sif`、`sifas`、`sif2`。
- `character`：预留角色筛选参数。
- `rarity`：预留稀有度筛选参数。

卡面接口在 `0.1` 版本只预留接口形状；在稳定卡面源适配器启用前，会返回 `501 NOT_IMPLEMENTED`。

## 示例请求

线上示例地址：

```text
http://llapi.shiro.team/
```

常用请求：

```text
http://llapi.shiro.team/v1/characters?q=香音
http://llapi.shiro.team/v1/characters/kanon-shibuya
http://llapi.shiro.team/v1/birthdays/today?tz=Asia/Shanghai
http://llapi.shiro.team/v1/events?from=2026-05-01&to=2026-05-31
http://llapi.shiro.team/v1/events?category=live
http://llapi.shiro.team/v1/events?source=llch-timeline&category=live
http://llapi.shiro.team/v1/events?source=llch-cvtochina
http://llapi.shiro.team/v1/music?q=Aspire
http://llapi.shiro.team/v1/music?series=蓮ノ空&from=2025-01-01
http://llapi.shiro.team/v1/cards/random?game=sif2
```

角色响应示例字段：

```json
{
  "data": {
    "id": "kanon-shibuya",
    "names": { "zhHans": "涩谷香音", "ja": "澁谷かのん" },
    "avatarUrl": "https://storage.moegirl.org.cn/moegirl/commons/3/34/...",
    "avatarIconUrl": "https://storage.moegirl.org.cn/moegirl/commons/2/2e/Name_kanon_icon.png!/fw/80?v=20200804045109",
    "avatarIconFilename": "Name_kanon_icon.png"
  },
  "meta": {}
}
```

## 数据源

- 角色资料、生日、头像、页面来源：萌娘百科角色页。
- 头像小图：萌娘百科 `Name_*_icon*.png` 文件，参考 `lovelive_schedule` 插件的 `avatar_filename` / `avatar_url` 做法，并用当前萌娘百科模板页中的可访问图片地址更新。
- 活动：LoveLive 官方日程和新闻、LL-CH 近期线上活动时间线、LL-CH 声优访华活动页，RSSHub 路由作为备用结构化源。
- 音乐：Liella! 官方音乐页、蓮ノ空官方音乐页。返回曲目时以官方详情页的发售日、封面、收录曲为准。
- SIF 卡面候选源：School Idol Tomodachi。
- SIFAS/SIF2 卡面候选源：Idol Story。

## 部署

### Cloudflare 控制台选择 GitHub 仓库部署

可以在 Workers 控制台里直接选择这个 GitHub 仓库部署。创建项目时建议这样填：

- Framework preset：`None`
- Build command：留空
- Deploy command：`pnpm deploy`
- Root directory：留空，仓库根目录就是项目根目录

不要使用默认的 `npx wrangler deploy` 作为正式部署命令。它可以部署 API，但不会自动创建生产 KV；`pnpm deploy` 会自动创建或复用 `lovelive-api-production-cache`，并用 `production` 环境发布。

如果你现在看到 `KV namespace 'local_lovelive_api_cache' is not valid`，说明控制台还在执行默认命令。到项目的 Build settings / Deploy command，把命令改成：

```bash
pnpm deploy
```

然后重新部署即可。

### 本机一键部署

本机完整检查后部署到 Cloudflare Workers：

```bash
pnpm deploy:cf
```

这条命令会自动完成：

- 检查 Wrangler 登录状态；未登录时执行 `wrangler login`。
- 创建或复用生产环境 KV namespace。
- 把生产 KV namespace ID 写入 `wrangler.toml`。
- 运行 `typecheck` 和测试。
- 执行 `wrangler deploy --env production`。

如果只想快速部署，跳过本地检查：

```bash
pnpm deploy
```

如果希望部署前同时核对线上数据源和头像 URL：

```bash
pnpm deploy:cf -- --with-data-checks
```

也可以指定环境或 KV 名称：

```bash
pnpm deploy:cf -- --env production --kv-name lovelive-api-production-cache
```

手动部署仍然可用：

```bash
pnpm deploy:raw
```
