import { isAxiosError } from 'axios'

type ApiErrorBody = {
  error?: {
    message?: string
    code?: string
    details?: Array<{ path?: string; message?: string }>
  }
}

/** 從 API／網路錯誤取出可給使用者看的說明（含 HTTP status、後端 error.message、驗證 details） */
export function getApiErrorMessage(e: unknown): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as ApiErrorBody | undefined
    const apiMsg = data?.error?.message?.trim()
    const details = data?.error?.details
    if (apiMsg) {
      if (Array.isArray(details) && details.length > 1) {
        const extra = details
          .slice(1, 4)
          .map((d) => (d.path && d.message ? `${d.path}：${d.message}` : d.message))
          .filter(Boolean)
          .join('；')
        if (extra) return `${apiMsg} ${extra}`
      }
      return apiMsg
    }
    const status = e.response?.status
    if (status != null) {
      const base = `HTTP ${status}`
      if (e.message && !e.message.startsWith('Request failed')) return `${base} · ${e.message}`
      return status === 404
        ? `${base}（找不到資源或路徑）`
        : `${base}（無詳細訊息，請看 Network 回應內容）`
    }
    if (e.code === 'ERR_NETWORK') return '無法連上伺服器（請確認 VITE_API_URL 與網路）'
    if (e.message) return e.message
    return '請求失敗'
  }
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'string' && e.trim()) return e.trim()
  return '發生未知錯誤'
}
