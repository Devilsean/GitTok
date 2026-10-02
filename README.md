# 🐙 GitTok

**像刷 TikTok 一样刷 GitHub。**

全屏竖向信息流，上下滑动逐个浏览 GitHub 仓库：README 预览、语言徽标、Star/Fork 数据、话题标签，双击点赞，登录后可直接把仓库 Star 到你的 GitHub 账号。

![技术栈](https://img.shields.io/badge/React_18-Vite_5-TypeScript-3178c6) ![依赖](https://img.shields.io/badge/依赖-仅4个运行时依赖-3fb950) ![后端](https://img.shields.io/badge/后端-无-8b949e)

## 功能

| 频道 | 说明 |
| --- | --- |
| 🔥 热门 | 近期创建的高星仓库（近似 GitHub Trending，支持 本周 / 本月 / 近三月 时间窗） |
| 🧭 频道 | 按语言（20 种预设 + 自定义主题）刷对应领域的仓库 |
| 🔍 搜索 | 关键词搜索，结果进入同样的滑动浏览模式 |
| ✨ 推荐 | 登录后根据你 Star 过的仓库统计高频语言/主题，推荐同类宝藏项目 |
| 🔖 我的 | 本地点赞与收藏列表（保存完整快照，刷新不丢） |

**交互**：滚轮 / ↑↓ 方向键 / J K / PgUp PgDn / 触摸滑动 翻页；双击卡片点赞（爱心爆发动效）；右侧操作栏支持 点赞 / Star 到 GitHub / 💬 讨论馈 / 收藏 / 复制链接；滑到底部前自动预取下一页。

**💬 讨论即评论**：不另建评论系统，每张卡的讨论区直接复用该仓库的 GitHub Issues——看最热/最新的 issue、内联展开 issue 正文与评论，深度互动一键跳转 GitHub 原帖。

**其他**：暗色主题；页脚实时显示 GitHub API 剩余额度；README 懒加载预览（仅当前卡片拉取，自动清洗徽标 HTML）；限流友好提示。

## 快速开始

```bash
npm install
npm run dev        # 打开 http://localhost:5173
```

**不登录也能刷**：直接浏览热门 / 频道 / 搜索，点赞收藏保存在浏览器本地。
未登录时 GitHub API 限额 60 次/小时（搜索 10 次/分钟），登录后提升到 5000 次/小时。

### 登录 GitHub（可选，解锁同步 Star + 个性化推荐）

GitTok 使用 **GitHub OAuth 设备码登录**（无需后端、无需 client secret、无固定回调地址）：

1. 打开 [GitHub OAuth App 创建页](https://github.com/settings/applications/new)，应用名随意，Homepage URL 填 `http://localhost:5173`，回调 URL 可不填
2. 创建后进入应用设置，勾选 **Enable Device Flow**
3. 复制 Client ID：
   ```bash
   cp .env.example .env
   # 编辑 .env，填入 VITE_GITHUB_CLIENT_ID=你的client_id
   ```
4. 重启 `npm run dev`，点击右上角「登录 GitHub」→ 输入设备码完成授权

设备码流程需要访问 `github.com`；如果你的网络访问 github.com 不稳定，可以改用 **Personal Access Token 登录**（只依赖 `api.github.com`，勾选 `public_repo` 权限即可，登录弹窗里有直达创建链接），或者把 `VITE_GH_AUTH_BASE` 指向你自建的代理。

## 生产部署说明

构建产物是纯静态文件（`npm run build` → `dist/`），但设备码登录需要一个小代理转发请求到 GitHub（浏览器直连 github.com 的 OAuth 端点会被 CORS 拦截）。开发环境由 Vite 代理（`vite.config.ts` 中的 `/gh-auth`）承担；生产环境部署一个几行的 Cloudflare Worker 即可：

```js
export default {
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname.startsWith('/gh-auth/')) {
      return fetch('https://github.com' + url.pathname.slice('/gh-auth'.length), req)
    }
    return new Response('not found', { status: 404 })
  },
}
```

然后给前端设置环境变量 `VITE_GH_AUTH_BASE=https://你的worker域名/gh-auth` 重新构建。仓库数据（api.github.com）始终由浏览器直连，不经过代理。

## 项目结构

```
src/
├─ api/            # GitHub REST 封装：限流处理、搜索缓存、Star 同步
├─ auth/           # 登录态 Context + 设备码登录轮询
├─ feeds/          # 四类内容流：trending / language / search / recommend
├─ hooks/          # useFeed（分页预取）、useSnapScroll（滚轮/键盘翻页）
├─ components/     # FeedViewer、RepoCard、ReadmePreview、ActionBar、各面板
├─ utils/          # 本地存储 store、toast、格式化、语言配色
└─ styles/         # 暗色主题全局样式
```

## 实现说明

- **数据源**：GitHub 没有官方 Trending API，热门流用 `created:>近N天 stars:>10` 按 star 排序近似；推荐流拉取用户最近 200 个 Star 统计语言/主题后定向搜索并去重
- **API 策略**：搜索结果内存缓存 10 分钟（切 Tab 不重复请求）；README 仅在卡片激活时拉取；页脚徽标实时展示剩余额度
- **隐私**：Token、点赞、收藏全部只存浏览器 localStorage，没有任何服务器
