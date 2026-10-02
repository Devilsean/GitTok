import type { GitHubUser, Repo, SearchReposResponse } from './types'

const API = 'https://api.github.com'

let authToken: string | null = localStorage.getItem('gittok_token')

export function getToken(): string | null {
  return authToken
}

export function setToken(token: string | null): void {
  authToken = token
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

export async function getReadme(fullName: string): Promise<string | null> {
  if (readmeCache.has(fullName)) return readmeCache.get(fullName)!
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

export async function checkStarred(fullName: string): Promise<boolean> {
  const res = await ghFetch(`/user/starred/${fullName}`)
  if (res.status === 204) return true
  if (res.status === 404) return false
  return false
}

export async function setStar(fullName: string, starred: boolean): Promise<void> {
  const res = await ghFetch(`/user/starred/${fullName}`, { method: starred ? 'PUT' : 'DELETE' })
  if (!res.ok) throw new ApiError(`同步 Star 失败（HTTP ${res.status}）`, res.status)
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
