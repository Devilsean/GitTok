import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getReadme } from '../api/github'
import type { Repo } from '../api/types'
import { cleanReadme, truncate } from '../utils/format'
import { extractIntro, introDuplicatesDescription } from '../utils/insights'
import { extractHeroImage, extractHeroVideo, ogImage } from '../utils/media'
import { prefetchVideo, preloadImage } from '../utils/mediaCache'

const FULL_MAX_CHARS = 6000
const REDUCED_MOTION =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** 展示中的一层媒体：video = demo 视频，cover = README 主图铺满，og = 社交预览卡兜底 */
interface Layer {
  src: string
  kind: 'video' | 'cover' | 'og'
}

/**
 * 卡片媒体区：视觉第一印象。
 * - README 加载前先显示 GitHub 社交预览图（零 API 成本，秒出图）
 * - README 里的 demo 视频自动静音循环播放（右上有声音开关）
 * - 换主图前先预载，就绪后交叉淡入——观看中画面永远不会"突然被换掉"
 * - 纯文字仓库回落到"一句话简介引言"排版
 * - 点击"展开 README"查看完整文档
 */
export function CardMedia({ repo, active }: { repo: Repo; active: boolean }) {
  const [content, setContent] = useState<string | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [broken, setBroken] = useState<string[]>([])
  const [muted, setMuted] = useState(true)
  // shown = 正在展示的一层；fading = 交叉淡入期间垫在下方的旧一层
  const [shown, setShown] = useState<Layer | null>(null)
  const [fading, setFading] = useState<Layer | null>(null)
  const shownRef = useRef<Layer | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!active) return
    let alive = true
    setFailed(false)
    setOpen(false)
    // api 层有会话缓存：相邻卡预取过的话这里立即返回
    getReadme(repo.full_name, repo.default_branch)
      .then((md) => {
        if (alive) setContent(md)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [active, repo.full_name, repo.default_branch])

  function markBroken(src: string) {
    setBroken((prev) => (prev.includes(src) ? prev : [...prev, src]))
  }

  const og = ogImage(repo.full_name)
  const readmeHero = content ? extractHeroImage(content, repo) : null
  const readmeVideo = content ? extractHeroVideo(content, repo) : null
  // README 存在但没有任何可用媒体 → 纯文字仓库，走简介引言排版（不显示 og 文字卡）
  const textOnly = !!content && !readmeHero && !readmeVideo

  // 媒体回退链：demo 视频 → README 主图 → 社交预览图
  const chain: Layer[] = []
  if (!textOnly) {
    if (readmeVideo && !broken.includes(readmeVideo)) chain.push({ src: readmeVideo, kind: 'video' })
    if (readmeHero && !broken.includes(readmeHero)) chain.push({ src: readmeHero, kind: 'cover' })
    if (!broken.includes(og)) chain.push({ src: og, kind: 'og' })
  }
  const target = chain[0]
  // og 图本质是"仓库名+简介"的文字卡：铺满会与界面文案重复且放大发虚，
  // 改为 contain 居中 + 同图模糊背景；README 真实主图仍铺满，视频也走 contain（demo 多为 16:9）。
  const ogMode = !!target && target.kind !== 'cover'

  // 换层前先预载，就绪才切换（旧层垫底交叉淡入），失败则顺延回退链
  useEffect(() => {
    if (!target || shownRef.current?.src === target.src) return
    let alive = true
    const settle = (ok: boolean) => {
      if (!alive) return
      if (!ok) {
        setBroken((prev) => (prev.includes(target.src) ? prev : [...prev, target.src]))
        return
      }
      const prev = shownRef.current
      setFading(prev && prev.src !== target.src ? prev : null)
      setShown(target)
      shownRef.current = target
      if (prev && prev.src !== target.src) {
        window.setTimeout(() => setFading((f) => (f && f.src === prev.src ? null : f)), 700)
      }
    }
    if (target.kind === 'video') void prefetchVideo(target.src).then(() => settle(true))
    else void preloadImage(target.src).then(settle)
    return () => {
      alive = false
    }
  }, [target?.src, target?.kind])

  // 当前卡片激活时播放、离开时暂停；静音切换即时生效
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = muted
    if (active && !REDUCED_MOTION) void v.play().catch(() => {})
    else v.pause()
  }, [active, muted, target?.src, target?.kind])

  if (open && content) {
    return (
      <div className="readme-panel open">
        <div className="readme-panel-head">
          <span>README.md</span>
          <button className="link-btn readme-close" onClick={() => setOpen(false)}>
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

  function renderLayer(layer: Layer, isUnder: boolean) {
    const loadedClass = isUnder ? ' loaded' : ''
    if (layer.kind === 'video') {
      const video = isUnder ? (
        <video key={layer.src} className={`m-video${loadedClass}`} src={layer.src} muted loop playsInline />
      ) : (
        <video
          key={layer.src}
          ref={videoRef}
          className="m-video"
          src={layer.src}
          poster={og}
          muted={muted}
          loop
          playsInline
          onCanPlay={(e) => e.currentTarget.classList.add('loaded')}
          onError={() => markBroken(layer.src)}
        />
      )
      // 视频用 contain 居中，底下垫 og 模糊海报当背景
      return (
        <>
          <img className="m-img m-blur" src={og} alt="" aria-hidden="true" />
          {video}
        </>
      )
    }
    if (layer.kind === 'og') {
      return (
        <div key={layer.src}>
          <img className="m-img m-blur" src={layer.src} alt="" aria-hidden="true" />
          <img
            className={`m-img m-contain${loadedClass}`}
            src={layer.src}
            alt={`${repo.full_name} 预览图`}
            onLoad={(e) => e.currentTarget.classList.add('loaded')}
            onError={() => markBroken(layer.src)}
          />
        </div>
      )
    }
    return (
      <img
        key={layer.src}
        className={`m-img${loadedClass}`}
        src={layer.src}
        alt={`${repo.full_name} 预览图`}
        onLoad={(e) => e.currentTarget.classList.add('loaded')}
        onError={() => markBroken(layer.src)}
      />
    )
  }

  if (target && shown && shown.src === target.src) {
    return (
      <>
        {/* 按钮放在缩放容器外：slide-media 的 kenburns 会把锚定边缘的元素推出屏幕 */}
        <div className={`slide-media ${ogMode ? 'og-mode' : ''}`}>
          {fading && renderLayer(fading, true)}
          {renderLayer(shown, false)}
          <div className="media-scrim" />
        </div>
        <div className="media-top-actions">
          {target.kind === 'video' && (
            <button
              className="media-mini-btn"
              onClick={() => setMuted((m) => !m)}
              title={muted ? '开启声音' : '静音'}
              aria-label={muted ? '开启声音' : '静音'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
          )}
          {content && (
            <button className="media-readme-btn" onClick={() => setOpen(true)}>
              📖 展开 README
            </button>
          )}
        </div>
      </>
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
