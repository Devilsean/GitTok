import type { Repo } from '../api/types'
import { cleanReadme } from './format'

export interface RepoInsight {
  ageDays: number
  perDay: number
  /** 成就标签：万星俱乐部 / 本周黑马 等 */
  tier?: { label: string; kind: 'legend' | 'hot' | 'new' }
  /** 涨星速度，如 "日均 +700★"（仅新仓库且速度可观时） */
  velocity?: string
}

/** 从仓库数据推导"为什么值得关注"的钩子信息 */
export function getInsight(repo: Repo): RepoInsight {
  const ageDays = Math.max(1, (Date.now() - new Date(repo.created_at).getTime()) / 86_400_000)
  const perDay = repo.stargazers_count / ageDays

  let tier: RepoInsight['tier']
  if (repo.stargazers_count >= 50_000) tier = { label: '🌟 五万星传奇', kind: 'legend' }
  else if (repo.stargazers_count >= 10_000) tier = { label: '万星俱乐部', kind: 'legend' }
  else if (ageDays <= 7 && repo.stargazers_count >= 300) tier = { label: '⚡ 本周黑马', kind: 'hot' }
  else if (ageDays <= 30 && repo.stargazers_count >= 500) tier = { label: '🚀 本月爆款', kind: 'hot' }
  else if (ageDays <= 90 && repo.stargazers_count >= 100) tier = { label: '🌱 上升新星', kind: 'new' }

  const velocity = ageDays <= 60 && perDay >= 20 ? `日均 +${Math.round(perDay)}★` : undefined

  return { ageDays, perDay, tier, velocity }
}

/**
 * 从 README 提取一句话简介：取第一段"像人话"的内容
 * （跳过代码块、纯标题、列表/表格/引用块、导航链接行，短于 24 字的也不算）。
 */
export function extractIntro(md: string, max = 220): string {
  const cleaned = cleanReadme(md)
  if (!cleaned) return ''
  for (const raw of cleaned.split(/\n{2,}/)) {
    // markdown 行内语法先转纯文本
    let block = raw
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`]+/g, '')
      .trim()
    if (!block || block.startsWith('```')) continue
    if (/^#{1,6}\s/.test(block) && !block.includes('\n')) continue
    if (/^[-*|>]/.test(block)) continue
    // 块内混入标题（清洗后段落合并的兜底）：截断到标题处
    const headingAt = block.search(/#{1,6}\s/)
    if (headingAt > 0) block = block.slice(0, headingAt).trim()
    // 导航/页脚行（大量 "·" 分隔）跳过
    if ((block.match(/·/g) ?? []).length >= 3) continue
    const text = block.replace(/\s+/g, ' ').trim()
    if (text.length < 24) continue
    return cutAtSentence(text, max)
  }
  return ''
}

/** 截断到 max，并在最近的句末标点处收尾，避免"话说一半" */
function cutAtSentence(text: string, max: number): string {
  if (text.length <= max) return text
  const slice = text.slice(0, max)
  const lastStop = Math.max(
    slice.lastIndexOf('。'),
    slice.lastIndexOf('！'),
    slice.lastIndexOf('？'),
    slice.lastIndexOf('；'),
    slice.lastIndexOf('. '),
  )
  return (lastStop > 40 ? slice.slice(0, lastStop + 1) : slice.trim()) + '…'
}

/** 判断简介与仓库描述是否高度重复（重复时不再展示引言，避免啰嗦） */
export function introDuplicatesDescription(intro: string, description: string | null): boolean {
  if (!description) return false
  const norm = (s: string) => s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
  const d = norm(description)
  const i = norm(intro)
  if (i.length < 20 || d.length < 20) return false
  return d.includes(i.slice(0, 40)) || i.includes(d.slice(0, 40))
}
