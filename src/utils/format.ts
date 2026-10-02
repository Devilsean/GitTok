export function formatCount(n: number): string {
  if (n >= 1_000_000) return trimZero(n / 1_000_000) + 'm'
  if (n >= 1_000) return trimZero(n / 1_000) + 'k'
  return String(n)
}

function trimZero(v: number): string {
  return v.toFixed(1).replace(/\.0$/, '')
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return '刚刚'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`
  if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)} 天前`
  if (seconds < 86400 * 365) return `${Math.floor(seconds / (86400 * 30))} 个月前`
  return `${Math.floor(seconds / (86400 * 365))} 年前`
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + ' …' : s
}

/**
 * README 预览清洗：react-markdown 默认不渲染原生 HTML，
 * 而 README 开头常见徽标/banner 全是 HTML，直接展示会变成一坨标签文本。
 * 逐行剥离 HTML 标签：剥完为空的行丢弃（徽标行），有文字的保留（如 <b>标题</b>），
 * 围栏代码块原样跳过。
 */
export function cleanReadme(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inFence = false
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }
    if (line.includes('<!--')) continue
    if (line.trim() === '') {
      // 原始空行保留（段落分隔依据），连续空行压成一个
      if (out[out.length - 1] !== '') out.push('')
      continue
    }
    const cleaned = line.replace(/<[^>]*>/g, '').replace(/\s{2,}/g, ' ')
    if (cleaned.trim() === '') continue
    out.push(cleaned)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
