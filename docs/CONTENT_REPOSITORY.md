# Mizuki 内容仓库结构说明

本文档说明如何创建和组织 Mizuki 博客的内容仓库。

## 📁 推荐的目录结构

```
Mizuki-Content/
├── posts/              # 博客文章
│   ├── post-1.md
│   ├── post-2.md
│   └── my-article/
│       ├── index.md
│       └── cover.jpg
├── spec/               # 特殊页面
│   ├── about.md
│   └── friends.md
├── data/               # 数据文件
│   ├── anime.ts
│   ├── projects.ts
│   ├── skills.ts
│   └── timeline.ts
├── images/             # 图片资源
│   ├── albums/         # 相册图片
│   ├── diary/          # 日记图片
│   └── posts/          # 文章图片
└── README.md
```

## 🚀 快速开始

### 1. 创建新的内容仓库

```bash
# 创建新仓库
mkdir Mizuki-Content
cd Mizuki-Content
git init

# 创建基本目录结构
mkdir -p posts spec data images/albums images/diary images/posts

# 创建 README
echo "# Mizuki 博客内容" > README.md
```

### 2. 从现有 Mizuki 项目迁移内容

如果你已经有一个 Mizuki 项目,可以将内容迁移到新仓库:

```bash
# 在 Mizuki 项目根目录执行
cd /path/to/Mizuki

# 复制内容到新仓库
cp -r src/content/posts/* /path/to/Mizuki-Content/posts/
cp -r src/content/spec/* /path/to/Mizuki-Content/spec/
cp -r src/data/* /path/to/Mizuki-Content/data/
cp -r public/images/* /path/to/Mizuki-Content/images/
```

### 3. 提交到 Git

```bash
cd /path/to/Mizuki-Content

git add .
git commit -m "Initial commit: Add blog content"

# 添加远程仓库并推送
git remote add origin https://github.com/your-username/Mizuki-Content.git
git branch -M main
git push -u origin main
```

## 🔗 连接到 Mizuki 代码仓库

### 方式一: Git Submodule (推荐)

在 Mizuki 代码仓库中:

```bash
cd /path/to/Mizuki

# 添加内容仓库作为 submodule
git submodule add https://github.com/your-username/Mizuki-Content.git content

# 提交 submodule 配置
git add .gitmodules content
git commit -m "Add content repository as submodule"
git push
```

配置环境变量 `.env`:

```bash
CONTENT_REPO_URL=https://github.com/your-username/Mizuki-Content.git
USE_SUBMODULE=true
```

### 方式二: 独立仓库模式

配置环境变量 `.env`:

```bash
CONTENT_REPO_URL=https://github.com/your-username/Mizuki-Content.git
CONTENT_DIR=./content
USE_SUBMODULE=false
```

然后运行同步:

```bash
pnpm run sync-content
```

## 📝 内容编写指南

### 文章前言 (Frontmatter)

每篇文章都应该包含以下前言:

```yaml
---
title: 文章标题
published: 2024-01-01
description: 文章描述
image: ./cover.jpg
tags: [标签1, 标签2]
category: 分类
draft: false
pinned: false
lang: zh-CN
---
```

### 目录组织

- **单文件文章**: 直接在 `posts/` 目录下创建 `.md` 文件
- **包含图片的文章**: 创建文件夹,将 `index.md` 和图片放在一起

示例:
```
posts/
├── simple-post.md                    # 简单文章
└── complex-post/                     # 复杂文章
    ├── index.md                      # 文章内容
    ├── cover.jpg                     # 封面图
    └── diagram.png                   # 文章中的图片
```

## 🔄 更新工作流

### 本地开发

1. 修改内容仓库中的文件
2. 提交并推送更改
3. 在代码仓库中同步内容:
   ```bash
   cd /path/to/Mizuki
   pnpm run sync-content
   ```

### 使用 Submodule 时

```bash
# 更新 submodule
cd /path/to/Mizuki
git submodule update --remote --merge

# 或者使用同步脚本
pnpm run sync-content
```

