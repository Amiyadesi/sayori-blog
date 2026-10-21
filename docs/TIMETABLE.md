# 在 Google 日历里改课表

主日历中的课程会自动同步到博客 `/timetable/`，繁体和英文页面使用同一份日程

- **改课程**：直接在 Google 日历中调整标题、时间或地点，重复课程可选仅修改这次或后续所有活动；取消一次课程也会同步
- **公开其他安排**：在活动标题加入独立的 `#博客`，例如 `社团见面 #博客`；同步后不显示这个标签
- **撤回公开**：移除 `#博客`，或把活动设为“私密”；课程设为“私密”也不会公开
- 课程按描述开头的 `【上课提醒】` 识别，新建课程也可以使用这个标记
- 只展示标题、时间和地点，备注、邮箱、参与人和 Google 活动 ID 不会写入公开快照

同步工作流每 5 分钟计划运行一次，GitHub 排队时会延后；页面打开时读取最新快照，停留期间每 5 分钟刷新，时间统一按北京时间显示

页面显示上次同步时间。超过 15 分钟没有新快照会提示延迟；读取失败保留已有日历并提供重试。首次连接失败时明确显示本地课表，不把本地课表当作最新日历

同步窗口是当前周前 26 周、后 27 周，覆盖当前学期，也能查看学期外的自选安排。全天活动按 Google 的结束日期不包含当天处理，跨日活动显示在各自涉及的日期

## 连接与维护

主日历仅向专用服务账号授予“查看活动详情”，主日历本身不公开。GitHub OIDC 只允许 `Amiyadesi/sayori-blog` 的 `main` 分支中 `.github/workflows/sync-calendar.yml` 使用该账号，Google scope 为 `calendar.events.readonly`，不存储服务账号密钥

- 定时同步：`.github/workflows/sync-calendar.yml` → `scripts/sync-calendar.mjs`
- 公开规则：`functions/_lib/timetable-calendar.js`
- 已筛选快照：现有 D1 的 `timetable_calendar` 单行表
- 三语接口：`/api/timetable?locale=zh-CN`、`zh-Hant`、`en`
- 页面与状态：`src/pages/timetable.astro`、`src/scripts/timetable.ts`
- 本地课表基线：`src/data/timetable.ts`，只在未连接或禁用 JavaScript 时展示

手动同步可在 GitHub Actions 的 **Sync public calendar** 点击 **Run workflow**，不会重建博客。工作流失败时查看该次运行；Google 读取失败不会覆盖上次快照

日历 ID 保存在 GitHub secret `GOOGLE_CALENDAR_ID`。Google 项目、Workload Identity Provider 与只读账号在工作流中配置；Cloudflare 沿用当前账户、D1 和既有部署凭据

更换主日历时，先对同一服务账号共享只读权限，再修改 `GOOGLE_CALENDAR_ID`。停止同步可禁用该工作流并在 Google 日历中撤销共享；已公开的旧快照需一并清除后才能撤下历史展示

设置页与课表页仍为 `noindex`，课表不进入 sitemap 或 Pagefind
