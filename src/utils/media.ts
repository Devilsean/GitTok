import type { Repo } from '../api/types'

/** GitHub 自动生成的社交预览卡（含仓库名/描述/star 的宽幅图），零 API 成本 */
export function ogImage(fullName: string): string {
  return `https://opengraph.githubassets.com/1/${fullName}`
}

/** 常见徽标/状态图服务，不适合作为项目主图 */
const BADGE_URL =
  /shields\.io|badgen\.net|badge|circleci|travis|codecov|coveralls|discord|opencollective|npmjs\.com|buymeacoffee|liberapay/i

/** 视频容器浏览器 <img> 放不了 */
const VIDEO_EXT = /\.(mp4|mov|webm|m3u8|avi|mkv)(\?|$)/i

/**
 * 从 README 原文提取项目主图：优先取第一张"像 banner/截图"的图
 * （跳过 shields 徽标、状态图标、视频文件；同尺寸下非 svg 优先）。
 * 相对路径按默认分支解析到 raw.githubusercontent.com。
 */
export function extractHeroImage(md: string, repo: Repo): string | null {
  const candidates: string[] = []

  const push = (src: string) => {
    const abs = resolveImg(src, repo)
    if (!abs || abs.startsWith('data:')) return
    if (BADGE_URL.test(abs) || VIDEO_EXT.test(abs) || /badge\.svg$/i.test(abs)) return
    candidates.push(abs)
  }

  for (const m of md.matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)[^)]*\)/g)) push(m[1])
  for (const m of md.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) push(m[1])
  // <picture> 的 <source srcset> 是深浅色双图变体，跳过，img 的 src 已兜底

  if (candidates.length === 0) return null
  return candidates.find((u) => !/\.svg(\?|$)/i.test(u)) ?? candidates[0]
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
