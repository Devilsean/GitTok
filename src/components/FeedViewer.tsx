import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useFeed } from '../hooks/useFeed'
import { useSnapScroll } from '../hooks/useSnapScroll'
import type { Feed } from '../feeds'
import { prefetchCardMedia } from '../utils/mediaCache'
import { bumpSeen } from '../utils/seen'
import { RepoCard } from './RepoCard'

interface Props {
  feed: Feed | null
  /** 当前 Tab 是否激活（未激活不加载、不响应手势） */
  active: boolean
  /** 顶部覆盖层（时间窗切换 / 筛选 chip 等） */
  overlay?: ReactNode
  /** 点话题标签：站内切入对应频道流 */
  onTopic?: (topic: string) => void
  /** 点作者：站内切入该作者的仓库流 */
  onAuthor?: (login: string) => void
}

const POS_PREFIX = 'gittok_pos:'

function savePos(feedKey: string, idx: number): void {
  try {
    localStorage.setItem(POS_PREFIX + feedKey, String(idx))
    // 控制总量，避免搜索等一次性流把存储撑爆
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(POS_PREFIX))
    for (const k of keys.slice(0, keys.length - 40)) localStorage.removeItem(k)
  } catch {
    /* 存储不可用时忽略 */
  }
}

function loadPos(feedKey: string): number {
  try {
    const v = Number(localStorage.getItem(POS_PREFIX + feedKey))
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
  } catch {
    return 0
  }
}

/**
 * TikTok 式全屏竖向信息流：
 * - CSS scroll-snap 吸附 + 滚轮/键盘逐卡翻页（触摸设备走原生惯性滚动）
 * - IntersectionObserver 追踪当前卡片，驱动 README 懒加载与预取
 * - 底部进度条、首次滑动引导、"已刷"计数
 * - 同 Tab 切走再切回时保留浏览位置（父组件保持挂载、仅隐藏）
 */
export function FeedViewer({ feed, active, overlay, onTopic, onAuthor }: Props) {
  const { items, status, error, loadMore } = useFeed(feed, active)
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const indexRef = useRef(0)
  const startedKeyRef = useRef('')
  const seenMaxRef = useRef(0)
  // 待恢复的浏览位置：feed 切换时读出，内容就绪后跳转一次
  const pendingRestoreRef = useRef(0)
  const [hintDone, setHintDone] = useState(() => localStorage.getItem('gittok_hint_seen') === '1')
  // 位置指示：翻页时短暂显示，随后淡出（TikTok 不会一直告诉你刷到第几个）
  const [posFlash, setPosFlash] = useState(false)

  // feed 切换时回到顶部
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0 })
    indexRef.current = 0
    seenMaxRef.current = 0
    setActiveIndex(0)
    pendingRestoreRef.current = feed ? loadPos(feed.key) : 0
  }, [feed?.key])

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

  // 相邻卡的媒体预载：og 图 / README / 主图 / 视频首块，滑过去即秒出
  useEffect(() => {
    for (const next of [items[activeIndex + 1], items[activeIndex + 2]]) {
      if (next) void prefetchCardMedia(next.repo)
    }
  }, [items, activeIndex])

  // 翻页时短暂显示"第 N 个"，1.6s 后淡出
  useEffect(() => {
    if (!active || items.length === 0) return
    setPosFlash(true)
    const t = window.setTimeout(() => setPosFlash(false), 1600)
    return () => window.clearTimeout(t)
  }, [active, activeIndex, items.length])

  // "已刷"计数 + 首次滑动引导
  useEffect(() => {
    if (!active) return
    if (activeIndex > seenMaxRef.current) {
      bumpSeen(activeIndex - seenMaxRef.current)
      seenMaxRef.current = activeIndex
    }
    if (activeIndex > 0 && !hintDone) {
      localStorage.setItem('gittok_hint_seen', '1')
      setHintDone(true)
    }
  }, [active, activeIndex, hintDone])

  // 记住刷到的位置：刷新 / 切走再回来都能接着刷
  useEffect(() => {
    if (!active || !feed || items.length === 0 || activeIndex <= 0) return
    savePos(feed.key, activeIndex)
  }, [active, feed, activeIndex, items.length])

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
    (i: number, behavior: ScrollBehavior = 'smooth') => {
      const el = containerRef.current
      if (!el || items.length === 0) return
      const clamped = Math.max(0, Math.min(i, items.length - 1))
      el.querySelector<HTMLElement>(`[data-index="${clamped}"]`)?.scrollIntoView({
        behavior,
        block: 'start',
      })
    },
    [items.length],
  )

  // 内容就绪后恢复上次的位置（记录的位置已看过，不计入"已刷"）
  useEffect(() => {
    const target = pendingRestoreRef.current
    if (!active || target <= 0 || items.length === 0) return
    if (target < items.length) {
      pendingRestoreRef.current = 0
      seenMaxRef.current = target
      // 直接同步状态，不等 IntersectionObserver 确认（避免进度条闪烁，
      // 也覆盖 IO 回调被推迟的环境）
      indexRef.current = target
      setActiveIndex(target)
      goTo(target, 'auto')
    } else if (status === 'done') {
      // 记录的位置已超出本次能加载到的内容，放弃恢复
      pendingRestoreRef.current = 0
    }
  }, [active, status, items.length, goTo])

  useSnapScroll({ containerRef, indexRef, goTo, enabled: active })

  return (
    <section className="viewer-wrap" style={{ display: active ? 'block' : 'none' }}>
      <div className="viewer" ref={containerRef}>
        {items.map((item, i) => (
          <RepoCard
            key={item.repo.id}
            item={item}
            active={active && i === activeIndex}
            index={i}
            showRank={feed?.showRank ?? false}
            onTopic={onTopic}
            onAuthor={onAuthor}
          />
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

      {active && items.length > 0 && (
        <div
          className={`feed-pos ${posFlash ? 'show' : ''}`}
          title={`当前刷到第 ${activeIndex + 1} 个，本流已加载 ${items.length} 个；继续下滑会自动加载更多`}
        >
          第 {activeIndex + 1} 个
        </div>
      )}

      {active && !hintDone && items.length > 0 && activeIndex === 0 && (
        <div className="swipe-hint">
          <span className="hint-arrow">︿</span> 滚轮 · ↑↓ · 滑动 切换 <span className="hint-arrow">﹀</span>
        </div>
      )}
    </section>
  )
}
