import { useRef, useState } from 'react'
import type { FeedItem } from '../feeds'
import { timeAgo } from '../utils/format'
import { langColor } from '../utils/langColors'
import { pushToast } from '../utils/toast'
import { useLocalList } from '../utils/store'
import { ActionBar } from './ActionBar'
import { ReadmePreview } from './ReadmePreview'

interface Burst {
  id: number
  x: number
  y: number
}

export function RepoCard({ item, active, index }: { item: FeedItem; active: boolean; index: number }) {
  const { repo, reason } = item
  const color = langColor(repo.language)
  const [bursts, setBursts] = useState<Burst[]>([])
  const burstSeq = useRef(0)
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

  return (
    <article
      className="slide"
      data-slide
      data-index={index}
      style={{
        background: `radial-gradient(900px 620px at 85% -5%, ${color}2e, transparent 60%), linear-gradient(180deg, #0e1219 0%, #0b0e14 72%)`,
      }}
      onDoubleClick={onDoubleClick}
    >
      <div className="card-inner">
        <ReadmePreview fullName={repo.full_name} active={active} />

        <header className="caption">
          {reason && <div className="reason-chip">✨ {reason}</div>}
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
            <a href={repo.html_url} target="_blank" rel="noreferrer" title="在 GitHub 打开（Enter）">
              {repo.full_name}
            </a>
          </h2>
          {repo.description && <p className="desc">{repo.description}</p>}
          <div className="meta-row">
            {repo.language && (
              <span className="meta-item">
                <span className="lang-dot" style={{ background: color }} />
                {repo.language}
              </span>
            )}
            <span className="meta-item">⭐ {repo.stargazers_count.toLocaleString()}</span>
            <span className="meta-item">🍴 {repo.forks_count.toLocaleString()}</span>
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
        </header>

        <ActionBar repo={repo} active={active} />
        {bursts.map((b) => (
          <span key={b.id} className="heart-burst" style={{ left: b.x, top: b.y }}>
            ❤️
          </span>
        ))}
      </div>
    </article>
  )
}
