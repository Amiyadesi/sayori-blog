# Sayori Blog Domain Context

This document defines the stable domain language for the blog growth workflow. Public content remains Git-managed; the growth workbench is a private evidence and planning layer.

## Core Terms

### Topic

A maintained reading route that connects a specific audience, a set of published articles, public work links, content gaps, and questions.

- Public topics live in `src/data/topics.ts` and are reviewed through Git
- Workbench topics use `candidate | draft | published | archived`
- A D1 topic marked `published` does not publish source files automatically
- Article footers only use associations from the public topic source; they do not infer generic related posts

### Campaign

One bounded distribution effort for a topic or article. The default name is `YYYYMM-{topic-or-post-slug}`. The same campaign name may be reused across channels while `source` and `content` identify the actual placement.

A Campaign uses `draft | published | reviewed | archived`. It is reviewed seven days after publication. Fewer than 20 landing visits means insufficient evidence, not failure.

### Effective Read

The primary reading outcome. An `effective_read` event is sent once when a normal public article has accumulated both:

- 45 visible seconds
- 50 percent article progress

Diary, encrypted, and non-article pages are excluded. The event carries the article path and bounded UTM fields, not visitor identity or raw referrer data.

### Distribution Evidence Pack

A private handoff package for one channel. It contains verified facts, sources, a channel-native structure, discussion questions, a UTM link, preflight checks, review conditions, and an evidence-constrained AI prompt.

It is not a reusable cross-platform promotional post and never publishes automatically.

### Milestone

A verifiable game-development result such as a playable build, released level, public repository change, competition result, postmortem, or documented design experiment. Game-development planning uses long-term milestones and works, not only recent traffic or post counts.

After 14 days without a recorded milestone, the workbench may suggest a lightweight Devlog task. The reminder is not evidence that progress stopped.

### Growth Task

A reviewable action derived from stored state or qualified external evidence. Current task sources are:

- factual GeoScore checks whose state is `fail` and is not Predicted
- GSC queries with at least 20 impressions and a qualified position or CTR opportunity
- explicit topic, channel, Campaign, or milestone workflow state

Missing configuration, timeouts, `unknown`, `error`, and insufficient data do not create fake tasks.

## Workflow

```text
Topic or article
  -> explicit four-source analysis
  -> factual tasks and short-lived snapshots
  -> human-reviewed distribution evidence pack
  -> manual publication on the chosen channel
  -> seven-day Umami and GSC review
  -> keep, revise, or archive
```

Search Gateway finds real search demand and cited pages. GeoScore supplies factual SEO/GEO failures. Umami measures landing and effective reading. Google Search Console supplies delayed search query evidence. Each source reports `complete | partial | not_configured | error` independently.

## Sources Of Truth

- Public articles and public topics: Git repositories
- Growth drafts, channels, tasks, Campaign state, and temporary snapshots: D1
- Search and reading observations: their upstream services, copied into bounded D1 snapshots
- Credentials: Cloudflare Pages Secrets only

## Retention

- Analysis snapshots: 30 days
- Completed task and Campaign detail: 180 days
- Older completed detail: annual aggregate rows
- Active topics and tasks: no automatic deletion
- Pruning: opportunistically at most once per day on an authenticated workbench request

## Product Boundaries

- No forum login, automatic posting, automatic reply, or bulk distribution
- No automatic article modification or topic publication
- No GA4 API duplication; GA4 remains a manual cross-check
- No Google Indexing API for ordinary blog posts
- IndexNow runs only after a successful production deployment and only when its key is configured
