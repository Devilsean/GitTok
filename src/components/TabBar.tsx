import type { ReactNode } from 'react'
import { CompassIcon, FireIcon, PersonIcon, SearchIcon, SparklesIcon } from './icons'

export type TabId = 'trending' | 'language' | 'search' | 'recommend' | 'mine'

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'trending', label: '热门', icon: <FireIcon /> },
  { id: 'language', label: '频道', icon: <CompassIcon /> },
  { id: 'search', label: '搜索', icon: <SearchIcon /> },
  { id: 'recommend', label: '推荐', icon: <SparklesIcon /> },
  { id: 'mine', label: '我的', icon: <PersonIcon /> },
]

export function TabBar({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tab-item ${tab === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
