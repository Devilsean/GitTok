/** 触觉反馈（Android Chrome 支持；不支持的平台静默忽略） */
export function buzz(ms = 15): void {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* 忽略 */
  }
}
