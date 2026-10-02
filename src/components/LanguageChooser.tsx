import { useState } from 'react'

export const PRESET_LANGS = [
  'TypeScript',
  'JavaScript',
  'Python',
  'Rust',
  'Go',
  'Java',
  'C++',
  'C',
  'C#',
  'Swift',
  'Kotlin',
  'Ruby',
  'PHP',
  'Dart',
  'Vue',
  'Shell',
  'Lua',
  'Zig',
  'Haskell',
  'Elixir',
]

export const PRESET_TOPICS = [
  'ai',
  'llm',
  'agent',
  'web',
  'cli',
  'game',
  'database',
  'react',
  'nodejs',
  'machine-learning',
  'algorithm',
  'android',
  'ios',
  'devops',
  'blockchain',
  'self-hosted',
]

export function LanguageChooser({
  onPick,
}: {
  onPick: (kind: 'language' | 'topic', value: string) => void
}) {
  const [custom, setCustom] = useState('')

  function pickCustom() {
    const v = custom.trim().toLowerCase()
    if (v) onPick('topic', v)
  }

  return (
    <div className="viewer-wrap">
      <div className="slide slide-center">
        <div className="chooser">
          <div className="emoji">🧭</div>
          <h3>想刷哪个频道？</h3>
          <p className="muted">按语言或主题刷对应领域的仓库，之后可随时更换</p>
          <div className="chip-grid">
            {PRESET_LANGS.map((l) => (
              <button key={l} className="chip" onClick={() => onPick('language', l)}>
                {l}
              </button>
            ))}
          </div>
          <div className="chip-grid">
            {PRESET_TOPICS.map((t) => (
              <button key={t} className="chip" onClick={() => onPick('topic', t)}>
                #{t}
              </button>
            ))}
          </div>
          <div className="custom-row">
            <input
              className="input"
              placeholder="或输入自定义主题，如 embedding"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') pickCustom()
              }}
            />
            <button className="btn" onClick={pickCustom} disabled={!custom.trim()}>
              Go
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
