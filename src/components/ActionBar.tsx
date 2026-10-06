import { useEffect, useState } from 'react'
import { checkStarred, setStar } from '../api/github'
import type { Repo } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { buzz } from '../utils/haptics'
import { formatCount } from '../utils/format'
import { pushToast } from '../utils/toast'
import { useLocalList } from '../utils/store'
import { BookmarkIcon, CommentIcon, HeartIcon, LinkIcon, StarIcon } from './icons'

export function ActionBar({
  repo,
  active,
  onComments,
}: {
  repo: Repo
  active: boolean
  onComments: () => void
}) {
  const { token, setLoginOpen } = useAuth()
  const likes = useLocalList('gittok_likes')
  const marks = useLocalList('gittok_collections')
  const [starred, setStarred] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  // 当前卡片激活且已登录时，查询真实 Star 状态
  useEffect(() => {
    if (!active || !token) {
      setStarred(null)
      return
    }
    let alive = true
    setStarred(null)
    checkStarred(repo.full_name)
      .then((v) => {
        if (alive) setStarred(v)
      })
      .catch(() => {
        /* 查询失败不影响浏览 */
      })
    return () => {
      alive = false
    }
  }, [active, token, repo.full_name])

  async function toggleStar() {
    if (!token) {
      setLoginOpen(true)
      return
    }
    if (busy) return
    const next = !(starred ?? false)
    setBusy(true)
    setStarred(next)
    buzz()
    try {
      await setStar(repo.full_name, next)
      pushToast(next ? `已 Star ⭐ ${repo.full_name}` : `已取消 Star：${repo.full_name}`)
    } catch (e) {
      setStarred(!next)
      pushToast(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  function toggleLike() {
    buzz()
    const now = likes.toggle(repo)
    if (now) pushToast('已点赞 ❤️（保存在本地）')
  }

  function toggleMark() {
    buzz()
    const now = marks.toggle(repo)
    pushToast(now ? '已收藏 🔖（保存在本地）' : '已取消收藏')
  }

  // 单键操作：C 评论 / S Star / F 收藏（不设依赖数组，保持闭包新鲜）
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (document.querySelector('.comments-backdrop')) return
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        onComments()
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        void toggleStar()
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        toggleMark()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function copyLink() {
    navigator.clipboard
      ?.writeText(repo.html_url)
      .then(() => pushToast('链接已复制 🔗'))
      .catch(() => pushToast('复制失败，请手动复制地址栏链接'))
  }

  // 移动端优先走系统分享面板，桌面回退复制链接
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: repo.full_name,
          text: repo.description ?? repo.full_name,
          url: repo.html_url,
        })
        return
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    copyLink()
  }

  return (
    <div className="action-bar">
      <button
        className={`action-btn ${likes.has(repo.id) ? 'liked' : ''}`}
        onClick={toggleLike}
        title="点赞（本地）"
        aria-label="点赞"
      >
        <span className="ico">
          <HeartIcon filled={likes.has(repo.id)} />
        </span>
      </button>
      <button
        className={`action-btn ${starred ? 'starred' : ''}`}
        onClick={toggleStar}
        disabled={busy}
        title={token ? 'Star 到 GitHub 账号' : '登录后可 Star'}
        aria-label={token ? 'Star 到 GitHub 账号' : '登录后可 Star'}
      >
        <span className="ico">
          <StarIcon filled={!!starred} />
        </span>
        <span className="count">{formatCount(repo.stargazers_count)}</span>
      </button>
      <button
        className="action-btn"
        onClick={onComments}
        title="查看讨论（GitHub Issues）"
        aria-label="查看讨论"
      >
        <span className="ico">
          <CommentIcon />
        </span>
        <span className="count">{formatCount(repo.open_issues_count)}</span>
      </button>
      <button
        className={`action-btn ${marks.has(repo.id) ? 'marked' : ''}`}
        onClick={toggleMark}
        title="收藏（本地）"
        aria-label="收藏"
      >
        <span className="ico">
          <BookmarkIcon filled={marks.has(repo.id)} />
        </span>
      </button>
      <button className="action-btn" onClick={() => void share()} title="分享" aria-label="分享">
        <span className="ico">
          <LinkIcon />
        </span>
        <span className="count">分享</span>
      </button>
    </div>
  )
}
