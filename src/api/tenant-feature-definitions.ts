import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse } from '@/types/api'
import type { FeatureDefinition } from '@/types/feature-definition'

export interface TenantFeatureDefinitionFormSummary {
  id: string
  name: string
  status: string
}

export type TenantFeatureDefinitionAdminRow = FeatureDefinition & {
  form: TenantFeatureDefinitionFormSummary | null
}

function tenantParams(tenantId: string | undefined): Record<string, string> {
  return tenantId ? { tenantId } : {}
}

export async function listAdminTenantFeatureDefinitions(
  tenantId: string | undefined
): Promise<TenantFeatureDefinitionAdminRow[]> {
  const { data } = await apiClient.get<ApiResponse<TenantFeatureDefinitionAdminRow[]>>(
    API_PATH.ADMIN_TENANT_FEATURE_DEFINITIONS,
    { params: tenantParams(tenantId) }
  )
  return data.data
}

export interface AdminTenantFeatureDefinitionCreateBody {
  name: string
  description?: string | null
  icon?: string | null
  systemModule: string
  formId: string
  closeFormId?: string | null
  tenantSortOrder?: number
}

export async function createAdminTenantFeatureDefinition(
  tenantId: string | undefined,
  body: AdminTenantFeatureDefinitionCreateBody
): Promise<FeatureDefinition> {
  const { data } = await apiClient.post<ApiResponse<FeatureDefinition>>(
    API_PATH.ADMIN_TENANT_FEATURE_DEFINITIONS,
    body,
    { params: tenantParams(tenantId) }
  )
  return data.data
}

export type AdminTenantFeatureDefinitionUpdateBody = Partial<AdminTenantFeatureDefinitionCreateBody> & {
  status?: 'active' | 'inactive'
}

export async function updateAdminTenantFeatureDefinition(
  tenantId: string | undefined,
  id: string,
  body: AdminTenantFeatureDefinitionUpdateBody
): Promise<FeatureDefinition> {
  const { data } = await apiClient.patch<ApiResponse<FeatureDefinition>>(
    API_PATH.ADMIN_TENANT_FEATURE_DEFINITION(id),
    body,
    { params: tenantParams(tenantId) }
  )
  return data.data
}

export async function deleteAdminTenantFeatureDefinition(
  tenantId: string | undefined,
  id: string
): Promise<void> {
  await apiClient.delete(API_PATH.ADMIN_TENANT_FEATURE_DEFINITION(id), {
    params: tenantParams(tenantId),
  })
}
