import { useEffect, useMemo, useState } from 'react'
import { refreshRateLimit } from './api/github'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { CollectionPanel } from './components/CollectionPanel'
import { FeedViewer } from './components/FeedViewer'
import { LanguageChooser } from './components/LanguageChooser'
import { LoginModal } from './components/LoginModal'
import { SearchChooser } from './components/SearchChooser'
import { TabBar, type TabId } from './components/TabBar'
import { Toaster } from './components/Toaster'
import { TopBar } from './components/TopBar'
import {
  makeLanguageFeed,
  makeRecommendFeed,
  makeSearchFeed,
  makeTrendingFeed,
} from './feeds'

const TRENDING_WINDOWS: { label: string; days: number }[] = [
  { label: '本周', days: 7 },
  { label: '本月', days: 30 },
  { label: '近三月', days: 90 },
]

function Shell() {
  const { user, setLoginOpen } = useAuth()
  const [tab, setTab] = useState<TabId>('trending')
  const [trendDays, setTrendDays] = useState(7)
  const [langSel, setLangSel] = useState<{ kind: 'language' | 'topic'; value: string } | null>(null)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    void refreshRateLimit()
  }, [])

  const trendingFeed = useMemo(() => makeTrendingFeed(trendDays), [trendDays])
  const langFeed = useMemo(
    () => (langSel ? makeLanguageFeed(langSel.kind, langSel.value) : null),
    [langSel],
  )
  const searchFeed = useMemo(
    () => (keyword.trim() ? makeSearchFeed(keyword) : null),
    [keyword],
  )
  const recommendFeed = useMemo(() => (user ? makeRecommendFeed() : null), [user?.login])

  return (
    <div className="app">
      <TopBar />

      <main className="stage">
        <FeedViewer
          feed={trendingFeed}
          active={tab === 'trending'}
          overlay={
            <div className="overlay-top">
              <div className="chipbar">
                {TRENDING_WINDOWS.map((w) => (
                  <button
                    key={w.days}
                    className={`chip ${trendDays === w.days ? 'active' : ''}`}
                    onClick={() => setTrendDays(w.days)}
                  >
                    🔥 {w.label}
                  </button>
                ))}
              </div>
            </div>
          }
        />

        {tab === 'language' && !langSel ? (
          <LanguageChooser
            onPick={(kind, value) => setLangSel({ kind, value })}
          />
        ) : (
          <FeedViewer
            feed={langFeed}
            active={tab === 'language'}
            overlay={
              langSel && (
                <div className="overlay-top">
                  <div className="chipbar">
                    <span className="chip active">
                      {langSel.kind === 'topic' ? '#' : ''}
                      {langSel.value}
                    </span>
                    <button className="chip" onClick={() => setLangSel(null)}>
                      更换频道
                    </button>
                  </div>
                </div>
              )
            }
          />
        )}

        {tab === 'search' && !searchFeed ? (
          <SearchChooser onSubmit={(kw) => setKeyword(kw)} />
        ) : (
          <FeedViewer
            feed={searchFeed}
            active={tab === 'search'}
            overlay={
              searchFeed && (
                <div className="overlay-top">
                  <div className="chipbar">
                    <span className="chip active">🔍 {keyword}</span>
                    <button className="chip" onClick={() => setKeyword('')}>
                      重新搜索
                    </button>
                  </div>
                </div>
              )
            }
          />
        )}

        {user ? (
          <FeedViewer feed={recommendFeed} active={tab === 'recommend'} />
        ) : (
          <div className="viewer-wrap" style={{ display: tab === 'recommend' ? 'block' : 'none' }}>
            <div className="slide slide-center">
              <div className="center-msg chooser">
                <div className="emoji">✨</div>
                <h3>为你推荐</h3>
                <p className="muted">登录 GitHub 后，根据你 Star 过的仓库推荐同类宝藏项目</p>
                <button className="btn accent" onClick={() => setLoginOpen(true)}>
                  登录 GitHub
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'mine' && <CollectionPanel />}
      </main>

      <TabBar tab={tab} onChange={setTab} />
      <LoginModal />
      <Toaster />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
