/**
 * 登入／使用者相關型別（與後端 JWT / auth/me 對齊）
 */
export type SystemRole = 'platform_admin' | 'tenant_admin' | 'project_user'

export interface User {
  id: string
  email: string
  name?: string | null
  /** 是否有上傳個人頭貼（無則顯示姓名首字） */
  hasAvatar?: boolean
  systemRole: SystemRole
  tenantId?: string | null
}

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: User
}
