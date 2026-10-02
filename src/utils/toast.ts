import { useSyncExternalStore } from 'react'

export interface Toast {
  id: number
  text: string
}

let toasts: Toast[] = []
const listeners = new Set<() => void>()
let seq = 1

export function pushToast(text: string): void {
  const t: Toast = { id: seq++, text }
  toasts = [...toasts, t]
  listeners.forEach((l) => l())
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id)
    listeners.forEach((l) => l())
  }, 2600)
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => toasts,
    () => toasts,
  )
}
