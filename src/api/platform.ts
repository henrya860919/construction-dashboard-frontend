import { apiClient } from './client'
import { API_PATH } from '@/constants'
import type { PaginatedResponse } from '@/types'

export interface TenantItem {
  id: string
  name: string
  slug: string | null
  createdAt: string
  updatedAt: string
}

export async function fetchTenants(params?: { page?: number; limit?: number }) {
  const { data } = await apiClient.get<PaginatedResponse<TenantItem>>(
    API_PATH.PLATFORM_TENANTS,
    { params }
  )
  return { list: data.data, meta: data.meta }
}
