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
