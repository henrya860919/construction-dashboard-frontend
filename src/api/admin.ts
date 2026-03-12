import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse } from '@/types/api'

export interface AdminTenantInfo {
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
  memberCount: number
  projectCount: number
  storageUsageBytes: number
}

export async function getAdminTenantInfo(): Promise<AdminTenantInfo> {
  const { data } = await apiClient.get<ApiResponse<AdminTenantInfo>>(API_PATH.ADMIN_TENANT_INFO)
  return data.data
}
