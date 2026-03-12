/**
 * 路由 path / name 常數，避免 magic string
 * 架構：專案內工作區採用 A 方案 — URL 帶 projectId（/p/:projectId/...）
 */

/** 專案內路徑前綴（router 用） */
export const PROJECT_PATH_PREFIX = '/p/:projectId'

/** 組出專案內路徑（用於 RouterLink、router.push、API 脈絡等） */
export function buildProjectPath(projectId: string, subPath: string): string {
  const base = `/p/${encodeURIComponent(projectId)}`
  const path = subPath.startsWith('/') ? subPath : `/${subPath}`
  return path === '/' ? base : `${base}${path}`
}

export const ROUTE_PATH = {
  HOME: '/',
  LOGIN: '/login',
  /** 專案列表（獨立入口，選專案後進入 /p/:projectId/dashboard） */
  PROJECTS: '/projects',

  /** 以下為專案內路徑「樣板」，實際連結請用 buildProjectPath(projectId, subPath) */
  PROJECT_DASHBOARD: '/dashboard',
  PROJECT_OVERVIEW_EVENTS: '/overview/events',
  PROJECT_OVERVIEW_MILESTONES: '/overview/milestones',
  PROJECT_MONITORING_METRICS: '/monitoring/metrics',
  PROJECT_MONITORING_DEVICES: '/monitoring/devices',
  PROJECT_MONITORING_DEVICE_DETAIL: '/monitoring/devices/:deviceId',
  PROJECT_MONITORING_MEDIA: '/monitoring/media',
  PROJECT_MONITORING_REPORTS: '/monitoring/reports',
  PROJECT_MONITORING_UPLOAD: '/monitoring/upload',
  PROJECT_CONTRACT_PROJECT_INFO: '/contract/project-info',
  PROJECT_CONTRACT_SCHEDULE: '/contract/schedule',
  PROJECT_CONTRACT_MANAGEMENT: '/contract/management',

  /** 單租後台（租戶自管） */
  ADMIN: '/admin',
  ADMIN_TENANT_INFO: '/admin/tenant-info',
  ADMIN_PROJECTS: '/admin/projects',
  ADMIN_MEMBERS: '/admin/members',
  ADMIN_SETTINGS: '/admin/settings',
  /** 多租後台（平台營運） */
  PLATFORM_ADMIN: '/platform-admin',
  PLATFORM_ADMIN_TENANTS: '/platform-admin/tenants',
  /** 單一租戶管理頁（path 含 :tenantId） */
  PLATFORM_ADMIN_TENANT_MANAGE: '/platform-admin/tenants/:tenantId',
  PLATFORM_ADMIN_PROJECTS: '/platform-admin/projects',
  PLATFORM_ADMIN_USERS: '/platform-admin/users',
  /** 非專案內（全域） */
} as const

export const ROUTE_NAME = {
  HOME: 'home',
  LOGIN: 'login',
  PROJECTS: 'projects',
  PROJECT_DASHBOARD: 'project-dashboard',
  PROJECT_OVERVIEW_EVENTS: 'project-overview-events',
  PROJECT_OVERVIEW_MILESTONES: 'project-overview-milestones',
  PROJECT_MONITORING_METRICS: 'project-monitoring-metrics',
  PROJECT_MONITORING_DEVICES: 'project-monitoring-devices',
  PROJECT_MONITORING_DEVICE_DETAIL: 'project-monitoring-device-detail',
  PROJECT_MONITORING_MEDIA: 'project-monitoring-media',
  PROJECT_MONITORING_REPORTS: 'project-monitoring-reports',
  PROJECT_MONITORING_UPLOAD: 'project-monitoring-upload',
  PROJECT_CONTRACT_PROJECT_INFO: 'project-contract-project-info',
  PROJECT_CONTRACT_SCHEDULE: 'project-contract-schedule',
  PROJECT_CONTRACT_MANAGEMENT: 'project-contract-management',
  ADMIN: 'admin',
  ADMIN_TENANT_INFO: 'admin-tenant-info',
  ADMIN_PROJECTS: 'admin-projects',
  ADMIN_MEMBERS: 'admin-members',
  ADMIN_SETTINGS: 'admin-settings',
  PLATFORM_ADMIN: 'platform-admin',
  PLATFORM_ADMIN_TENANTS: 'platform-admin-tenants',
  PLATFORM_ADMIN_TENANT_MANAGE: 'platform-admin-tenant-manage',
  PLATFORM_ADMIN_PROJECTS: 'platform-admin-projects',
  PLATFORM_ADMIN_USERS: 'platform-admin-users',
} as const

/** 組出單一租戶管理頁 path */
export function buildTenantManagePath(tenantId: string): string {
  return `/platform-admin/tenants/${encodeURIComponent(tenantId)}`
}
