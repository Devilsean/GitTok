import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'

const AUTH_BASE: string = import.meta.env.VITE_GH_AUTH_BASE ?? '/gh-auth'
const CLIENT_ID: string | undefined = import.meta.env.VITE_GITHUB_CLIENT_ID

type Step = 'choose' | 'device' | 'token'

/**
 * 登录弹窗：设备码登录（Device Flow，通过本地代理）为首选，
 * Personal Access Token 粘贴为后备。
 */
export function LoginModal() {
  const { loginOpen, setLoginOpen, signInWithToken } = useAuth()
  const [step, setStep] = useState<Step>('choose')
  const [device, setDevice] = useState<{ userCode: string; verifyUrl: string } | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const stopPollRef = useRef<(() => void) | null>(null)

  // 关闭弹窗时复位并停止轮询
  useEffect(() => {
    if (loginOpen) return
    stopPollRef.current?.()
    stopPollRef.current = null
    setStep('choose')
    setDevice(null)
    setErr('')
    setBusy(false)
  }, [loginOpen])

  useEffect(() => () => stopPollRef.current?.(), [])

  function startPolling(deviceCode: string, intervalMs: number) {
    let stopped = false
    let timer = 0
    const tick = async (): Promise<void> => {
      if (stopped) return
      try {
        const res = await fetch(`${AUTH_BASE}/login/oauth/access_token`, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new URLSearchParams({
            client_id: CLIENT_ID ?? '',
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        })
        const j = (await res.json()) as { access_token?: string; error?: string; error_description?: string }
        if (stopped) return
        if (j.access_token) {
          stopped = true
          await signInWithToken(j.access_token)
          return
        }
        if (j.error === 'slow_down') intervalMs += 5000
        else if (j.error && j.error !== 'authorization_pending') {
          stopped = true
          setErr(j.error_description ?? `授权失败：${j.error}`)
          return
        }
      } catch {
        /* 网络抖动，继续轮询 */
      }
      timer = window.setTimeout(() => void tick(), intervalMs)
    }
    void tick()
    stopPollRef.current = () => {
      stopped = true
      clearTimeout(timer)
    }
  }

  async function startDeviceFlow() {
    if (!CLIENT_ID) {
      setErr('未配置 VITE_GITHUB_CLIENT_ID，请按下方说明创建 GitHub OAuth App 后重启 npm run dev')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const res = await fetch(`${AUTH_BASE}/login/device/code`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams({ client_id: CLIENT_ID, scope: 'public_repo read:user' }),
      })
      const data = (await res.json()) as {
        device_code?: string
        user_code?: string
        verification_uri?: string
        interval?: number
        error_description?: string
      }
      if (!data.device_code || !data.user_code || !data.verification_uri) {
        throw new Error(data.error_description ?? '获取设备码失败，请检查 Client ID')
      }
      setDevice({ userCode: data.user_code, verifyUrl: data.verification_uri })
      setStep('device')
      startPolling(data.device_code, (data.interval ?? 5) * 1000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '获取设备码失败')
    } finally {
      setBusy(false)
    }
  }

  async function submitToken() {
    setBusy(true)
    setErr('')
    try {
      await signInWithToken(tokenInput.trim())
    } catch {
      setErr('Token 无效或权限不足（需要 public_repo 权限）')
    } finally {
      setBusy(false)
    }
  }

  if (!loginOpen) return null

  return (
    <div className="modal-backdrop" onClick={() => setLoginOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>登录 GitHub</h3>
          <button className="x" onClick={() => setLoginOpen(false)} aria-label="关闭">
            ✕
          </button>
        </div>

        {step === 'choose' && (
          <div className="modal-body">
            <p className="muted">
              登录后可以直接把仓库 <b>Star 到你的 GitHub 账号</b>、解锁个性化推荐，API
              限额也会提升到 5000 次/小时。
            </p>
            <button className="btn accent block" onClick={() => void startDeviceFlow()} disabled={busy}>
              {busy ? '正在获取设备码…' : '🔐 设备码登录（推荐）'}
            </button>
            <button className="btn block" onClick={() => setStep('token')}>
              粘贴 Personal Access Token
            </button>
            {!CLIENT_ID && (
              <div className="hint-box">
                <b>设备码登录需要先创建 GitHub OAuth App（约 1 分钟）：</b>
                <ol>
                  <li>
                    打开{' '}
                    <a href="https://github.com/settings/developers" target="_blank" rel="noreferrer">
                      Settings → Developer settings → OAuth Apps
                    </a>{' '}
                    → New OAuth App
                  </li>
                  <li>应用名随意，Homepage URL 填 http://localhost:5173，回调 URL 可不填</li>
                  <li>
                    创建后进入应用设置，勾选 <b>Enable Device Flow</b>
                  </li>
                  <li>
                    把 Client ID 填入项目根目录 <code>.env</code> 的{' '}
                    <code>VITE_GITHUB_CLIENT_ID</code>（可从 <code>.env.example</code> 复制），重启{' '}
                    <code>npm run dev</code>
                  </li>
                </ol>
              </div>
            )}
            {err && <p className="err">{err}</p>}
          </div>
        )}

        {step === 'device' && device && (
          <div className="modal-body">
            <p className="muted">第 1 步：在新页面输入这个一次性代码</p>
            <div className="code-box">{device.userCode}</div>
            <p className="muted">第 2 步：授权 GitTok 访问你的公开资料与 Star 权限</p>
            <a className="btn accent block" href={device.verifyUrl} target="_blank" rel="noreferrer">
              打开 github.com/login/device ↗
            </a>
            <p className="muted center">
              <span className="spinner-s" /> 等待授权中…（完成后自动关闭）
            </p>
            {err && <p className="err">{err}</p>}
            <button
              className="btn block"
              onClick={() => {
                stopPollRef.current?.()
                stopPollRef.current = null
                setStep('choose')
              }}
            >
              返回
            </button>
          </div>
        )}

        {step === 'token' && (
          <div className="modal-body">
            <p className="muted">
              创建 Token 时勾选 <code>public_repo</code> 权限（
              <a
                href="https://github.com/settings/tokens/new?scopes=public_repo&description=GitTok"
                target="_blank"
                rel="noreferrer"
              >
                点此直达创建页 ↗
              </a>
              ）。Token 只保存在你的浏览器本地，不会上传。
            </p>
            <input
              className="input"
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxx"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tokenInput.trim()) void submitToken()
              }}
            />
            {err && <p className="err">{err}</p>}
            <button
              className="btn accent block"
              onClick={() => void submitToken()}
              disabled={busy || !tokenInput.trim()}
            >
              {busy ? '验证中…' : '登录'}
            </button>
            <button className="btn block" onClick={() => setStep('choose')}>
              返回
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
