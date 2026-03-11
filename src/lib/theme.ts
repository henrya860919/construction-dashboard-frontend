import { THEME_STORAGE_KEY, type ThemeMode } from '@/constants/theme'

function getStored(): ThemeMode | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return null
}

export function getThemeMode(): ThemeMode {
  return getStored() ?? 'system'
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}

export function getEffectiveIsDark(): boolean {
  const mode = getThemeMode()
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyTheme(): void {
  if (typeof document === 'undefined') return
  const isDark = getEffectiveIsDark()
  document.documentElement.classList.toggle('dark', isDark)
}

/** 訂閱系統偏好變更（僅在 mode 為 system 時有意義），回傳取消訂閱函式 */
export function subscribeToSystemPreference(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => cb()
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