### 部署时自动同步

在 CI/CD 配置中添加:

```yaml
- name: Sync Content
  run: pnpm run sync-content
  env:
    CONTENT_REPO_URL: ${{ secrets.CONTENT_REPO_URL }}
    USE_SUBMODULE: true
```

## 📦 数据文件说明

### anime.ts
番剧数据配置,包含你观看的动画列表。

### projects.ts
项目展示数据,展示你的作品集。

### skills.ts
技能数据,展示你的技术栈。

### timeline.ts
时间线数据,记录重要事件。

## 🎨 图片管理

### 目录说明

- `images/albums/`: 相册页面的图片
- `images/diary/`: 日记页面的图片  
- `images/posts/`: 文章中引用的公共图片

### 图片引用

在文章中引用图片:

```markdown
<!-- 相对路径 (推荐) -->
![描述](./image.jpg)

<!-- 公共图片目录 -->
![描述](/images/posts/image.jpg)
```

### 生产图片 CDN

文章源图继续和 Markdown 一起保存在 `sayori-articles/posts`。本地开发不设置 `BLOG_MEDIA_BASE_URL` 时，`sync-content.js` 会把图片复制到本地公开目录，便于离线预览。

生产流水线会先执行 `pnpm run prepare-media`：

- PNG 使用 near-lossless WebP quality 85，JPEG 等栅格图使用 WebP quality 82
- 生成不放大的 `640`、`1280`、`1920` 响应式尺寸
- 动画 WebP 保留全部帧，GIF 与 SVG 保留原格式
- 对象写入 `sayori-media` R2 的 `blog/v1/<sha256>/` 前缀
- manifest 保存源路径、内容哈希、宽高、字节数、主 URL 和响应式变体
- 生产同步缺少 manifest、远端对象、正确 MIME 或匹配字节数时直接失败

页面最终使用 `https://img.sayori.org/blog/v1/...`，并生成 `srcset`、`sizes`、原始宽高、`loading="lazy"` 和 `decoding="async"`。头像、Banner、赞助码及其他站点 UI 资源仍由 Cloudflare Pages 托管，不进入这条正文图片管线。

GitHub Actions 只通过 `BLOG_MEDIA_CF_API_TOKEN` 上传 HEAD 检查为缺失的对象。这个 token 只需要目标 R2 bucket 的写权限，不应写入 `.env`、manifest、构建产物或文章仓库。

## ⚠️ 注意事项

1. **不要**在内容仓库中包含代码文件
2. **保持**目录结构与主仓库一致
3. **定期**备份重要内容
4. **使用** Git LFS 管理大型图片文件(可选)

## 🔐 私有内容仓库

如果你的内容仓库是私有的，需要配置访问权限。详细的配置方法请参考：

- [内容分离完整指南 - 私有仓库配置](./CONTENT_SEPARATION.md#-私有仓库配置)
- [部署指南](./DEPLOYMENT.md) - 各平台的私有仓库部署配置

### 快速参考

**本地开发**: 推荐使用 SSH 密钥
```bash
CONTENT_REPO_URL=git@github.com:your-username/Mizuki-Content-Private.git
USE_SUBMODULE=true
```

**CI/CD 部署**: 根据平台选择
- GitHub Actions: 使用 `GITHUB_TOKEN` (同账号) 或 SSH 密钥
- Vercel/Netlify: 授权访问或使用 Token

## 📚 参考资源

- [Git Submodule 文档](https://git-scm.com/book/zh/v2/Git-%E5%B7%A5%E5%85%B7-%E5%AD%90%E6%A8%A1%E5%9D%97)
- [Mizuki 文档](https://docs.mizuki.mysqil.com/)
- [Astro Content Collections](https://docs.astro.build/zh-cn/guides/content-collections/)

---

💡 **提示**: 建议先在本地测试内容同步流程,确保一切正常后再配置自动化部署。
