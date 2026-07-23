# Sayori 博客增长工作台

增长工作台位于 `/admin/growth/`，使用现有 GitHub OAuth 登录。它处理的是“该写什么、这篇缺什么、发到哪里、是否带来有效阅读”，不会代替你写完文章或向第三方平台自动发布。

## 一次完整使用流程

以一篇游戏开发文章为例：

1. 从已登录站长可见的文章底部点击“推广本文”，或在后台首页进入增长工作台
2. 先看首屏三个“下一步”，处理已有事实任务，不要先填 UTM
3. 在“文章证据分析”选择文章，确认最多三个真实搜索查询
4. 按需运行分析，分别查看 Search Gateway、GeoScore、Umami 和 GSC 状态
5. 只把有出处的搜索结果、GeoScore factual fail 和达标 GSC 查询当作证据
6. 在“分发证据包”选择一个真实渠道，补充事实、出处和要讨论的问题
7. 复制 UTM 链接和证据包，人工写成符合该社区语境的内容
8. 实际发布后将 Campaign 状态改为 `published`
9. 七天后复盘；落地访问少于 20 时只记录“证据不足”

## 为什么首页先显示三个下一步

工作台不是链接生成器。它先从现有任务、专题状态、历史快照和渠道状态中选出最多三个动作，例如：

- 修复一项有页面证据的 GeoScore critical fail
- 审核游戏开发专题草稿
- 为一篇文章建立首个四源基线
- 登记一个确实会使用的渠道

没有证据时，它不会用 0 分或猜测填满面板。

## 四个数据来源

| 来源 | 用途 | 不负责什么 |
| --- | --- | --- |
| Search Gateway | 搜索需求、竞品内容、标题和出处 | 不代表真实 AI 消费端引用 |
| GeoScore URL 模式 | SEO/GEO factual fail、页面证据、覆盖率和置信度 | Predicted 项不生成任务 |
| Umami | 落地访问、来源、UTM 和 `effective_read` | 不证明搜索排名原因 |
| Google Search Console | 查询、展示、点击、CTR 和平均排名 | 数据有延迟，不用于实时流量 |

每个来源独立返回 `complete | partial | not_configured | error`。一个来源失败时，其他成功结果仍可查看和保存。`not_configured` 或 `error` 不会被换算成零。

默认分析窗口是延迟三天的最近 28 天，并与此前 28 天对照。GSC 只有在展示量不少于 20，且平均排名处于 4–20 或 CTR 明显偏低时，才生成搜索改进任务。

## 专题管线

工作台专题状态为：

- `candidate`：只有初步证据，尚未整理
- `draft`：已有受众、阅读路线、作品和内容缺口，等待人工审核
- `published`：工作台认为可用，但仍不会自动写入公开源码
- `archived`：不再继续经营

公开专题的唯一事实源是 `src/data/topics.ts`。文章底部的专题阅读路径也只读取这里已经提交的关系，不会按标签相似度自动拼凑“相关文章”。

游戏开发是近期主轴。工作台种子同时记录文章、Game Jam、GitHub、itch.io、获奖作品和长期经历，避免近期服务器文章较多时覆盖真实长期方向。

## 渠道档案

渠道档案只保存：

- 平台或社区名称与入口
- UTM source 和 medium
- 受众、规则和适合内容
- 上次发布状态及聚合效果

不要保存账号密码、Cookie、登录状态、私信或用户数据。

`medium` 只使用：

```text
community | video | social | repository | referral | feed | email | offline
```

## 分发证据包

证据包不是一篇可复制到所有平台的宣传文。它包含：

- 可核验事实
- 证据和出处
- 适合该渠道的结构骨架
- 一个具体讨论问题
- 独立 UTM 链接
- 发布前检查
- 七天复盘门槛
- 可以交给写作 AI 的证据约束提示词

AI 提示词明确禁止虚构成绩、数字、引用、用户反馈和产品能力，也禁止自动发布。

## UTM 与复盘

默认 Campaign 名称为 `YYYYMM-{topic-or-post-slug}`。同一轮宣传跨平台时保持 Campaign 不变，只修改：

- `utm_source`：实际平台或来源
- `utm_medium`：渠道类别
- `utm_content`：具体位置，如 `thread-op`、`reply`、`video-description`

首要指标是 `effective_read` 数量，质量指标是 `effective_read / landing pageview`。少于 20 次落地访问时不要判断平台好坏。

## Cloudflare 配置

先应用 D1 migration，再把可选凭据写入 Cloudflare Pages Secrets。不要把实际值写入 `.env.example`、GitHub 代码、浏览器存储或 URL。

```text
SEARCH_GATEWAY_BASE_URL
SEARCH_GATEWAY_API_KEY
GEOSCORE_API_URL
GEOSCORE_ADMIN_TOKEN
UMAMI_API_URL
UMAMI_API_TOKEN
UMAMI_WEBSITE_ID
GSC_SERVICE_ACCOUNT_JSON
GSC_PROPERTY=sc-domain:sayori.org
```

GSC 配置步骤：

1. 在 Google Cloud 创建 Service Account
2. 不授予项目级编辑权限
3. 在 Search Console 的 `sc-domain:sayori.org` 属性中把 Service Account 邮箱添加为只读用户
4. 将完整 Service Account JSON 压成单行，写入 `GSC_SERVICE_ACCOUNT_JSON`
5. Worker 只申请 `https://www.googleapis.com/auth/webmasters.readonly`

Cloudflare Pages Secret 示例：

```powershell
pnpm dlx wrangler pages secret put GSC_SERVICE_ACCOUNT_JSON --project-name sayori-blog
```

其余变量使用同样方式逐项配置。不要把 Secret 作为普通 `[vars]` 写入 `wrangler.toml`。

## 故障边界

- `NOT_CONFIGURED`：缺少对应 Secret，补配置后重试
- `AUTH_FAILED`：上游 401/403，检查权限或轮换 Token
- `RATE_LIMITED`：额度或频率受限，稍后重试
- `TIMEOUT`、`NETWORK_ERROR`：网络或上游超时，其他来源仍可使用
- `PARTIAL_*`：保留成功证据，同时明确指出缺失能力
- `INVALID_RESPONSE`：上游格式变化，不得把结果解释成零

生产部署会先运行测试、构建、D1 migration 和线上版本验证。只有 `INDEXNOW_KEY` 已配置时，才在部署成功后提交 sitemap URL。Google 仍通过 sitemap 和 Search Console 发现普通文章，不使用 Google Indexing API。
