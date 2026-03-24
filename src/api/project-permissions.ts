import { apiClient } from './client'
import { API_PATH } from '@/constants'
import type { ApiResponse } from '@/types'
import type { ProjectPermissionsPayload } from '@/types/permissions'
import type { PermissionModuleId } from '@/constants/permission-modules'
import { PERMISSION_MODULES } from '@/constants/permission-modules'
import type { ModulePermissionFlags } from '@/types/permissions'

export type ModulesMap = Partial<Record<PermissionModuleId, ModulePermissionFlags>> &
  Record<string, ModulePermissionFlags | undefined>

function tenantQuery(tenantId: string | undefined) {
  return tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
}

function mergeAllModules(raw: Record<string, ModulePermissionFlags> | undefined): ModulesMap {
  const out: ModulesMap = {}
  for (const m of PERMISSION_MODULES) {
    out[m] = raw?.[m] ?? {
      canCreate: false,
      canRead: false,
      canUpdate: false,
      canDelete: false,
    }
  }
  return out
}

/** 後端 PUT 須含全部模組鍵 */
export function toFullModulesPayload(
  map: Partial<Record<PermissionModuleId, ModulePermissionFlags>>
): Record<string, ModulePermissionFlags> {
  const body: Record<string, ModulePermissionFlags> = {}
  for (const m of PERMISSION_MODULES) {
    body[m] = map[m] ?? {
      canCreate: false,
      canRead: false,
      canUpdate: false,
      canDelete: false,
    }
  }
  return body
}

/** GET /api/v1/projects/:projectId/my-permissions */
export async function fetchMyProjectPermissions(
  projectId: string
): Promise<Record<PermissionModuleId, ProjectPermissionsPayload['modules'][string]>> {
  const { data } = await apiClient.get<ApiResponse<ProjectPermissionsPayload>>(
    `${API_PATH.PROJECTS}/${encodeURIComponent(projectId)}/my-permissions`
  )
  return (data.data?.modules ?? {}) as Record<PermissionModuleId, ProjectPermissionsPayload['modules'][string]>
}

/** GET /api/v1/admin/users/:id/permission-template */
export async function fetchTenantPermissionTemplate(
  userId: string,
  tenantId?: string
): Promise<ModulesMap> {
  const q = tenantQuery(tenantId)
  const { data } = await apiClient.get<
    ApiResponse<{ modules: Record<string, ModulePermissionFlags> }>
  >(`${API_PATH.ADMIN_USERS}/${encodeURIComponent(userId)}/permission-template${q}`)
  return mergeAllModules(data.data?.modules)
}

/** PUT /api/v1/admin/users/:id/permission-template */
export async function replaceTenantPermissionTemplate(
  userId: string,
  modules: Record<string, ModulePermissionFlags>,
  tenantId?: string
): Promise<ModulesMap> {
  const q = tenantQuery(tenantId)
  const { data } = await apiClient.put<
    ApiResponse<{ modules: Record<string, ModulePermissionFlags> }>
  >(`${API_PATH.ADMIN_USERS}/${encodeURIComponent(userId)}/permission-template${q}`, { modules })
  return mergeAllModules(data.data?.modules)
}

export type PresetKey = 'site_supervisor' | 'equipment_manager' | 'owner_viewer' | 'project_engineer'

/** POST /api/v1/admin/users/:id/permission-template/apply-preset */
export async function applyTenantPermissionPreset(
  userId: string,
  presetKey: PresetKey,
  tenantId?: string
): Promise<ModulesMap> {
  const q = tenantQuery(tenantId)
  const { data } = await apiClient.post<
    ApiResponse<{ modules: Record<string, ModulePermissionFlags> }>
  >(
    `${API_PATH.ADMIN_USERS}/${encodeURIComponent(userId)}/permission-template/apply-preset${q}`,
    { presetKey }
  )
  return mergeAllModules(data.data?.modules)
}

export type ProjectMemberPermissionsWithBaseline = {
  modules: ModulesMap
  baselineModules: ModulesMap
}

/** GET .../projects/:projectId/members/:userId/permissions */
export async function fetchProjectMemberPermissionOverrides(
  projectId: string,
  userId: string
): Promise<ProjectMemberPermissionsWithBaseline> {
  const { data } = await apiClient.get<
    ApiResponse<{
      modules: Record<string, ModulePermissionFlags>
      baselineModules: Record<string, ModulePermissionFlags>
    }>
  >(
    `${API_PATH.PROJECTS}/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}/permissions`
  )
  return {
    modules: mergeAllModules(data.data?.modules),
    baselineModules: mergeAllModules(data.data?.baselineModules),
  }
}

/** PUT .../permissions */
export async function replaceProjectMemberPermissionOverrides(
  projectId: string,
  userId: string,
  modules: Record<string, ModulePermissionFlags>
): Promise<ProjectMemberPermissionsWithBaseline> {
  const { data } = await apiClient.put<
    ApiResponse<{
      modules: Record<string, ModulePermissionFlags>
      baselineModules: Record<string, ModulePermissionFlags>
    }>
  >(
    `${API_PATH.PROJECTS}/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}/permissions`,
    { modules }
  )
  return {
    modules: mergeAllModules(data.data?.modules),
    baselineModules: mergeAllModules(data.data?.baselineModules),
  }
}

/** POST .../permissions/reset */
export async function resetProjectMemberPermissionOverrides(
  projectId: string,
  userId: string
): Promise<ProjectMemberPermissionsWithBaseline> {
  const { data } = await apiClient.post<
    ApiResponse<{
      modules: Record<string, ModulePermissionFlags>
      baselineModules: Record<string, ModulePermissionFlags>
    }>
  >(
    `${API_PATH.PROJECTS}/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}/permissions/reset`
  )
  return {
    modules: mergeAllModules(data.data?.modules),
    baselineModules: mergeAllModules(data.data?.baselineModules),
  }
}
