import { getStarred, searchRepos } from '../api/github'
import type { Repo } from '../api/types'

export interface FeedItem {
  repo: Repo
  /** 推荐理由（仅推荐流有），如"因为你 star 过 facebook/react" */
  reason?: string
}

export interface Feed {
  key: string
  getPage: (page: number, perPage: number) => Promise<FeedItem[]>
}

export class RecommendError extends Error {}

/**
 * 热门趋势流。GitHub 没有官方 Trending API，
 * 用「最近 N 天创建 + 已有一定 star」按 star 数排序来近似趋势。
 */
export function makeTrendingFeed(windowDays: number): Feed {
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10)
  const q = `created:>${since} stars:>10`
  return {
    key: `trending:${windowDays}`,
    getPage: async (page, perPage) => {
      const r = await searchRepos(q, page, perPage, 'stars')
      return r.items.map((repo) => ({ repo }))
    },
  }
}

/** 语言 / 主题筛选流 */
export function makeLanguageFeed(kind: 'language' | 'topic', value: string): Feed {
  const q =
    kind === 'language' ? `language:${value} stars:>100` : `topic:${value} stars:>50`
  return {
    key: `lang:${kind}:${value}`,
    getPage: async (page, perPage) => {
      const r = await searchRepos(q, page, perPage, 'stars')
      return r.items.map((repo) => ({ repo }))
    },
  }
}

/** 关键词搜索流（按 GitHub 默认相关度排序） */
export function makeSearchFeed(keyword: string): Feed {
  const q = keyword.trim()
  return {
    key: `search:${q}`,
    getPage: async (page, perPage) => {
      const r = await searchRepos(q, page, perPage)
      return r.items.map((repo) => ({ repo }))
    },
  }
}

/**
 * 个性化推荐流：拉取用户最近 Star 的仓库（前 200 个），
 * 统计高频语言与主题，围绕 top 主题/语言搜索高星仓库，
 * 剔除已 Star 的，合并打散后作为推荐池。
 */
export function makeRecommendFeed(): Feed {
  let pool: FeedItem[] | null = null
  let poolPromise: Promise<FeedItem[]> | null = null

  async function buildPool(): Promise<FeedItem[]> {
    const [first, second] = await Promise.all([
      getStarred(1),
      getStarred(2).catch(() => [] as Repo[]),
    ])
    const starred = [...first, ...second]
    if (starred.length === 0) {
      throw new RecommendError('你还没有给任何仓库点过 Star。先去 GitHub 收藏几个喜欢的项目，我就能猜你的口味了')
    }

    const starredNames = new Set(starred.map((r) => r.full_name))
    const langCount = new Map<string, { n: number; example: string }>()
    const topicCount = new Map<string, { n: number; example: string }>()
    for (const r of starred) {
      if (r.language) bump(langCount, r.language, r.full_name)
      for (const t of r.topics ?? []) bump(topicCount, t, r.full_name)
    }

    const topTopics = [...topicCount.entries()]
      .filter(([, v]) => v.n >= 2)
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 4)
    const topLangs = [...langCount.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 2)

    const seeds = [
      ...topTopics.map(([topic, v]) => ({
        query: `topic:${topic} stars:>500`,
        reason: `因为你 star 过 ${v.example}`,
      })),
      ...topLangs.map(([lang, v]) => ({
        query: `language:${lang} stars:>2000`,
        reason: `因为你 star 过 ${v.example}`,
      })),
    ].slice(0, 5)

    if (seeds.length === 0) {
      throw new RecommendError('你 Star 的仓库信息还不足以推断口味（缺少语言/主题特征）')
    }

    const buckets = await Promise.all(
      seeds.map(async (seed) => {
        try {
          const r = await searchRepos(seed.query, 1, 12, 'stars')
          return { seed, repos: r.items }
        } catch {
          return { seed, repos: [] as Repo[] }
        }
      }),
    )

    const seen = new Set<number>()
    const out: FeedItem[] = []
    for (const b of buckets) {
      for (const repo of b.repos) {
        if (seen.has(repo.id) || starredNames.has(repo.full_name)) continue
        seen.add(repo.id)
        out.push({ repo, reason: b.seed.reason })
      }
    }
    // 打散不同来源，让每次刷新都有新鲜感
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }

  return {
    key: 'recommend',
    getPage: async (page, perPage) => {
      if (!pool) {
        poolPromise = poolPromise ?? buildPool()
        pool = await poolPromise
      }
      const start = (page - 1) * perPage
      return pool.slice(start, start + perPage)
    },
  }
}

function bump(
  map: Map<string, { n: number; example: string }>,
  key: string,
  example: string,
): void {
  const cur = map.get(key)
  if (cur) cur.n += 1
  else map.set(key, { n: 1, example })
}
