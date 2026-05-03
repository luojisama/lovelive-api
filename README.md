# LoveLive 聚合 API

这是一个可部署到 Cloudflare Workers 的 LoveLive 聚合 API，提供角色资料、生日、活动，以及预留的游戏卡面接口。

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

- `GET /v1/characters`
- `GET /v1/characters/:id`
- `GET /v1/birthdays/today?tz=Asia/Shanghai`
- `GET /v1/events?from=&to=&series=&category=&source=`
- `GET /v1/events/:id`
- `GET /v1/cards/random?game=sif|sifas|sif2&character=&rarity=`

卡面接口在 `0.1` 版本只预留接口形状；在稳定卡面源适配器启用前，会返回 `501 NOT_IMPLEMENTED`。

## 数据源

- 角色资料、生日、头像、页面来源：萌娘百科角色页。
- 活动：LoveLive 官方日程和新闻，RSSHub 路由作为备用结构化源。
- SIF 卡面候选源：School Idol Tomodachi。
- SIFAS/SIF2 卡面候选源：Idol Story。

## 部署

创建 Cloudflare KV namespace 后，把 `wrangler.toml` 中 staging/production 的占位 ID 替换成真实 ID，然后部署：

```bash
pnpm deploy
```
