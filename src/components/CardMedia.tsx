import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getReadme } from '../api/github'
import type { Repo } from '../api/types'
import { cleanReadme, truncate } from '../utils/format'
import { extractIntro, introDuplicatesDescription } from '../utils/insights'
import { extractHeroImage, ogImage } from '../utils/media'

const FULL_MAX_CHARS = 6000

/**
 * 卡片媒体区：视觉第一印象。
 * - README 加载前先显示 GitHub 社交预览图（零 API 成本，秒出图）
 * - README 到位后自动换成项目真实主图（banner/截图）
 * - 纯文字仓库回落到"一句话简介引言"排版
 * - 点击"展开 README"查看完整文档
 */
export function CardMedia({ repo, active }: { repo: Repo; active: boolean }) {
  const [content, setContent] = useState<string | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [broken, setBroken] = useState<string[]>([])

  useEffect(() => {
    if (!active) return
    let alive = true
    setFailed(false)
    setOpen(false)
    getReadme(repo.full_name)
      .then((md) => {
        if (alive) setContent(md)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [active, repo.full_name])

  function markBroken(src: string) {
    setBroken((prev) => (prev.includes(src) ? prev : [...prev, src]))
  }

  const og = ogImage(repo.full_name)
  const readmeHero = content ? extractHeroImage(content, repo) : null
  // 主图回退链：README 主图 → 社交预览图
  const chain = [readmeHero, og].filter((s): s is string => !!s)
  const heroSrc = chain.find((s) => !broken.includes(s))
  // README 存在但没有任何可用主图 → 纯文字仓库，走简介引言排版
  const textOnly = !!content && !readmeHero

  if (open && content) {
    return (
      <div className="readme-panel open">
        <div className="readme-panel-head">
          <span>README.md</span>
          <button className="link-btn" onClick={() => setOpen(false)}>
            收起 ▴
          </button>
        </div>
        <div className="readme">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {truncate(cleanReadme(content), FULL_MAX_CHARS)}
          </ReactMarkdown>
        </div>
      </div>
    )
  }

  if (heroSrc && !textOnly) {
    return (
      <div className="slide-media" key={heroSrc}>
        <img
          className="m-img"
          src={heroSrc}
          alt={`${repo.full_name} 预览图`}
          loading="lazy"
          onLoad={(e) => e.currentTarget.classList.add('loaded')}
          onError={() => markBroken(heroSrc)}
        />
        <div className="media-scrim" />
      </div>
    )
  }

  if (content) {
    const intro = extractIntro(content)
    if (intro && !introDuplicatesDescription(intro, repo.description)) {
      return (
        <div
          className="digest-card"
          onClick={() => setOpen(true)}
          title="点击展开完整 README"
        >
          <div className="digest-quote">“{intro}”</div>
          <div className="digest-toggle">📖 展开 README</div>
        </div>
      )
    }
  }

  if (failed) return null
  return null
}
