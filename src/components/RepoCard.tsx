import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { FeedItem } from '../feeds'
import { timeAgo } from '../utils/format'
import { buzz } from '../utils/haptics'
import { getInsight } from '../utils/insights'
import { langColor } from '../utils/langColors'
import { pushToast } from '../utils/toast'
import { useLocalList } from '../utils/store'
import { ActionBar } from './ActionBar'
import { CardMedia } from './CardMedia'
import { CommentsDrawer } from './CommentsDrawer'
import { HeartIcon } from './icons'

/** 爱心爆发：主心 + 7 颗四散的小心，seeds 保证爆发期间重渲染不闪变 */
interface Burst {
  id: number
  x: number
  y: number
  seeds: number[]
}

const MINI_HEARTS = 7

/** 跑马灯改轮播操作提示：语言/topics/星数在 meta 行已经展示过，重复滚动只是噪音 */
const TIPS = [
  '双击空白处点赞 ❤️',
  '↑↓ / 滚轮 / JK 翻页',
  'L 点赞 · C 评论 · S Star · F 收藏',
  '⭐ Star 可同步到你的 GitHub',
  '🔖 收藏保存在本地，刷新不丢',
  '📖 想读文档就点「展开 README」',
]

export function RepoCard({
  item,
  active,
  index,
  showRank,
  onTopic,
  onAuthor,
}: {
  item: FeedItem
  active: boolean
  index: number
  showRank: boolean
  /** 点话题标签：站内切入对应频道流（TikTok 式 hashtag 闭环） */
  onTopic?: (topic: string) => void
  /** 点作者：站内切入该作者的仓库流 */
  onAuthor?: (login: string) => void
}) {
  const { repo, reason } = item
  const color = langColor(repo.language)
  const insight = getInsight(repo)
  const [bursts, setBursts] = useState<Burst[]>([])
  const burstSeq = useRef(0)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [descOpen, setDescOpen] = useState(false)
  const likes = useLocalList('gittok_likes')
  const likesRef = useRef(likes)
  likesRef.current = likes
  const cardRef = useRef<HTMLElement>(null)
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null)

  const fireBurst = useCallback((x: number, y: number) => {
    const burst: Burst = {
      id: burstSeq.current++,
      x,
      y,
      seeds: Array.from({ length: MINI_HEARTS }, () => Math.random()),
    }
    setBursts((prev) => [...prev, burst])
    window.setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== burst.id)), 1100)
  }, [])

  const likeAt = useCallback(
    (x: number, y: number) => {
      fireBurst(x, y)
      buzz()
      const l = likesRef.current
      if (!l.has(repo.id)) {
        l.toggle(repo)
        pushToast('点赞 ❤️（保存在本地）')
      }
    },
    [fireBurst, repo],
  )

  // 双击点赞：pointer 事件手动判双击——移动端 dblclick 不可靠，
  // 且系统双击缩放会抢走事件（配合 CSS touch-action: manipulation）
  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    const el = e.target as HTMLElement
    if (el.closest('a, button, input, textarea, .action-bar, .readme-panel, .digest-card, .comments-sheet')) return
    const now = performance.now()
    const last = lastTapRef.current
    if (last && now - last.t < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 48) {
      lastTapRef.current = null
      const rect = e.currentTarget.getBoundingClientRect()
      likeAt(e.clientX - rect.left, e.clientY - rect.top)
    } else {
      lastTapRef.current = { t: now, x: e.clientX, y: e.clientY }
    }
  }

  // L 键点赞：爱心在卡片中央爆发，与双击同一动效
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (document.querySelector('.comments-backdrop')) return
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        const rect = cardRef.current?.getBoundingClientRect()
        likeAt(rect ? rect.width / 2 : 0, rect ? rect.height * 0.42 : 0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, likeAt])

  const hasBadges = showRank || !!reason || !!insight.velocity || !!insight.tier
  // 用 repo.id 取模保证同一张卡稳定显示同两条提示，避免重渲染时闪变
  const tipLine = `${TIPS[repo.id % TIPS.length]} · ${TIPS[(repo.id + 3) % TIPS.length]} · `
  const openAuthor = () => (onAuthor ? onAuthor(repo.owner.login) : window.open(repo.owner.html_url, '_blank'))
  const openTopic = (t: string) =>
    onTopic ? onTopic(t) : window.open(`https://github.com/topics/${t}`, '_blank')

  return (
    <article
      ref={cardRef}
      className={`slide ${active ? 'active' : ''}`}
      data-slide
      data-index={index}
      style={{
        background: `radial-gradient(1000px 640px at 88% -8%, ${color}3d, transparent 62%),
          radial-gradient(800px 500px at 8% 108%, ${color}21, transparent 58%),
          linear-gradient(180deg, #0e1219 0%, #0b0e14 72%)`,
      }}
      onPointerDown={onPointerDown}
    >
      <div className="card-inner">
        <CardMedia repo={repo} active={active} />

        <header className="caption">
          {hasBadges && (
            <div className="hook-badges">
              {showRank && <span className="pill rank">#{index + 1}</span>}
              {reason && <span className="pill reason">✨ {reason}</span>}
              {insight.velocity && <span className="pill vel">🔥 {insight.velocity}</span>}
              {insight.tier && <span className={`pill tier-${insight.tier.kind}`}>{insight.tier.label}</span>}
            </div>
          )}

          <div className="owner-row">
            <button
              className="owner-chip"
              onClick={openAuthor}
              title={`刷 ${repo.owner.login} 的仓库`}
            >
              <img className="avatar" src={repo.owner.avatar_url} alt={repo.owner.login} loading="lazy" />
              <span className="owner-link">{repo.owner.login}</span>
            </button>
            <span className="dot">·</span>
            <span className="muted">{timeAgo(repo.created_at)}创建</span>
            {repo.archived && <span className="archived-tag">已归档</span>}
          </div>

          <h2 className="repo-name">
            <a href={repo.html_url} target="_blank" rel="noreferrer" title="在 GitHub 打开">
              {repo.full_name}
            </a>
          </h2>

          {repo.description && (
            <>
              <p className={`desc ${descOpen ? 'open' : ''}`}>{repo.description}</p>
              {repo.description.length > 100 && (
                <button className="desc-more" onClick={() => setDescOpen((v) => !v)}>
                  {descOpen ? '收起 ▴' : '展开 ▾'}
                </button>
              )}
            </>
          )}

          <div className="meta-row">
            {repo.language && (
              <span className="meta-item lang-pill">
                <span className="lang-dot" style={{ background: color }} />
                {repo.language}
              </span>
            )}
            <span className="meta-item star-count">★ {repo.stargazers_count.toLocaleString()}</span>
            <span className="meta-item">⑂ {repo.forks_count.toLocaleString()}</span>
            {repo.topics && repo.topics.length > 0 && (
              <span className="topics">
                {repo.topics.slice(0, 5).map((t) => (
                  <button key={t} className="topic" onClick={() => openTopic(t)} title={`刷 #${t} 频道`}>
                    #{t}
                  </button>
                ))}
              </span>
            )}
          </div>

          {tipLine && (
            <div className="sound-bar">
              <span className="disc" />
              <div className="marquee">
                <div className="marquee-inner">
                  <span>{tipLine}</span>
                  <span>{tipLine}</span>
                </div>
              </div>
            </div>
          )}
        </header>

        <ActionBar repo={repo} active={active} onComments={() => setCommentsOpen(true)} />
        {bursts.map((b) => (
          <span key={b.id} className="like-burst" style={{ left: b.x, top: b.y }}>
            <span className="burst-heart">
              <HeartIcon size={92} filled />
            </span>
            {b.seeds.map((s, i) => (
              <span
                key={i}
                className="burst-mini"
                style={
                  {
                    '--ang': `${i * (360 / MINI_HEARTS) + (s * 24 - 12)}deg`,
                    '--dist': `${44 + s * 40}px`,
                    '--s': 0.55 + s * 0.4,
                    animationDelay: `${s * 0.08}s`,
                  } as CSSProperties
                }
              >
                <HeartIcon size={18} filled />
              </span>
            ))}
          </span>
        ))}
      </div>
      {commentsOpen && <CommentsDrawer repo={repo} onClose={() => setCommentsOpen(false)} />}
    </article>
  )
}
