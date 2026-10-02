import { useEffect, useState } from 'react'
import { checkStarred, setStar } from '../api/github'
import type { Repo } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { formatCount } from '../utils/format'
import { pushToast } from '../utils/toast'
import { useLocalList } from '../utils/store'
import { BookmarkIcon, HeartIcon, LinkIcon, StarIcon } from './icons'

export function ActionBar({ repo, active }: { repo: Repo; active: boolean }) {
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
    const now = likes.toggle(repo)
    if (now) pushToast('已点赞 ❤️（保存在本地）')
  }

  function toggleMark() {
    const now = marks.toggle(repo)
    pushToast(now ? '已收藏 🔖（保存在本地）' : '已取消收藏')
  }

  function copyLink() {
    navigator.clipboard
      ?.writeText(repo.html_url)
      .then(() => pushToast('链接已复制 🔗'))
      .catch(() => pushToast('复制失败，请手动复制地址栏链接'))
  }

  return (
    <div className="action-bar">
      <button
        className={`action-btn ${likes.has(repo.id) ? 'liked' : ''}`}
        onClick={toggleLike}
        title="点赞（本地）"
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
      >
        <span className="ico">
          <StarIcon filled={!!starred} />
        </span>
        <span className="count">{formatCount(repo.stargazers_count)}</span>
      </button>
      <button
        className={`action-btn ${marks.has(repo.id) ? 'marked' : ''}`}
        onClick={toggleMark}
        title="收藏（本地）"
      >
        <span className="ico">
          <BookmarkIcon filled={marks.has(repo.id)} />
        </span>
      </button>
      <button className="action-btn" onClick={copyLink} title="复制仓库链接">
        <span className="ico">
          <LinkIcon />
        </span>
        <span className="count">分享</span>
      </button>
    </div>
  )
}
