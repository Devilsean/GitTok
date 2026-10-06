import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getIssueComments, getRepoIssues } from '../api/github'
import type { Issue, IssueComment, Repo } from '../api/types'
import { cleanReadme, timeAgo, truncate } from '../utils/format'

type Sort = 'comments' | 'created'

interface Expanded {
  issue: Issue
  comments: IssueComment[] | null
  err?: string
}

/**
 * 讨论抽屉：评论系统直接复用仓库的 GitHub Issues。
 * 列出最热/最新的 issue，点开内联展示正文与评论（Issues Comments API），
 * 深度互动引导跳转 GitHub。
 */
export function CommentsDrawer({ repo, onClose }: { repo: Repo; onClose: () => void }) {
  const [sort, setSort] = useState<Sort>('comments')
  const [issues, setIssues] = useState<Issue[] | null>(null)
  const [err, setErr] = useState('')
  const [expanded, setExpanded] = useState<Expanded | null>(null)

  useEffect(() => {
    let alive = true
    setIssues(null)
    setErr('')
    setExpanded(null)
    getRepoIssues(repo.full_name, sort)
      .then((list) => {
        if (alive) setIssues(list)
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : '加载失败')
      })
    return () => {
      alive = false
    }
  }, [repo.full_name, sort])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function toggleIssue(issue: Issue) {
    if (expanded?.issue.id === issue.id) {
      setExpanded(null)
      return
    }
    setExpanded({ issue, comments: null })
    try {
      const comments = issue.comments > 0 ? await getIssueComments(repo.full_name, issue.number) : []
      setExpanded({ issue, comments })
    } catch (e) {
      setExpanded({ issue, comments: [], err: e instanceof Error ? e.message : '加载失败' })
    }
  }

  return createPortal(
    <div className="comments-backdrop" onClick={onClose}>
      <div className="comments-sheet" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <div className="comments-head">
          <div className="comments-title">
            💬 讨论
            {issues && <span className="muted"> · {issues.length} 条</span>}
          </div>
          <div className="comments-sort">
            <button className={`sort-btn ${sort === 'comments' ? 'active' : ''}`} onClick={() => setSort('comments')}>
              最热
            </button>
            <button className={`sort-btn ${sort === 'created' ? 'active' : ''}`} onClick={() => setSort('created')}>
              最新
            </button>
          </div>
          <button className="x" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="comments-list">
          {issues === null && !err && (
            <div className="comments-empty">
              <div className="spinner" />
              <p className="muted">正在加载讨论…</p>
            </div>
          )}

          {err && (
            <div className="comments-empty">
              <div className="emoji">⚠️</div>
              <p className="muted">{err}</p>
              <a className="btn small" href={`${repo.html_url}/issues`} target="_blank" rel="noreferrer">
                去 GitHub 查看 Issues ↗
              </a>
            </div>
          )}

          {issues !== null && issues.length === 0 && (
            <div className="comments-empty">
              <div className="emoji">💬</div>
              <p className="muted">还没有公开讨论</p>
              <a className="btn small" href={`${repo.html_url}/issues`} target="_blank" rel="noreferrer">
                去 GitHub 提第一个 Issue ↗
              </a>
            </div>
          )}

          {issues?.map((issue) => (
            <div key={issue.id} className="issue-item">
              <button className="issue-row" onClick={() => void toggleIssue(issue)}>
                <div className="issue-line">
                  <span className={`issue-state ${issue.state}`} />
                  <span className="issue-title">{issue.title}</span>
                </div>
                <span className="issue-meta">
                  #{issue.number} · {issue.user.login} · {timeAgo(issue.created_at)}
                  {issue.comments > 0 && ` · 💬 ${issue.comments}`}
                </span>
              </button>
              {issue.labels && issue.labels.length > 0 && (
                <div className="issue-labels">
                  {issue.labels.slice(0, 4).map((l) => (
                    <span
                      key={l.id}
                      className="issue-label"
                      style={/^[0-9a-fA-F]{6}$/.test(l.color) ? { color: `#${l.color}`, borderColor: `#${l.color}55` } : undefined}
                    >
                      {l.name}
                    </span>
                  ))}
                </div>
              )}

              {expanded?.issue.id === issue.id && (
                <div className="issue-detail">
                  {expanded.issue.body && (
                    <div className="readme compact">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {truncate(cleanReadme(expanded.issue.body), 400)}
                      </ReactMarkdown>
                    </div>
                  )}
                  {expanded.comments === null && (
                    <p className="muted center">
                      <span className="spinner-s" />加载评论…
                    </p>
                  )}
                  {expanded.comments?.map((c) => (
                    <div key={c.id} className="comment-item">
                      <img src={c.user.avatar_url} className="avatar-s" alt={c.user.login} loading="lazy" />
                      <div className="comment-main">
                        <div className="comment-head">
                          <b>{c.user.login}</b>
                          <span className="muted">{timeAgo(c.created_at)}</span>
                        </div>
                        <div className="readme compact">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {truncate(cleanReadme(c.body ?? ''), 300)}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  {expanded.err && <p className="err">{expanded.err}</p>}
                  <a className="issue-link" href={expanded.issue.html_url} target="_blank" rel="noreferrer">
                    在 GitHub 查看完整讨论 ↗
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
