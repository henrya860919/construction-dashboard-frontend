/**
 * 使用者相關型別（平台/租戶後台列表、成員管理）
 * 與後端 GET /platform-admin/users、GET /admin/users 對齊
 */

/** 平台使用者總覽／租戶帳號列表單筆 */
export interface PlatformUserItem {
  id: string
  email: string
  name: string | null
  systemRole: string
  memberType: string
  tenantId: string | null
  tenantName?: string | null
  createdAt: string
  updatedAt: string
}

/** 成員狀態（後台成員管理） */
export type UserStatus = 'active' | 'suspended'

/** 租戶後台成員列表單筆（含 status） */
export interface AdminUserItem extends PlatformUserItem {
  status?: UserStatus
}
