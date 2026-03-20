/**
 * 租戶相關型別（平台後台租戶管理）
 * 與後端 GET/POST/PATCH /platform-admin/tenants 對齊
 */

/** 租戶列表／單筆 */
export interface TenantItem {
  id: string
  name: string
  slug: string | null
  status: string
  expiresAt: string | null
  userLimit: number | null
  fileSizeLimitMb: number | null
  storageQuotaMb: number | null
  createdAt: string
  updatedAt: string
  /** 該租戶最早建立之租戶管理員 Email（平台 API 附加；無則 null） */
  primaryAdminEmail?: string | null
  _count?: { users: number; projects: number }
}

/** 新增租戶 payload */
export interface CreateTenantPayload {
  name: string
  slug?: string | null
  status?: 'active' | 'suspended'
  expiresAt?: string | null
  userLimit?: number | null
  fileSizeLimitMb?: number | null
  storageQuotaMb?: number | null
}

/** 更新租戶 payload */
export interface UpdateTenantPayload {
  name?: string
  slug?: string | null
  status?: 'active' | 'suspended'
  expiresAt?: string | null
  userLimit?: number | null
  fileSizeLimitMb?: number | null
  storageQuotaMb?: number | null
}
