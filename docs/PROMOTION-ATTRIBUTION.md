# Promotion attribution

博客后台的推广链接工具只生成标准 UTM 链接，不生成平台正文，不保存统计，也不提供短链

## UTM 约定

```text
{URL}?utm_source={source}&utm_medium={medium}&utm_campaign={campaign}&utm_content={placement}
```

- `source` 表示具体来源，可填写任意论坛、网站、视频平台或完整 URL
- `medium` 只使用 `community`、`video`、`social`、`repository`、`referral`、`feed`、`email`、`offline`
- `campaign` 表示同一轮宣传，默认格式为 `YYYYMM-{target-slug}`
- `content` 区分同一来源中的具体位置，例如 `thread-op`、`reply`、`profile`、`video-description`

同一轮宣传跨平台时保持 `campaign` 不变，只调整 `source` 和 `content`

不要给站内链接或 organic search 添加 UTM，避免覆盖真实来源。参数不得包含用户名、凭据或个人信息

## Effective Read

`effective_read` 是 Umami 自定义事件，只用于正式文章页

事件同时满足以下条件才发送一次：

- 页面处于可见状态的累计时间达到 45 秒
- 正文阅读进度达到 50%

日记、加密文章和非文章页不发送。事件只带文章路径、文章 ID、固定阈值及当前 URL 中非敏感的 UTM 字段，不带 referrer、访客身份或原始 IP

## 评估口径

- 首要指标：每个来源和 campaign 的 `effective_read` 总数
- 质量指标：`effective_read / landing pageview`
- 单个来源少于 20 次落地访问时标记为证据不足，不据此判断渠道质量
- 日记不主动推广，不纳入增长 KPI
- 社区帖子提供平台原生价值，博客链接只承担完整材料入口
