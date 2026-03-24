import { apiClient } from './client'
import { API_PATH } from '@/constants'
import type {
  ApiResponse,
  PaginatedResponse,
  TenantItem,
  CreateTenantPayload,
  UpdateTenantPayload,
  PlatformProjectItem,
  PlatformUserItem,
} from '@/types'

export type { TenantItem, CreateTenantPayload, UpdateTenantPayload, PlatformProjectItem, PlatformUserItem }

// ---------- 監控與用量 ----------

export interface MonitoringStats {
  login: { todayTotal: number; todaySuccess: number; todayFailed: number; last7DaysTotal: number; last7DaysFailed: number }
  activeUsers: { last24h: number; last7d: number }
  audit: { todayCount: number; last7DaysCount: number }
}

export async function fetchMonitoringStats(): Promise<MonitoringStats> {
  const { data } = await apiClient.get<ApiResponse<MonitoringStats>>(API_PATH.PLATFORM_MONITORING_STATS)
  return data.data
}

export interface LoginLogItem {
  id: string
  userId: string | null
  email: string
  success: boolean
  ipAddress: string | null
  userAgent: string | null
  failureReason: string | null
  createdAt: string
  user: { id: string; name: string | null; systemRole: string; tenantId: string | null } | null
}

export async function fetchLoginLogs(params?: {
  page?: number
  limit?: number
  /** 關鍵字：Email／IP／失敗原因 */
  q?: string
  success?: boolean
  from?: string
  to?: string
}) {
  const { data } = await apiClient.get<PaginatedResponse<LoginLogItem>>(API_PATH.PLATFORM_MONITORING_LOGIN_LOGS, { params })
  return { list: data.data, meta: data.meta }
}

export interface AuditLogItem {
  id: string
  userId: string | null
  action: string
  resourceType: string
  resourceId: string | null
  tenantId: string | null
  details: unknown
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user: { id: string; email: string; name: string | null } | null
}

export async function fetchAuditLogs(params?: {
  page?: number
  limit?: number
  userId?: string
  action?: string
  resourceType?: string
  tenantId?: string
  /** 關鍵字：操作者 Email／姓名、動作、資源類型、資源 ID、IP */
  search?: string
  from?: string
  to?: string
}) {
  const { data } = await apiClient.get<PaginatedResponse<AuditLogItem>>(API_PATH.PLATFORM_MONITORING_AUDIT_LOGS, { params })
  return { list: data.data, meta: data.meta }
}

export interface TenantUsageItem {
  id: string
  name: string
  slug: string | null
  status: string
  userCount: number
  projectCount: number
  storageUsageBytes: number
  userLimit: number | null
  storageQuotaMb: number | null
  expiresAt: string | null
}

export async function fetchUsage(): Promise<TenantUsageItem[]> {
  const { data } = await apiClient.get<ApiResponse<TenantUsageItem[]>>(API_PATH.PLATFORM_USAGE)
  return data.data
}

export async function fetchTenants(params?: { page?: number; limit?: number; status?: string }) {
  const { data } = await apiClient.get<PaginatedResponse<TenantItem>>(
    API_PATH.PLATFORM_TENANTS,
    { params }
  )
  return { list: data.data, meta: data.meta }
}

export async function getTenant(id: string) {
  const { data } = await apiClient.get<ApiResponse<TenantItem>>(
    `${API_PATH.PLATFORM_TENANTS}/${id}`
  )
  return data.data
}

/** 租戶模組開通：未儲存前 moduleEntitlementsGranted=false，租戶端視為未開通 */
export interface TenantModuleEntitlementsDto {
  disabledModuleIds: string[]
  moduleEntitlementsGranted: boolean
}

export async function getTenantModuleEntitlements(tenantId: string): Promise<TenantModuleEntitlementsDto> {
  const { data } = await apiClient.get<ApiResponse<TenantModuleEntitlementsDto>>(
    `${API_PATH.PLATFORM_TENANTS}/${tenantId}/module-entitlements`,
    { params: { _t: Date.now() } }
  )
  return data.data
}

export async function replaceTenantModuleEntitlements(
  tenantId: string,
  disabledModuleIds: string[]
): Promise<TenantModuleEntitlementsDto> {
  const { data } = await apiClient.put<ApiResponse<TenantModuleEntitlementsDto>>(
    `${API_PATH.PLATFORM_TENANTS}/${tenantId}/module-entitlements`,
    { disabledModuleIds }
  )
  return data.data
}

