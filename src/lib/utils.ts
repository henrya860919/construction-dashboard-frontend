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
