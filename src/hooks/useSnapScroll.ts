import { useEffect, useRef, type RefObject } from 'react'

interface Options {
  containerRef: RefObject<HTMLDivElement | null>
  /** 当前激活卡片下标（ref 形式，避免闭包过期） */
  indexRef: { current: number }
  goTo: (index: number) => void
  enabled: boolean
}

/**
 * 竖向翻页手势：滚轮与键盘逐卡切换（touch 设备直接用原生 scroll-snap 惯性滚动）。
 * 滚轮采用「累计增量 + 冷却锁」，避免一次滚动跳过多张卡片。
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
