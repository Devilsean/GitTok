import type { GitHubUser, Issue, IssueComment, Repo, SearchReposResponse } from './types'

const API = 'https://api.github.com'

let authToken: string | null = localStorage.getItem('gittok_token')

export function getToken(): string | null {
  return authToken
}

export function setToken(token: string | null): void {
  authToken = token
  starCache.clear()
  if (token) localStorage.setItem('gittok_token', token)
  else localStorage.removeItem('gittok_token')
}

export class RateLimitError extends Error {
  constructor(
    public bucket: 'core' | 'search',
    public resetAt: string,
  ) {
    super('GitHub API 限额已用尽')
  }
}

export class AuthError extends Error {
  constructor() {
    super('登录已失效，请重新登录')
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

// ---- API 限额快照（用于页脚徽标） ----
export interface RateSnapshot {
  remaining: number
  limit: number
  bucket: string
}

let rateSnap: RateSnapshot | null = null
const rateListeners = new Set<() => void>()

export function subscribeRate(fn: () => void): () => void {
  rateListeners.add(fn)
  return () => rateListeners.delete(fn)
}

export function getRateSnapshot(): RateSnapshot | null {
  return rateSnap
}

function updateRate(remaining: number, limit: number, bucket: string): void {
  if (rateSnap && rateSnap.remaining === remaining && rateSnap.limit === limit) return
  rateSnap = { remaining, limit, bucket }
  rateListeners.forEach((l) => l())
}

// ---- 底层请求 ----
async function ghFetch(
  path: string,
  init: RequestInit = {},
  bucket: 'core' | 'search' = 'core',
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  let res: Response
  try {
    res = await fetch(API + path, { ...init, headers })
  } catch {
    throw new ApiError('网络请求失败，请检查网络连接', 0)
  }

  const remaining = res.headers.get('x-ratelimit-remaining')
  const limit = res.headers.get('x-ratelimit-limit')
  if (remaining !== null && limit !== null) {
    updateRate(Number(remaining), Number(limit), bucket)
  }

  if (res.status === 401) throw new AuthError()
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset')
    const resetAt = reset ? new Date(Number(reset) * 1000).toLocaleTimeString() : ''
    throw new RateLimitError(bucket, resetAt)
  }
  return res
}

// ---- 搜索（含会话级缓存，避免来回切 Tab 重复请求） ----
const SEARCH_TTL = 10 * 60 * 1000
const searchCache = new Map<string, { at: number; data: SearchReposResponse }>()

function cacheGet(key: string): SearchReposResponse | null {
  const hit = searchCache.get(key)
  if (hit && Date.now() - hit.at < SEARCH_TTL) return hit.data
  if (hit) searchCache.delete(key)
  return null
}

function cacheSet(key: string, data: SearchReposResponse): void {
  if (searchCache.size > 80) {
    const oldest = searchCache.keys().next().value
    if (oldest) searchCache.delete(oldest)
  }
  searchCache.set(key, { at: Date.now(), data })
}

export async function searchRepos(
  query: string,
  page = 1,
  perPage = 15,
  sort?: string,
): Promise<SearchReposResponse> {
  const key = JSON.stringify([query, page, perPage, sort ?? ''])
  const hit = cacheGet(key)
  if (hit) return hit

  const params = new URLSearchParams({
    q: query,
    order: 'desc',
    per_page: String(perPage),
    page: String(page),
  })
  if (sort) params.set('sort', sort)

  const res = await ghFetch(`/search/repositories?${params}`, {}, 'search')
  if (res.status === 422) throw new ApiError('查询语法无效，请换个关键词试试', 422)
  if (!res.ok) throw new ApiError(`搜索失败（HTTP ${res.status}）`, res.status)
  const data = (await res.json()) as SearchReposResponse
  cacheSet(key, data)
  return data
}

// ---- README ----
const readmeCache = new Map<string, string | null>()

/**
 * README 拉取：优先走 raw.githubusercontent.com 直链——不消耗 GitHub API 额度、
 * 也不需要登录，未登录用户因此能刷得远得多（60 次/小时的额度只花在搜索上）。
 * raw 拿不到时回退 API（能精确命中 README.rst 等非常规文件名）。
 */
export async function getReadme(fullName: string, branch?: string): Promise<string | null> {
  if (readmeCache.has(fullName)) return readmeCache.get(fullName)!
  if (branch) {
    const raw = await rawReadme(fullName, branch)
    if (raw !== null) {
      readmeCache.set(fullName, raw)
      return raw
    }
  }
  const res = await ghFetch(`/repos/${fullName}/readme`, {
    headers: { Accept: 'application/vnd.github.raw' },
  })
  if (res.status === 404) {
    readmeCache.set(fullName, null)
    return null
  }
  if (!res.ok) throw new ApiError(`README 获取失败（HTTP ${res.status}）`, res.status)
  const text = await res.text()
  readmeCache.set(fullName, text)
  return text
}

/** raw 直链并行尝试常见文件名；全部 404 / 网络失败返回 null，由调用方回退 API */
async function rawReadme(fullName: string, branch: string): Promise<string | null> {
  const names = ['README.md', 'readme.md']
  const results = await Promise.all(
    names.map(async (name) => {
      try {
        const res = await fetch(`https://raw.githubusercontent.com/${fullName}/${branch}/${name}`)
        if (!res.ok) return null
        const text = await res.text()
        // 过短的内容多半是占位文件，交给 API 精确处理
        return text.trim().length >= 80 ? text : null
      } catch {
        return null
      }
    }),
  )
  return results.find((t): t is string => !!t) ?? null
}

// ---- 用户 / Star ----
export async function getCurrentUser(): Promise<GitHubUser> {
  const res = await ghFetch('/user')
  if (!res.ok) throw new ApiError(`获取用户信息失败（HTTP ${res.status}）`, res.status)
  return res.json()
}

export async function getStarred(page = 1): Promise<Repo[]> {
  const res = await ghFetch(`/user/starred?per_page=100&page=${page}`)
  if (!res.ok) throw new ApiError(`获取 Star 列表失败（HTTP ${res.status}）`, res.status)
  return res.json()
}

// Star 状态的会话级缓存：卡片每次激活都重新查询的话，每张卡都要烧掉 1 次核心额度
const starCache = new Map<string, boolean>()

export async function checkStarred(fullName: string): Promise<boolean> {
  const hit = starCache.get(fullName)
  if (hit !== undefined) return hit
  const res = await ghFetch(`/user/starred/${fullName}`)
  const v = res.status === 204
  starCache.set(fullName, v)
  return v
}

export async function setStar(fullName: string, starred: boolean): Promise<void> {
  const res = await ghFetch(`/user/starred/${fullName}`, { method: starred ? 'PUT' : 'DELETE' })
  if (!res.ok) throw new ApiError(`同步 Star 失败（HTTP ${res.status}）`, res.status)
  starCache.set(fullName, starred)
}

// 主动查询限额（/rate_limit 本身不消耗额度）
export async function refreshRateLimit(): Promise<void> {
  try {
    const res = await fetch(API + '/rate_limit', {
      headers: authToken
        ? { Accept: 'application/vnd.github+json', Authorization: `Bearer ${authToken}` }
        : { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return
    const data = (await res.json()) as {
      resources: { core: { remaining: number; limit: number } }
    }
    updateRate(data.resources.core.remaining, data.resources.core.limit, 'core')
  } catch {
    /* 忽略 */
  }
}

// ---- 讨论（直接复用 GitHub Issues 作为评论系统） ----
const issuesCache = new Map<string, Issue[]>()

/** 仓库讨论列表（已过滤掉 PR）。sort=comments 最热 / created 最新 */
export async function getRepoIssues(
  fullName: string,
  sort: 'comments' | 'created',
): Promise<Issue[]> {
  const key = `${fullName}:${sort}`
  const hit = issuesCache.get(key)
  if (hit) return hit
  const res = await ghFetch(
    `/repos/${fullName}/issues?state=all&sort=${sort}&direction=desc&per_page=20`,
  )
  if (res.status === 404) throw new ApiError('该仓库未开启 Issues', 404)
  if (!res.ok) throw new ApiError(`讨论加载失败（HTTP ${res.status}）`, res.status)
  const data = (await res.json()) as Issue[]
  const list = data.filter((i) => !i.pull_request)
  issuesCache.set(key, list)
  return list
}

const issueCommentsCache = new Map<string, IssueComment[]>()

export async function getIssueComments(fullName: string, number: number): Promise<IssueComment[]> {
  const key = `${fullName}#${number}`
  const hit = issueCommentsCache.get(key)
  if (hit) return hit
  const res = await ghFetch(`/repos/${fullName}/issues/${number}/comments?per_page=30`)
  if (!res.ok) throw new ApiError(`评论加载失败（HTTP ${res.status}）`, res.status)
  const list = (await res.json()) as IssueComment[]
  issueCommentsCache.set(key, list)
  return list
}
