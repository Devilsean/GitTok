import { useSyncExternalStore } from 'react'
import { getRateSnapshot, subscribeRate } from '../api/github'

export function RateLimitBadge() {
  const snap = useSyncExternalStore(subscribeRate, getRateSnapshot, () => null)
  if (!snap) return null
  const pct = snap.limit > 0 ? snap.remaining / snap.limit : 0
  const cls = pct > 0.5 ? 'ok' : pct > 0.2 ? 'warn' : 'danger'
  return (
    <div
      className={`rate-badge ${cls}`}
      title={`GitHub API 剩余额度（${snap.bucket === 'search' ? '搜索接口' : '核心接口'}）。登录后限额 5000 次/小时`}
    >
      API {snap.remaining}/{snap.limit}
    </div>
  )
}
