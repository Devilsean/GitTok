import { GitHubMark } from './icons'
import { RateLimitBadge } from './RateLimitBadge'
import { useAuth } from '../auth/AuthContext'
import { useSeen } from '../utils/seen'

export function TopBar({ onHome }: { onHome: () => void }) {
  const { user, setLoginOpen, signOut } = useAuth()
  const seen = useSeen()
  return (
    <header className="topbar">
      <a
        className="logo"
        href="#"
        title="回到热门"
        onClick={(e) => {
          e.preventDefault()
          onHome()
        }}
      >
        <GitHubMark size={24} />
        <span>
          Git<em>Tok</em>
        </span>
      </a>
      <div className="topbar-right">
        {seen > 0 && (
          <div className="seen-chip" title="本次累计刷过的仓库数">
            🛋️ 已刷 {seen}
          </div>
        )}
        <RateLimitBadge />
        {user ? (
          <div className="user-chip">
            <img src={user.avatar_url} className="avatar-s" alt={user.login} title={user.login} />
            <span className="user-name">{user.login}</span>
            <button className="link-btn" onClick={signOut}>
              退出
            </button>
          </div>
        ) : (
          <button className="btn accent" onClick={() => setLoginOpen(true)}>
            登录 GitHub
          </button>
        )}
      </div>
    </header>
  )
}
