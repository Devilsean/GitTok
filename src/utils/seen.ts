import { useSyncExternalStore } from 'react'

/** 本会话累计"刷"过的仓库数（持久化，给顶栏计数器用） */
const KEY = 'gittok_seen'

let listeners = new Set<() => void>()
let snapshot = Number(localStorage.getItem(KEY) ?? 0)

function emit(): void {
  listeners.forEach((l) => l())
}

export function bumpSeen(n: number): void {
  if (n <= 0) return
  snapshot = snapshot + n
  localStorage.setItem(KEY, String(snapshot))
  emit()
}

export function useSeen(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => snapshot,
    () => snapshot,
  )
}