export async function createTenant(payload: CreateTenantPayload) {
  const { data } = await apiClient.post<ApiResponse<TenantItem>>(
    API_PATH.PLATFORM_TENANTS,
    payload
  )
  return data.data
}

export async function updateTenant(id: string, payload: UpdateTenantPayload) {
  const { data } = await apiClient.patch<ApiResponse<TenantItem>>(
    `${API_PATH.PLATFORM_TENANTS}/${id}`,
    payload
  )
  return data.data
}

// ---------- 專案總覽 ----------

export async function fetchPlatformProjects(params?: {
  page?: number
  limit?: number
  tenantId?: string
}) {
  const { data } = await apiClient.get<PaginatedResponse<PlatformProjectItem>>(
    API_PATH.PLATFORM_PROJECTS,
    { params }
  )
  return { list: data.data, meta: data.meta }
}

// ---------- 平台使用者（用於租戶帳號列表、重設密碼）----------

export async function fetchPlatformUsers(params?: {
  tenantId?: string
  systemRole?: string
  memberType?: string
  page?: number
  limit?: number
}) {
  const { data } = await apiClient.get<PaginatedResponse<PlatformUserItem>>(
    API_PATH.PLATFORM_USERS,
    { params }
  )
  return { list: data.data, meta: data.meta }
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const { data } = await apiClient.patch<ApiResponse<{ ok: boolean }>>(
    `${API_PATH.PLATFORM_USERS}/${userId}/password`,
    { newPassword }
  )
  return data.data
}

// ---------- 平台公告 ----------

export interface PlatformAnnouncementItem {
  id: string
  title: string
  body: string
  publishedAt: string | null
  expiresAt: string | null
  targetTenantIds: string[] | null
  createdAt: string
  updatedAt: string
}

export async function fetchPlatformAnnouncements(params?: {
  page?: number
  limit?: number
  /** 關鍵字：標題、內文 */
  q?: string
}) {
  const { data } = await apiClient.get<PaginatedResponse<PlatformAnnouncementItem>>(
    API_PATH.PLATFORM_ANNOUNCEMENTS,
    { params }
  )
  return { list: data.data, meta: data.meta }
}

export async function getPlatformAnnouncement(id: string) {
  const { data } = await apiClient.get<ApiResponse<PlatformAnnouncementItem>>(
    `${API_PATH.PLATFORM_ANNOUNCEMENTS}/${id}`
  )
  return data.data
}

export async function createPlatformAnnouncement(payload: {
  title: string
  body: string
  publishedAt?: string | null
  expiresAt?: string | null
  targetTenantIds?: string[] | null
}) {
  const { data } = await apiClient.post<ApiResponse<PlatformAnnouncementItem>>(
    API_PATH.PLATFORM_ANNOUNCEMENTS,
    payload
  )
  return data.data
}

export async function updatePlatformAnnouncement(
  id: string,
  payload: Partial<{
    title: string
    body: string
    publishedAt: string | null
    expiresAt: string | null
    targetTenantIds: string[] | null
  }>
) {
  const { data } = await apiClient.patch<ApiResponse<PlatformAnnouncementItem>>(
    `${API_PATH.PLATFORM_ANNOUNCEMENTS}/${id}`,
    payload
  )
  return data.data
}

export async function deletePlatformAnnouncement(id: string) {
  await apiClient.delete(`${API_PATH.PLATFORM_ANNOUNCEMENTS}/${id}`)
}

// ---------- 平台設定 ----------

export interface PlatformSettings {
  maintenanceMode: boolean
  defaultUserLimit: number | null
  defaultStorageQuotaMb: number | null
  defaultFileSizeLimitMb: number | null
}

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const { data } = await apiClient.get<ApiResponse<PlatformSettings>>(API_PATH.PLATFORM_SETTINGS)
  return data.data
}

export async function updatePlatformSettings(payload: Partial<PlatformSettings>) {
  const { data } = await apiClient.patch<ApiResponse<PlatformSettings>>(
    API_PATH.PLATFORM_SETTINGS,
    payload
  )
  return data.data
}

// ---------- 系統狀態 ----------

export interface SystemStatus {
  database: { status: string; latencyMs: number }
  storage: { status: string; latencyMs?: number }
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const { data } = await apiClient.get<ApiResponse<SystemStatus>>(API_PATH.PLATFORM_SYSTEM_STATUS)
  return data.data
}
