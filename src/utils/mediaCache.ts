import { getReadme } from '../api/github'
import type { Repo } from '../api/types'
import { extractHeroImage, extractHeroVideo, ogImage } from './media'

const loadedImages = new Set<string>()

/** 预载一张图（去重），成功返回 true */
export function preloadImage(src: string): Promise<boolean> {
  if (loadedImages.has(src)) return Promise.resolve(true)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      loadedImages.add(src)
      resolve(true)
    }
    img.onerror = () => resolve(false)
    img.src = src
  })
}

/** 只预取视频开头（元数据 + 首帧），完整加载交给挂载后的 <video> 流式播放 */
export async function prefetchVideo(src: string): Promise<void> {
  try {
    await fetch(src, { headers: { Range: 'bytes=0-262144' } })
  } catch {
    /* 预取失败无碍，<video> 自己会再请求 */
  }
}

/**
 * 预取一张卡的全部媒体：og 图 + README 主图/视频首块。
 * README 走 api 层的会话缓存，这里调一次即完成"预热"，卡片激活时零等待。
 */
export async function prefetchCardMedia(repo: Repo): Promise<void> {
  void preloadImage(ogImage(repo.full_name))
  let md: string | null = null
  try {
    md = await getReadme(repo.full_name, repo.default_branch)
  } catch {
    md = null
  }
  if (!md) return
  const video = extractHeroVideo(md, repo)
  if (video) {
    void prefetchVideo(video)
    return
  }
  const hero = extractHeroImage(md, repo)
  if (hero) void preloadImage(hero)
}
