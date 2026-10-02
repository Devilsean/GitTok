import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useFeed } from '../hooks/useFeed'
import { useSnapScroll } from '../hooks/useSnapScroll'
import type { Feed } from '../feeds'
import { RepoCard } from './RepoCard'

interface Props {
  feed: Feed | null
  /** 当前 Tab 是否激活（未激活不加载、不响应手势） */
  active: boolean
  /** 顶部覆盖层（时间窗切换 / 筛选 chip 等） */
  overlay?: ReactNode
}

/**
 * TikTok 式全屏竖向信息流：
 * - CSS scroll-snap 吸附 + 滚轮/键盘逐卡翻页（触摸设备走原生惯性滚动）
 * - IntersectionObserver 追踪当前卡片，驱动 README 懒加载与预取
 * - 同 Tab 切走再切回时保留浏览位置（父组件保持挂载、仅隐藏）
 */
export function FeedViewer({ feed, active, overlay }: Props) {
  const { items, status, error, loadMore } = useFeed(feed, active)
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const indexRef = useRef(0)
  const startedKeyRef = useRef('')

  // 首次激活该 Tab 时开始加载
  useEffect(() => {
    if (!active || !feed) return
    if (startedKeyRef.current === feed.key) return
    startedKeyRef.current = feed.key
    void loadMore()
  }, [active, feed, loadMore])

  // 快滑到底部前预取下一页
  useEffect(() => {
    if (status === 'ready' && items.length - activeIndex <= 5) void loadMore()
  }, [status, items.length, activeIndex, loadMore])

  // feed 更换时回到顶部
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0 })
    indexRef.current = 0
    setActiveIndex(0)
  }, [feed?.key])

  // 追踪当前可见卡片
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting || en.intersectionRatio < 0.6) continue
          const idx = Number((en.target as HTMLElement).dataset.index)
          if (!Number.isNaN(idx)) {
            indexRef.current = idx
            setActiveIndex(idx)
          }
        }
      },
      { root: el, threshold: [0.6] },
    )
    el.querySelectorAll('[data-slide]').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [items.length, status, feed?.key])

  const goTo = useCallback(
    (i: number) => {
      const el = containerRef.current
      if (!el || items.length === 0) return
      const clamped = Math.max(0, Math.min(i, items.length - 1))
      el.querySelector<HTMLElement>(`[data-index="${clamped}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    },
    [items.length],
  )

  useSnapScroll({ containerRef, indexRef, goTo, enabled: active })

  return (
    <section className="viewer-wrap" style={{ display: active ? 'block' : 'none' }}>
      <div className="viewer" ref={containerRef}>
        {items.map((item, i) => (
          <RepoCard key={item.repo.id} item={item} active={active && i === activeIndex} index={i} />
        ))}

        {items.length === 0 && (status === 'idle' || status === 'loading') && (
          <div className="slide slide-center">
            <div className="center-msg">
              <div className="spinner" />
              <p className="muted">正在加载仓库…</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="slide slide-center">
            <div className="center-msg">
              <div className="emoji">⚠️</div>
              <p className="muted">{error}</p>
              <button className="btn accent" onClick={() => void loadMore()}>
                重试
              </button>
            </div>
          </div>
        )}

        {status === 'done' && items.length === 0 && (
          <div className="slide slide-center">
            <div className="center-msg">
              <div className="emoji">🕳️</div>
              <p className="muted">没有找到相关仓库</p>
            </div>
          </div>
        )}

        {status === 'done' && items.length > 0 && (
          <div className="slide slide-center">
            <div className="center-msg">
              <div className="emoji">🎉</div>
              <p className="muted">已经到底啦，去别的频道逛逛吧</p>
            </div>
          </div>
        )}
      </div>
      {overlay}
    </section>
  )
}
