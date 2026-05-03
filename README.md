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
