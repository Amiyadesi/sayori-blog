# Amiya 的未保存版本：博客侧

配套 home 仓库的同名 `feat/amiya-unsaved-arg` 分支。完整设计、来源、作者答案、验收记录在 home 的 `docs/unsaved/`。

本站提供 `/unsaved/` 发布说明、`/unsaved/margins/` 文章边注、`/unsaved/shelf/` 证据回应。其他六个区域在主页站点；不能只发布这一个 PR 就视为完整作品。

## 改动边界

- `public/unsaved/` 是独立 HTML/ES Modules，使用全局根路径，尚未翻译。英文博客入口明确标记 Chinese ARG。
- `DeskIntro.astro` 入口使用 `data-astro-reload`，退出 Astro ClientRouter，避免跨站游戏模块生命周期混乱。
- `app.js`、`core.js`、`sites.js`、`game.css` 主份在 home；用其 `scripts/sync-unsaved.mjs <blog-checkout>` 更新，别在此维护第二套实现。
- 日记构建从三个语言输出根裁掉 `unsaved`；游戏不进入私人日记。
- 既有 service worker 不再接管 `/unsaved/`，HTTP 缓存要求重新验证，避免返回旧脚本或把离线错误替换成博客首页。
- 所有故事页 `noindex`、`data-pagefind-ignore`，避免站内搜索泄露剧情。真实公开文章未改写。

## 本地

在相邻的 home checkout 运行 `node scripts/preview-unsaved.mjs`，打开 `http://127.0.0.1:4321/unsaved/`。这个命令不用启动 Astro，也不公开端口；4322 是主页端。

博客回归使用已有工具链：

```sh
pnpm install --frozen-lockfile
# CONTENT_DIR 指向公开 sayori-articles checkout；不要指向私人笔记库。
pnpm run sync-content
pnpm exec tsx --test scripts/unsaved.test.mjs scripts/prune-sayori-diary.test.mjs scripts/service-worker.test.mjs scripts/locale-url.test.mjs
pnpm run check
pnpm run build
pnpm run verify-build-output
```

本轮上述定向测试、Astro check 与三语言构建通过。单独 `pnpm run type-check` 有既有 twikoo-runtime 声明缺失，详见配套 QA。作者表达与首次玩家时长尚待验收，因此以 draft PR 交付。

合并 main 会触发生产部署：本任务不合并、不触发部署、不改 DNS。获准发布时需两站协调；先验证 home 目的页面，再让博客入口公开可用。
