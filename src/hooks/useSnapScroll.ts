import { useEffect, useRef, type RefObject } from 'react'

interface Options {
  containerRef: RefObject<HTMLDivElement | null>
  /** 当前激活卡片下标（ref 形式，避免闭包过期） */
  indexRef: { current: number }
  goTo: (index: number) => void
  enabled: boolean
}

/** 事件目标所在活动卡片里展开的 README 面板（没有则 null） */
function findOpenReadme(target: EventTarget | null): HTMLElement | null {
  const slide = (target as HTMLElement | null)?.closest?.('.slide') as HTMLElement | null
  if (!slide || !slide.classList.contains('active')) return null
  return slide.querySelector('.readme-panel.open')
}

function openReadmeInActiveSlide(): { slide: HTMLElement; panel: HTMLElement } | null {
  const slide = document.querySelector('.slide.active') as HTMLElement | null
  const panel = slide?.querySelector('.readme-panel.open') as HTMLElement | null
  return slide && panel ? { slide, panel } : null
}

/** 面板在 dir 方向上是否还能滚（2px 容差） */
function canScroll(el: HTMLElement, dir: 1 | -1): boolean {
  if (dir > 0) return el.scrollTop + el.clientHeight < el.scrollHeight - 2
  return el.scrollTop > 2
}

/**
 * 竖向翻页手势：滚轮与键盘逐卡切换（touch 设备直接用原生 scroll-snap 惯性滚动）。
 * 滚轮采用「累计增量 + 冷却锁」，避免一次滚动跳过多张卡片。
 * 展开的 README 面板优先接管滚动：滚轮/翻页键先滚面板，滚到头才翻页，Esc 收起。
 */
export function useSnapScroll({ containerRef, indexRef, goTo, enabled }: Options): void {
  const lockRef = useRef(0)
  const accRef = useRef(0)
  const lastWheelRef = useRef(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el || !enabled) return

    const navigate = (dir: 1 | -1) => {
      const now = Date.now()
      if (now < lockRef.current) return
      lockRef.current = now + 620
      goTo(indexRef.current + dir)
    }

    const onWheel = (e: WheelEvent) => {
      // README 面板自己能滚：放行给浏览器原生滚动（面板不阻止冒泡，这里直接返回）
      const panel = findOpenReadme(e.target)
      if (panel && canScroll(panel, e.deltaY > 0 ? 1 : -1)) return
      e.preventDefault()
      const now = Date.now()
      if (now < lockRef.current) return
      if (now - lastWheelRef.current > 200) accRef.current = 0
      lastWheelRef.current = now
      accRef.current += e.deltaY
      if (Math.abs(accRef.current) >= 60) {
        const dir: 1 | -1 = accRef.current > 0 ? 1 : -1
        accRef.current = 0
        lockRef.current = now + 650
        goTo(indexRef.current + dir)
      }
    }

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      // 讨论抽屉打开时不翻页（Esc 由抽屉自己处理）
      if (document.querySelector('.comments-backdrop')) return

      const open = openReadmeInActiveSlide()
      if (open) {
        if (e.key === 'Escape') {
          e.preventDefault()
          open.slide.querySelector<HTMLElement>('.readme-close')?.click()
          return
        }
        const down = e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ' || e.key === 'j' || e.key === 'J'
        const up = e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k' || e.key === 'K'
        if (down && canScroll(open.panel, 1)) {
          e.preventDefault()
          open.panel.scrollBy({ top: open.panel.clientHeight * 0.8, behavior: 'smooth' })
          return
        }
        if (up && canScroll(open.panel, -1)) {
          e.preventDefault()
          open.panel.scrollBy({ top: -open.panel.clientHeight * 0.8, behavior: 'smooth' })
          return
        }
        // 面板已滚到头 → 落回下面的翻页逻辑
      }

      switch (e.key) {
        case 'ArrowDown':
        case 'PageDown':
        case 'j':
        case 'J':
        case ' ':
          e.preventDefault()
          navigate(1)
          break
        case 'ArrowUp':
        case 'PageUp':
        case 'k':
        case 'K':
          e.preventDefault()
          navigate(-1)
          break
        case 'Home':
          e.preventDefault()
          goTo(0)
          break
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
    }
  }, [containerRef, indexRef, goTo, enabled])
}
