# 页边的字 · 开发分支

与相邻 `sayori-home` 的 `feat/p34-native-play` 配套。本轮不生产部署。试玩、玩法与检查记录在主页仓库 `docs/NATIVE-PLAY.md`。

`?paper=0617` 保留真实 Astro 博客，不再用统一空间替换文章列表或正文。首页有可展开的阅读者回应；《博客风格转变记录》和 GMTK 复盘的具体段落后有边注。边注只添加独立节点，退出会移除，不改作者文章或评论。

四篇记录在 `src/data/p34-notes.ts`，由 `src/pages/notes/` 输出真实页面，排除 sitemap/Pagefind 并带 noindex。更新记录中的旧链接解锁 `p34_routes.archive` 和旧稿话题；旧世界/剧情 cookie 继续兼容。商店遗留的笔记 hash 转到新记录，未修改商店服务。

Twikoo 保留原 nick/link/avatar、文章 path、懒加载和持久宿主。`herProfile.website` 为空，记录署名暂用「页边的字」，并非正式人物命名。域名和评论账号由作者决定；没有自动注册、冒用或公开发布虚构评论。

本地构建：`pnpm exec astro build --outDir .codex-tmp/p34-native-build`。之后在主页仓库运行 `node scripts/preview-p34.mjs`，博客入口为 `http://127.0.0.1:8971/?paper=0617`。

已检查中文构建（93 页）、Astro 类型（0 errors、2 个原有提示）、真实文章边注、Astro 页面跳转、退出保留原段落节点、跨站旧稿发现。未运行完整三语发布流水线，未在实体手机、Safari/Firefox 验证。
