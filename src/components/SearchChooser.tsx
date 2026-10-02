import { useState } from 'react'

const SUGGESTIONS = [
  'AI agent',
  'cli tool',
  'game engine',
  'self-hosted',
  'web framework',
  'llm',
  'editor',
  'algorithm',
  'crawler',
  'raspberry pi',
]

export function SearchChooser({ onSubmit }: { onSubmit: (keyword: string) => void }) {
  const [kw, setKw] = useState('')

  function submit(v: string) {
    const t = v.trim()
    if (t) onSubmit(t)
  }

  return (
    <div className="viewer-wrap">
      <div className="slide slide-center">
        <div className="chooser">
          <div className="emoji">🔍</div>
          <h3>搜个仓库开刷</h3>
          <div className="custom-row">
            <input
              className="input"
              autoFocus
              placeholder="输入关键词，如 terminal ui"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit(kw)
              }}
            />
            <button className="btn accent" onClick={() => submit(kw)} disabled={!kw.trim()}>
              搜索
            </button>
          </div>
          <p className="muted">试试大家都在搜：</p>
          <div className="chip-grid">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => submit(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
