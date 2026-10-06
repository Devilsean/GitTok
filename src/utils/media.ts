import type { Repo } from '../api/types'

/** GitHub 自动生成的社交预览卡（含仓库名/描述/star 的宽幅图），零 API 成本 */
export function ogImage(fullName: string): string {
  return `https://opengraph.githubassets.com/1/${fullName}`
}

/** 常见徽标/状态图服务，不适合作为项目主图 */
const BADGE_URL =
  /shields\.io|badgen\.net|badge|circleci|travis|codecov|coveralls|discord|opencollective|npmjs\.com|buymeacoffee|liberapay/i

/** 浏览器 <video> 能直接播的容器格式（m3u8/avi/mkv 不行，不收） */
const PLAYABLE_VIDEO = /\.(mp4|webm|mov)(\?|$)/i

/** <img> 放不了视频文件（README 常用 ![](demo.mp4) 占位），交给 extractHeroVideo */
const VIDEO_EXT = /\.(mp4|mov|webm|m3u8|avi|mkv)(\?|$)/i

/** 从 README 原文收集全部媒体候选（跳过徽标/状态图），相对路径解析到 raw 直链 */
function collectMedia(md: string, repo: Repo): string[] {
  const candidates: string[] = []

  const push = (src: string) => {
    const abs = resolveImg(src, repo)
    if (!abs || abs.startsWith('data:')) return
    if (BADGE_URL.test(abs) || /badge\.svg$/i.test(abs)) return
    candidates.push(abs)
  }

  for (const m of md.matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)[^)]*\)/g)) push(m[1])
  for (const m of md.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) push(m[1])
  for (const m of md.matchAll(/<video[^>]+src=["']([^"']+)["']/gi)) push(m[1])
  for (const m of md.matchAll(/<source[^>]+src=["']([^"']+)["']/gi)) push(m[1])
  // <picture> 的 <source srcset> 是深浅色双图变体，跳过，img 的 src 已兜底

  return candidates
}

/** 第一张"像 banner/截图"的主图（跳过视频文件；同尺寸下非 svg 优先） */
export function extractHeroImage(md: string, repo: Repo): string | null {
  const images = collectMedia(md, repo).filter((u) => !VIDEO_EXT.test(u))
  if (images.length === 0) return null
  return images.find((u) => !/\.svg(\?|$)/i.test(u)) ?? images[0]
}

/** 第一段可直接播放的 demo 视频（mp4/webm/mov），没有则 null */
export function extractHeroVideo(md: string, repo: Repo): string | null {
  return collectMedia(md, repo).find((u) => PLAYABLE_VIDEO.test(u)) ?? null
}

function resolveImg(src: string, repo: Repo): string | null {
  if (/^https?:\/\//i.test(src)) return src
  if (src.startsWith('//')) return `https:${src}`
  if (src.startsWith('/') && !src.startsWith('//')) {
    // GitHub 页面用的绝对路径 /owner/repo/branch/path
    return `https://raw.githubusercontent.com${src}`
  }
  const branch = repo.default_branch || 'HEAD'
  return `https://raw.githubusercontent.com/${repo.full_name}/${branch}/${src.replace(/^\.\//, '')}`
}
