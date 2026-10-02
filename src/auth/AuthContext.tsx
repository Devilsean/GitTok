import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getCurrentUser, getToken, setToken } from '../api/github'
import type { GitHubUser } from '../api/types'
import { pushToast } from '../utils/toast'

interface AuthCtx {
  token: string | null
  user: GitHubUser | null
  loginOpen: boolean
  setLoginOpen: (open: boolean) => void
  /** 校验并保存会话；失败时抛错（全局 token 已回滚） */
  signInWithToken: (token: string) => Promise<void>
  signOut: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(() => getToken())
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)

  // 启动时校验已保存的 token
  useEffect(() => {
    if (!token) return
    getCurrentUser()
      .then(setUser)
      .catch(() => {
        setToken(null)
        setTok(null)
      })
    // 仅在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signInWithToken = useCallback(async (t: string) => {
    setToken(t)
    try {
      const u = await getCurrentUser()
      setTok(t)
      setUser(u)
      setLoginOpen(false)
      pushToast(`你好，${u.login}！登录成功 🎉`)
    } catch (e) {
      setToken(null)
      throw e
    }
  }, [])

  const signOut = useCallback(() => {
    setToken(null)
    setTok(null)
    setUser(null)
    pushToast('已退出登录')
  }, [])

  const value = useMemo(
    () => ({ token, user, loginOpen, setLoginOpen, signInWithToken, signOut }),
    [token, user, loginOpen, signInWithToken, signOut],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return v
}
