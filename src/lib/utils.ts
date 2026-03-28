import type { Updater } from '@tanstack/vue-table'
import type { Ref } from 'vue'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 用於 TanStack Table 的 onXxxChange，更新 Vue ref */
export function valueUpdater<T>(updaterOrValue: Updater<T>, ref: Ref<T>) {
  ref.value = typeof updaterOrValue === 'function' ? (updaterOrValue as (prev: T) => T)(ref.value) : updaterOrValue
}

/** 表格列暫用 key；在非安全環境（非 HTTPS／非 localhost）fallback，避免 crypto.randomUUID 不存在 */
export function randomRowKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `rk-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * 隨機十六進位字串（長度 `length`）。優先 `getRandomValues`（HTTP 區網仍可用，不要求 secure context）。
 */
export function randomHexToken(length: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(Math.ceil(length / 2))
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length)
  }
  let s = ''
  while (s.length < length) {
    s += Math.random().toString(16).slice(2)
  }
  return s.slice(0, length)
}

/**
 * 客戶端唯一 id（Vue key、表單建構器區塊 id）。不依賴僅限 secure context 的 `randomUUID`。
 */
export function randomClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `c-${randomHexToken(16)}-${Date.now().toString(36)}`
}

/** `<input type="date">` 的 `YYYY-MM-DD` → ISO（該日本地 0:00:00.000） */
export function localDateStartIso(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()
}

/** `<input type="date">` 的 `YYYY-MM-DD` → ISO（該日本地 23:59:59.999） */
export function localDateEndIso(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString()
}
