import {
  THEME_STORAGE_KEY,
  ACCENT_STORAGE_KEY,
  type ThemeMode,
  type AccentScheme,
} from '@/constants/theme'

const VALID_ACCENTS: AccentScheme[] = ['default', 'blue', 'green', 'orange', 'violet']

function getStored(): ThemeMode | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return null
}

function getStoredAccent(): AccentScheme | null {
  try {
    const v = localStorage.getItem(ACCENT_STORAGE_KEY)
    if (v && VALID_ACCENTS.includes(v as AccentScheme)) return v as AccentScheme
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

export function getAccent(): AccentScheme {
  return getStoredAccent() ?? 'default'
}

export function setAccent(scheme: AccentScheme): void {
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, scheme)
  } catch {
    /* ignore */
  }
}

export function applyAccent(): void {
  if (typeof document === 'undefined') return
  const scheme = getAccent()
  document.documentElement.setAttribute('data-accent', scheme)
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
  applyAccent()
}

/** 訂閱系統偏好變更（僅在 mode 為 system 時有意義），回傳取消訂閱函式 */
export function subscribeToSystemPreference(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => cb()
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
