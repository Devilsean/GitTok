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

const TAB_IDS: TabId[] = ['trending', 'language', 'search', 'recommend', 'mine']

interface SavedSession {
  tab?: TabId
  trendDays?: number
  langSel?: { kind: 'language' | 'topic' | 'author'; value: string } | null
  keyword?: string
}

function loadSession(): SavedSession {
  try {
    const s = JSON.parse(localStorage.getItem('gittok_session') ?? '{}') as SavedSession
    return {
      tab: s.tab && TAB_IDS.includes(s.tab) ? s.tab : undefined,
      trendDays: TRENDING_WINDOWS.some((w) => w.days === s.trendDays) ? s.trendDays : undefined,
      langSel:
        s.langSel &&
        (s.langSel.kind === 'language' || s.langSel.kind === 'topic' || s.langSel.kind === 'author') &&
        typeof s.langSel.value === 'string'
          ? s.langSel
          : null,
      keyword: typeof s.keyword === 'string' ? s.keyword : undefined,
    }
  } catch {
    return {}
  }
}

function Shell() {
  const { user, setLoginOpen } = useAuth()
  const saved = useMemo(loadSession, [])
  const [tab, setTab] = useState<TabId>(saved.tab ?? 'trending')
  const [trendDays, setTrendDays] = useState(saved.trendDays ?? 7)
  const [langSel, setLangSel] = useState<{ kind: 'language' | 'topic' | 'author'; value: string } | null>(
    saved.langSel ?? null,
  )
  const [keyword, setKeyword] = useState(saved.keyword ?? '')
  // 推荐流"换一批"种子：变化时重建推荐 feed，搜索页码随之偏移
  const [recSeed, setRecSeed] = useState(0)

  // 卡片上的 #话题 / 作者头像：站内直接切进对应频道流（TikTok 式闭环）
  const openTopic = (t: string) => {
    setTab('language')
    setLangSel({ kind: 'topic', value: t })
  }
  const openAuthor = (login: string) => {
    setTab('language')
    setLangSel({ kind: 'author', value: login })
  }

  // 记住本次会话选择（tab / 时间窗 / 频道 / 搜索词），刷新后接着刷
  useEffect(() => {
    localStorage.setItem('gittok_session', JSON.stringify({ tab, trendDays, langSel, keyword }))
  }, [tab, trendDays, langSel, keyword])

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
  const recommendFeed = useMemo(
    () => (user ? makeRecommendFeed(recSeed) : null),
    [user?.login, recSeed],
  )

  return (
    <div className="app">
      <TopBar onHome={() => setTab('trending')} />

      <main className="stage">
        <FeedViewer
          feed={trendingFeed}
          active={tab === 'trending'}
          onTopic={openTopic}
          onAuthor={openAuthor}
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
            onTopic={openTopic}
            onAuthor={openAuthor}
            overlay={
              langSel && (
                <div className="overlay-top">
                  <div className="chipbar">
                    <span className="chip active">
                      {langSel.kind === 'topic' ? '#' : langSel.kind === 'author' ? '👤 ' : ''}
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
            onTopic={openTopic}
            onAuthor={openAuthor}
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
          <FeedViewer
            feed={recommendFeed}
            active={tab === 'recommend'}
            onTopic={openTopic}
            onAuthor={openAuthor}
            overlay={
              <div className="overlay-top">
                <div className="chipbar">
                  <button className="chip" onClick={() => setRecSeed((s) => s + 1)}>
                    🔄 换一批
                  </button>
                </div>
              </div>
            }
          />
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
