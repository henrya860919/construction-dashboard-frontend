import { BREADCRUMB_LABELS } from '@/constants/breadcrumb'
import { SYSTEM_MODULES } from '@/constants/modules'
import { ROUTE_PATH } from '@/constants/routes'

/** 麵包屑最上層「系統層」（與頂部系統模組／後台範圍一致） */
export interface BreadcrumbSystemLayer {
  label: string
  to: string
}

/**
 * 依目前 path 決定麵包屑第一層：平台管理、租戶後台、採購／人資／財務（預留路徑）、預設工程管理。
 */
export function getBreadcrumbSystemLayer(path: string): BreadcrumbSystemLayer {
  if (path.startsWith('/platform-admin')) {
    return {
      label: BREADCRUMB_LABELS['/platform-admin'] ?? '平台管理',
      to: ROUTE_PATH.PLATFORM_ADMIN_TENANTS,
    }
  }
  if (path.startsWith('/admin')) {
    return {
      label: BREADCRUMB_LABELS['/admin'] ?? '後台',
      to: ROUTE_PATH.ADMIN_PROJECTS,
    }
  }

  const finance = SYSTEM_MODULES.find((m) => m.key === 'finance')!
  if (path === ROUTE_PATH.FINANCE || path.startsWith(`${ROUTE_PATH.FINANCE}/`)) {
    return { label: finance.name, to: ROUTE_PATH.FINANCE }
  }
  const hr = SYSTEM_MODULES.find((m) => m.key === 'hr')!
  if (path === ROUTE_PATH.HR || path.startsWith(`${ROUTE_PATH.HR}/`)) {
    return { label: hr.name, to: ROUTE_PATH.HR }
  }
  const procurement = SYSTEM_MODULES.find((m) => m.key === 'procurement')!
  if (path === ROUTE_PATH.PROCUREMENT || path.startsWith(`${ROUTE_PATH.PROCUREMENT}/`)) {
    return { label: procurement.name, to: ROUTE_PATH.PROCUREMENT }
  }

  const engineering = SYSTEM_MODULES.find((m) => m.key === 'engineering')!
  return {
    label: engineering.name,
    to: ROUTE_PATH.PORTAL,
  }
}
