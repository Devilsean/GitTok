import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getReadme } from '../api/github'
import { cleanReadme, truncate } from '../utils/format'
import { extractIntro, introDuplicatesDescription } from '../utils/insights'

const FULL_MAX_CHARS = 6000

/**
 * README 信息卡：默认只展示从 README 提取的一句话简介（快速知晓项目大概），
 * 点击展开完整 README；与仓库描述高度重复的简介不展示。
 */
export function ReadmePreview({
  fullName,
  active,
  description,
}: {
  fullName: string
  active: boolean
  description: string | null
}) {
  const [content, setContent] = useState<string | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!active) return
    let alive = true
    setFailed(false)
    setOpen(false)
    getReadme(fullName)
      .then((md) => {
        if (alive) setContent(md)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [active, fullName])

  if (failed || content === undefined || content === null || content.trim() === '') return null

  if (!open) {
    const intro = extractIntro(content)
    if (!intro || introDuplicatesDescription(intro, description)) return null
    return (
      <div className="digest-card" onClick={() => setOpen(true)} title="点击展开完整 README">
        <div className="digest-quote">“{intro}”</div>
        <div className="digest-toggle">📖 展开 README</div>
      </div>
    )
  }

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
