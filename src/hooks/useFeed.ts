import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthError, RateLimitError } from '../api/github'
import { RecommendError, type Feed, type FeedItem } from '../feeds'

export type FeedStatus = 'idle' | 'loading' | 'ready' | 'done' | 'error'

/**
 * 内容流的分页加载：loadMore 追加下一页，feed.key 变化时自动重置。
 * enabled=false（Tab 未激活）时不发请求。
 */
export function useFeed(feed: Feed | null, enabled: boolean) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [status, setStatus] = useState<FeedStatus>('idle')
  const [error, setError] = useState('')
  const pageRef = useRef(0)
  const busyRef = useRef(false)
  const reqRef = useRef(0)
  const lastKeyRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    // feed 切换时作废在途请求并清空。
    // 用 ref 记录上次处理过的 key，避免 StrictMode 下 effect 双跑造成误作废。
    const key = feed?.key
    if (lastKeyRef.current === key) return
    lastKeyRef.current = key
    reqRef.current++
    busyRef.current = false
    pageRef.current = 0
    setItems([])
    setStatus('idle')
    setError('')
  }, [feed?.key])

  const loadMore = useCallback(async () => {
    if (!feed || !enabled || busyRef.current) return
    if (status === 'done') return
    busyRef.current = true
    const req = ++reqRef.current
    setStatus((s) => (s === 'idle' || s === 'error' ? 'loading' : s))
    try {
      const page = pageRef.current + 1
      const next = await feed.getPage(page, 15)
      if (reqRef.current !== req) return
      pageRef.current = page
      setItems((prev) => {
        const ids = new Set(prev.map((x) => x.repo.id))
        return [...prev, ...next.filter((x) => !ids.has(x.repo.id))]
      })
      setStatus(next.length === 0 ? 'done' : 'ready')
    } catch (e) {
      if (reqRef.current !== req) return
      let msg = '加载失败，请稍后重试'
      if (e instanceof RecommendError) msg = e.message
      else if (e instanceof RateLimitError) {
        msg = `GitHub API 限额已用尽${e.resetAt ? `，${e.resetAt} 后恢复` : ''}。登录后限额提升为 5000 次/小时`
      } else if (e instanceof AuthError) {
        msg = '登录已失效，请点击右上角重新登录'
      } else if (e instanceof Error) {
        msg = e.message
      }
      setError(msg)
      setStatus('error')
    } finally {
      busyRef.current = false
    }
  }, [feed, enabled, status])

  return { items, status, error, loadMore }
}
