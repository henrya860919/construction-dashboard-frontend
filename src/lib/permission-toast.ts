import { toast } from '@/components/ui/sonner'

/** 非「編輯／刪除」類操作：按鈕仍顯示，點擊時若無權限則 toast */
const MESSAGES = {
  create: '您沒有新增權限',
  read: '您沒有檢視或下載權限',
  /** 需 update 但非「編輯」按鈕本身（例如契約檔新增分類） */
  change: '您沒有變更權限',
} as const

export type PermissionDeniedKind = keyof typeof MESSAGES

export function toastPermissionDenied(kind: PermissionDeniedKind): void {
  toast.error(MESSAGES[kind])
}

/** @returns true 表示有權限可繼續；false 時已顯示 toast */
export function ensureProjectPermission(
  allowed: boolean,
  kind: PermissionDeniedKind = 'create'
): boolean {
  if (allowed) return true
  toastPermissionDenied(kind)
  return false
}
