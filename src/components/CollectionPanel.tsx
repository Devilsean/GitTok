import { useState } from 'react'
import { formatCount } from '../utils/format'
import { ogImage } from '../utils/media'
import { pushToast } from '../utils/toast'
import { useLocalList } from '../utils/store'

type Sub = 'marks' | 'likes'

export function CollectionPanel() {
  const likes = useLocalList('gittok_likes')
  const marks = useLocalList('gittok_collections')
  const [sub, setSub] = useState<Sub>('marks')
  const list = sub === 'likes' ? likes.items : marks.items
  const store = sub === 'likes' ? likes : marks

  return (
    <div className="mine-panel">
      <div className="mine-head">
        <button className={`chip ${sub === 'marks' ? 'active' : ''}`} onClick={() => setSub('marks')}>
          🔖 收藏 {marks.items.length}
        </button>
        <button className={`chip ${sub === 'likes' ? 'active' : ''}`} onClick={() => setSub('likes')}>
          ❤️ 点赞 {likes.items.length}
        </button>
        {list.length > 0 && (
          <button
            className="link-btn"
            onClick={() => {
              for (const { repo } of list) store.remove(repo.id)
              pushToast('已清空')
            }}
          >
            清空
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="center-msg">
          <div className="emoji">📭</div>
          <p className="muted">还没有{sub === 'likes' ? '点赞' : '收藏'}任何仓库，去信息流里刷一刷吧</p>
        </div>
      ) : (
        <div className="cards-grid">
          {list.map(({ repo }) => (
            <div key={repo.id} className="mini-card">
              <img
                className="mini-og"
                src={ogImage(repo.full_name)}
                alt={`${repo.full_name} 预览图`}
                loading="lazy"
              />
              <div className="mini-head">
                <img src={repo.owner.avatar_url} className="avatar-s" alt={repo.owner.login} loading="lazy" />
                <a href={repo.html_url} target="_blank" rel="noreferrer">
                  {repo.full_name}
                </a>
              </div>
              <p className="mini-desc">{repo.description ?? '（无描述）'}</p>
              <div className="mini-meta">
                ⭐ {repo.stargazers_count.toLocaleString()}
                {repo.language ? ` · ${repo.language}` : ''}
                {' · '}
                {formatCount(repo.forks_count)} forks
              </div>
              <div className="mini-actions">
                <a className="btn small" href={repo.html_url} target="_blank" rel="noreferrer">
                  打开 ↗
                </a>
                <button
                  className="btn small"
                  onClick={() => {
                    store.remove(repo.id)
                    pushToast('已移除')
                  }}
                >
                  移除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
