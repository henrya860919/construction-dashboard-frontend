import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse } from '@/types/api'

/** 當前使用者所屬租戶品牌（供 header 顯示，僅需登入） */
export interface TenantBranding {
  name: string | null
  hasLogo: boolean
}

export async function getTenantBranding(): Promise<TenantBranding> {
  const { data } = await apiClient.get<ApiResponse<TenantBranding>>(API_PATH.AUTH_TENANT_BRANDING)
  return data.data
}

export interface AdminTenantInfo {
  id: string
  name: string
  slug: string | null
  logoStorageKey?: string | null
  status: string
  expiresAt: string | null
  userLimit: number | null
  fileSizeLimitMb: number | null
  storageQuotaMb: number | null
  createdAt: string
  updatedAt: string
  memberCount: number
  projectCount: number
  storageUsageBytes: number
}

export async function getAdminTenantInfo(tenantId?: string): Promise<AdminTenantInfo> {
  const { data } = await apiClient.get<ApiResponse<AdminTenantInfo>>(API_PATH.ADMIN_TENANT_INFO, {
    params: tenantId ? { tenantId } : undefined,
  })
  return data.data
}

/** 與 GET .../admin/tenant/module-entitlements 一致 */
export interface AdminTenantModuleEntitlementsDto {
  disabledModuleIds: string[]
  moduleEntitlementsGranted: boolean
}

export async function getAdminTenantModuleEntitlements(tenantId?: string): Promise<AdminTenantModuleEntitlementsDto> {
  const { data } = await apiClient.get<ApiResponse<AdminTenantModuleEntitlementsDto>>(
    API_PATH.ADMIN_TENANT_MODULE_ENTITLEMENTS,
    { params: tenantId ? { tenantId } : undefined }
  )
  return data.data
}

/** 更新公司名稱 */
export async function updateCompanyName(name: string): Promise<{ name: string }> {
  const { data } = await apiClient.patch<ApiResponse<{ id: string; name: string; logoStorageKey: string | null; slug: string | null; status: string; updatedAt: string }>>(
    API_PATH.ADMIN_COMPANY_SETTINGS,
    { name }
  )
  return data.data
}

/** 上傳公司 Logo（multipart form: file） */
export async function uploadCompanyLogo(file: File): Promise<void> {
  const form = new FormData()
  form.append('file', file)
  await apiClient.post(API_PATH.ADMIN_COMPANY_SETTINGS + '/logo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 取得公司 Logo 的 blob（用於 header / 公司設定預覽，僅需登入，依所屬租戶） */
export async function getTenantLogoBlob(): Promise<Blob> {
  const res = await apiClient.get<Blob>(API_PATH.AUTH_TENANT_LOGO, {
    responseType: 'blob',
  })
  return res.data
}
