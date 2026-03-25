/**
 * 與後端 `src/constants/permission-modules.ts` 對齊（專案內 RBAC 模組 id）
 */
export const PERMISSION_MODULES = [
  'project.overview',
  'project.members',
  'project.wbs',
  'project.gantt',
  'project.resource',
  'project.schedule',
  'project.risk',
  'project.duration',
  'project.drawings',
  'construction.monitor',
  'construction.upload',
  'construction.equipment',
  'construction.inspection',
  'construction.diary',
  'construction.pcces',
  'construction.valuation',
  'construction.progress',
  'construction.defect',
  'construction.photo',
  'repair.overview',
  'repair.record',
] as const

export type PermissionModuleId = (typeof PERMISSION_MODULES)[number]

/** 平台尚未儲存開通時視為全部關閉；已開通時僅關閉列於 disabledModuleIds 者 */
export function effectivePlatformDisabledModuleIds(
  moduleEntitlementsGranted: boolean,
  disabledModuleIds: string[]
): PermissionModuleId[] {
  if (!moduleEntitlementsGranted) {
    return [...PERMISSION_MODULES]
  }
  return disabledModuleIds.filter((id): id is PermissionModuleId =>
    (PERMISSION_MODULES as readonly string[]).includes(id)
  )
}

/** 是否可新增專案／編輯成員權限（與後端 assert 一致） */
export function tenantModuleGateAllowsOperations(
  moduleEntitlementsGranted: boolean,
  disabledModuleIds: string[]
): boolean {
  if (!moduleEntitlementsGranted) return false
  return disabledModuleIds.length < PERMISSION_MODULES.length
}

/** 權限矩陣勾選器中不可變更的欄位（仍顯示目前值）；專案成員僅以「讀取」控制側欄／可見性，成員 CRUD 另依後端規則 */
export type PermissionMatrixFlagKey = 'canCreate' | 'canRead' | 'canUpdate' | 'canDelete'

export const PERMISSION_MATRIX_UI_DISABLED: Partial<
  Record<PermissionModuleId, Partial<Record<PermissionMatrixFlagKey, true>>>
> = {
  'project.members': { canCreate: true, canUpdate: true, canDelete: true },
}

export type PermissionAction = 'create' | 'read' | 'update' | 'delete'

/** 專案內 pathSuffix（如 `/dashboard`）→ 以 read 判斷側欄是否顯示 */
export const NAV_PATH_PERMISSION_MODULE: Record<string, PermissionModuleId> = {
  '/dashboard': 'project.overview',
  '/contract/project-info': 'project.overview',
  '/contract/management': 'project.overview',
  '/contract/members': 'project.members',
  '/files': 'construction.upload',
  '/files/forms': 'construction.upload',
  '/files/photos': 'construction.photo',
  '/overview/events': 'project.overview',
  '/overview/milestones': 'project.overview',
  '/management/overview': 'project.overview',
  '/management/wbs': 'project.wbs',
  '/management/gantt': 'project.gantt',
  '/management/resources': 'project.resource',
  '/management/schedule': 'project.schedule',
  '/management/risks': 'project.risk',
  '/contract/schedule': 'project.duration',
  '/monitoring/history': 'construction.monitor',
  /** 與 router redirect 路徑一致，便於書籤／守衛解析 */
  '/monitoring/metrics': 'construction.monitor',
  '/monitoring/alerts': 'construction.monitor',
  '/monitoring/media': 'construction.monitor',
  '/monitoring/upload': 'construction.upload',
  '/monitoring/devices': 'construction.equipment',
  '/monitoring/reports': 'construction.monitor',
  '/construction/self-check': 'construction.inspection',
  '/construction/progress': 'construction.progress',
  /** 已 redirect 至 /construction/progress?tab=history，保留鍵供書籤／守衛解析 */
  '/construction/progress/uploads': 'construction.progress',
  '/construction/diary': 'construction.diary',
  '/construction/diary/new': 'construction.diary',
  '/construction/diary/pcces/upload': 'construction.pcces',
  '/construction/diary/pcces/versions': 'construction.pcces',
  '/construction/defects': 'construction.defect',
  '/construction/drawings': 'project.drawings',
  '/repair/overview': 'repair.overview',
  '/repair/records': 'repair.record',
  '/repair/records/new': 'repair.record',
}

export function permissionModuleForProjectPath(pathSuffix: string): PermissionModuleId {
  const key = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`
  return NAV_PATH_PERMISSION_MODULE[key] ?? 'project.overview'
}

/** 從完整網址路徑（含 `/p/:projectId`）取得用於權限比對的 pathSuffix */
export function navPathSuffixFromFullPath(fullPath: string): string {
  const m = fullPath.match(/^\/p\/[^/]+(\/.*)?$/)
  let suffix = m?.[1] ?? '/dashboard'
  if (!suffix || suffix === '') suffix = '/dashboard'
  return suffix
}

/**
 * 子路徑（如設備詳情）向上尋找最接近的側欄路徑鍵，再對應模組
 */
export function resolvePermissionPathSuffix(fullPath: string): string {
  let p = navPathSuffixFromFullPath(fullPath)
  for (;;) {
    if (NAV_PATH_PERMISSION_MODULE[p]) return p
    if (!p.includes('/')) break
    const idx = p.lastIndexOf('/')
    p = idx <= 0 ? '/dashboard' : p.slice(0, idx)
  }
  return '/dashboard'
}

/** 矩陣／文件顯示用 */
export const PERMISSION_MODULE_LABELS: Record<PermissionModuleId, string> = {
  'project.overview': '專案總覽、契約',
  'project.members': '專案成員',
  'project.wbs': 'WBS 清單',
  'project.gantt': '甘特圖',
  'project.resource': '資源庫',
  'project.schedule': '排班表',
  'project.risk': '風險與議題',
  'project.duration': '工期調整',
  'project.drawings': '圖說管理',
  'construction.monitor': '監測數據／報表／警報',
  'construction.upload': '數據上傳、檔案／表單',
  'construction.equipment': '設備／攝影機',
  'construction.inspection': '自主檢查',
  'construction.diary': '施工日誌',
  'construction.pcces': 'PCCES 工項匯入',
  'construction.valuation': '估驗計價',
  'construction.progress': '進度管理',
  'construction.defect': '缺失改善',
  'construction.photo': '照片管理',
  'repair.overview': '報修總覽',
  'repair.record': '報修紀錄',
}

export const PERMISSION_PRESET_OPTIONS = [
  { value: 'owner_viewer' as const, label: '業主檢視（僅讀）' },
  { value: 'project_engineer' as const, label: '專案工程師（全模組）' },
  { value: 'site_supervisor' as const, label: '工地主任（讀＋檢查／缺失／日誌／PCCES／照片）' },
  { value: 'equipment_manager' as const, label: '設備管理（設備與報修）' },
]
