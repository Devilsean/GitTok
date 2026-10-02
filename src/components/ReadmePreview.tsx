import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getReadme } from '../api/github'
import { cleanReadme, truncate } from '../utils/format'

const MAX_CHARS = 3000

export function ReadmePreview({ fullName, active }: { fullName: string; active: boolean }) {
  const [content, setContent] = useState<string | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!active) return
    let alive = true
    setFailed(false)
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

  if (failed) return null
  if (content === undefined) {
    return (
      <div className="readme-panel readme-skeleton" aria-hidden>
        <div className="sk-line w-70" />
        <div className="sk-line w-90" />
        <div className="sk-line w-45" />
      </div>
    )
  }
  if (content === null || content.trim() === '') return null

  return (
    <div className="readme-panel">
      <div className="readme-panel-head">README.md</div>
      <div className="readme">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {truncate(cleanReadme(content), MAX_CHARS)}
        </ReactMarkdown>
      </div>
      <div className="readme-fade" />
    </div>
  )
}
