import { useRef, useState } from 'react'
import type { FeedItem } from '../feeds'
import { formatCount, timeAgo } from '../utils/format'
import { getInsight } from '../utils/insights'
import { langColor } from '../utils/langColors'
import { pushToast } from '../utils/toast'
import { useLocalList } from '../utils/store'
import { ActionBar } from './ActionBar'
import { CardMedia } from './CardMedia'
import { CommentsDrawer } from './CommentsDrawer'

interface Burst {
  id: number
  x: number
  y: number
}

export function RepoCard({
  item,
  active,
  index,
  showRank,
}: {
  item: FeedItem
  active: boolean
  index: number
  showRank: boolean
}) {
  const { repo, reason } = item
  const color = langColor(repo.language)
  const insight = getInsight(repo)
  const [bursts, setBursts] = useState<Burst[]>([])
  const burstSeq = useRef(0)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const likes = useLocalList('gittok_likes')

  function onDoubleClick(e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect()
    const burst: Burst = {
      id: burstSeq.current++,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
    setBursts((prev) => [...prev, burst])
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== burst.id)), 900)
    if (!likes.has(repo.id)) {
      likes.toggle(repo)
      pushToast('双击点赞 ❤️（保存在本地）')
    }
  }

  const hasBadges = showRank || !!reason || !!insight.velocity || !!insight.tier
  const soundText = [repo.language, ...(repo.topics ?? []).slice(0, 4).map((t) => `#${t}`)]
    .filter(Boolean)
    .join(' · ')

  return (
    <article
      className={`slide ${active ? 'active' : ''}`}
      data-slide
      data-index={index}
      style={{
        background: `radial-gradient(1000px 640px at 88% -8%, ${color}3d, transparent 62%),
          radial-gradient(800px 500px at 8% 108%, ${color}21, transparent 58%),
          linear-gradient(180deg, #0e1219 0%, #0b0e14 72%)`,
      }}
      onDoubleClick={onDoubleClick}
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
            <img className="avatar" src={repo.owner.avatar_url} alt={repo.owner.login} loading="lazy" />
            <a className="owner-link" href={repo.owner.html_url} target="_blank" rel="noreferrer">
              {repo.owner.login}
            </a>
            <span className="dot">·</span>
            <span className="muted">{timeAgo(repo.created_at)}创建</span>
            {repo.archived && <span className="archived-tag">已归档</span>}
          </div>

          <h2 className="repo-name">
            <a href={repo.html_url} target="_blank" rel="noreferrer" title="在 GitHub 打开">
              {repo.full_name}
            </a>
          </h2>

          {repo.description && <p className="desc">{repo.description}</p>}

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
                  <a
                    key={t}
                    className="topic"
                    href={`https://github.com/topics/${t}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    #{t}
                  </a>
                ))}
              </span>
            )}
          </div>

          {soundText && (
            <div className="sound-bar">
              <span className="disc" />
              <div className="marquee">
                <div className="marquee-inner">
                  <span>
                    {soundText} · ⭐ {formatCount(repo.stargazers_count)} · 双击点赞 ·{' '}
                  </span>
                  <span>
                    {soundText} · ⭐ {formatCount(repo.stargazers_count)} · 双击点赞 ·{' '}
                  </span>
                </div>
              </div>
            </div>
          )}
        </header>

        <ActionBar repo={repo} active={active} onComments={() => setCommentsOpen(true)} />
        {bursts.map((b) => (
          <span key={b.id} className="heart-burst" style={{ left: b.x, top: b.y }}>
            ❤️
          </span>
        ))}
      </div>
      {commentsOpen && <CommentsDrawer repo={repo} onClose={() => setCommentsOpen(false)} />}
    </article>
  )
}
