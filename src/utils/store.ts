import { useSyncExternalStore } from 'react'
import type { Repo } from '../api/types'

/** 点赞 / 收藏的本地持久化仓库（保存完整快照，离线也能展示） */
export interface SavedRepo {
  repo: Repo
  ts: number
}

export type ListKey = 'gittok_likes' | 'gittok_collections'

const listeners = new Set<() => void>()
const caches = new Map<ListKey, SavedRepo[]>()

function load(key: ListKey): SavedRepo[] {
  let items = caches.get(key)
  if (!items) {
    try {
      items = JSON.parse(localStorage.getItem(key) ?? '[]') as SavedRepo[]
    } catch {
      items = []
    }
    caches.set(key, items)
  }
  return items
}

function save(key: ListKey, items: SavedRepo[]): void {
  caches.set(key, items)
  localStorage.setItem(key, JSON.stringify(items))
  listeners.forEach((l) => l())
}

export interface LocalListApi {
  items: SavedRepo[]
  has: (id: number) => boolean
  toggle: (repo: Repo) => boolean
  remove: (id: number) => void
}

function api(key: ListKey): Omit<LocalListApi, 'items'> {
  return {
    has: (id) => load(key).some((x) => x.repo.id === id),
    toggle: (repo) => {
      const items = load(key)
      const idx = items.findIndex((x) => x.repo.id === repo.id)
      if (idx >= 0) {
        items.splice(idx, 1)
        save(key, items)
        return false
      }
      save(key, [{ repo, ts: Date.now() }, ...items])
      return true
    },
    remove: (id) => save(key, load(key).filter((x) => x.repo.id !== id)),
  }
}

const EMPTY: SavedRepo[] = []

export function useLocalList(key: ListKey): LocalListApi {
  const items = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => load(key),
    () => EMPTY,
  )
  return { items, ...api(key) }
}
