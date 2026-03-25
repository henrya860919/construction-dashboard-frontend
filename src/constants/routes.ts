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

/** 手機版路徑前綴 */
export const MOBILE_PATH_PREFIX = '/mobile'

/** 組出手機版專案內路徑（/mobile/p/:projectId/...） */
export function buildMobileProjectPath(projectId: string, subPath: string): string {
  const base = `${MOBILE_PATH_PREFIX}/p/${encodeURIComponent(projectId)}`
  const path = subPath.startsWith('/') ? subPath.slice(1) : subPath
  return path ? `${base}/${path}` : base
}

export const ROUTE_PATH = {
  HOME: '/',
  LOGIN: '/login',
  /** 專案列表（獨立入口，選專案後進入 /p/:projectId/dashboard） */
  PROJECTS: '/projects',

  /** 手機版（PWA／現場查驗） */
  MOBILE: '/mobile',
  MOBILE_INSPECTION: 'inspection',
  /** 手機：已匯入樣板之查驗紀錄列表（含 FAB） */
  MOBILE_INSPECTION_TEMPLATE: 'inspection/:templateId',
  MOBILE_INSPECTION_RECORD_NEW: 'inspection/:templateId/new',
  MOBILE_INSPECTION_RECORD_DETAIL: 'inspection/:templateId/records/:recordId',
  MOBILE_DIARY: 'diary',
  MOBILE_DEFECTS: 'defects',
  MOBILE_DEFECT_NEW: 'defects/new',
  MOBILE_DEFECT_EDIT: 'defects/:defectId/edit',
  MOBILE_DEFECT_DETAIL: 'defects/:defectId',
  MOBILE_DEFECT_RECORD_NEW: 'defects/:defectId/records/new',
  MOBILE_DEFECT_RECORD_DETAIL: 'defects/:defectId/records/:recordId',
  MOBILE_PHOTO_VIEWER: 'photo-viewer',
  MOBILE_REPAIR: 'repair',
  MOBILE_REPAIR_NEW: 'repair/new',
  MOBILE_REPAIR_DETAIL: 'repair/:repairId',
  MOBILE_REPAIR_EDIT: 'repair/:repairId/edit',
  MOBILE_REPAIR_RECORD_NEW: 'repair/:repairId/records/new',
  MOBILE_REPAIR_RECORD_DETAIL: 'repair/:repairId/records/:recordId',

  /** 以下為專案內路徑「樣板」，實際連結請用 buildProjectPath(projectId, subPath) */
  PROJECT_DASHBOARD: '/dashboard',
  PROJECT_OVERVIEW_EVENTS: '/overview/events',
  PROJECT_OVERVIEW_MILESTONES: '/overview/milestones',
  /** 歷史數據（合併：歷史數據、歷史警報、影像，以 Tab 切換） */
  PROJECT_MONITORING_HISTORY: '/monitoring/history',
  PROJECT_MONITORING_DEVICES: '/monitoring/devices',
  PROJECT_MONITORING_DEVICE_DETAIL: '/monitoring/devices/:deviceId',
  PROJECT_MONITORING_REPORTS: '/monitoring/reports',
  PROJECT_MONITORING_UPLOAD: '/monitoring/upload',
  PROJECT_CONTRACT_PROJECT_INFO: '/contract/project-info',
  PROJECT_CONTRACT_SCHEDULE: '/contract/schedule',
  PROJECT_CONTRACT_MANAGEMENT: '/contract/management',
  PROJECT_MEMBERS: '/contract/members',
  PROJECT_FILES: '/files',
  PROJECT_FILES_FORMS: '/files/forms',
  PROJECT_FILES_PHOTOS: '/files/photos',
  /** 管理：WBS、資源、風險、排班、甘特、總覽 */
  PROJECT_MANAGEMENT_WBS: '/management/wbs',
  PROJECT_MANAGEMENT_RESOURCES: '/management/resources',
  PROJECT_MANAGEMENT_RISKS: '/management/risks',
  PROJECT_MANAGEMENT_SCHEDULE: '/management/schedule',
  PROJECT_MANAGEMENT_GANTT: '/management/gantt',
  PROJECT_MANAGEMENT_OVERVIEW: '/management/overview',

  /** 施工管理：自主檢查、施工日誌、缺失改善、圖說管理 */
  /** 進度管理（S-curve、計畫／實際週期） */
  PROJECT_CONSTRUCTION_PROGRESS: '/construction/progress',
  /** 進度計畫 Excel 上傳紀錄 */
  PROJECT_CONSTRUCTION_PROGRESS_UPLOADS: '/construction/progress/uploads',
  PROJECT_CONSTRUCTION_SELF_CHECK: '/construction/self-check',
  PROJECT_CONSTRUCTION_SELF_CHECK_TEMPLATE: '/construction/self-check/:templateId',
  PROJECT_CONSTRUCTION_SELF_CHECK_NEW: '/construction/self-check/:templateId/new',
  PROJECT_CONSTRUCTION_SELF_CHECK_RECORD: '/construction/self-check/:templateId/records/:recordId',
  /** 施工日誌（表四）：列表、新增、編輯 */
  PROJECT_CONSTRUCTION_DIARY: '/construction/diary',
  PROJECT_CONSTRUCTION_DIARY_LOG_NEW: '/construction/diary/new',
  PROJECT_CONSTRUCTION_DIARY_LOG_DETAIL: '/construction/diary/:logId',
  /** 估驗計價（列表、新增、編輯） */
  PROJECT_CONSTRUCTION_DIARY_VALUATIONS: '/construction/diary/valuations',
  PROJECT_CONSTRUCTION_DIARY_VALUATION_NEW: '/construction/diary/valuations/new',
  PROJECT_CONSTRUCTION_DIARY_VALUATION_DETAIL: '/construction/diary/valuations/:valuationId',
  /** PCCES XML：初次／再次匯入、匯入紀錄列表、單次匯入工項明細 */
  PROJECT_CONSTRUCTION_PCCES_UPLOAD: '/construction/diary/pcces/upload',
  /** 以指定匯入版為基底，上傳 Excel 變更清單（query: baseImportId） */
  PROJECT_CONSTRUCTION_PCCES_EXCEL_CHANGE: '/construction/diary/pcces/excel-change',
  PROJECT_CONSTRUCTION_PCCES_VERSIONS: '/construction/diary/pcces/versions',
  PROJECT_CONSTRUCTION_PCCES_VERSION_DETAIL: '/construction/diary/pcces/versions/:importId',
  PROJECT_CONSTRUCTION_DRAWINGS: '/construction/drawings',
  PROJECT_CONSTRUCTION_DEFECTS: '/construction/defects',
  PROJECT_CONSTRUCTION_DEFECT_DETAIL: '/construction/defects/:defectId',
  /** 報修管理 */
  PROJECT_REPAIR_OVERVIEW: '/repair/overview',
  PROJECT_REPAIR_RECORDS: '/repair/records',
  PROJECT_REPAIR_RECORD_NEW: '/repair/records/new',
  PROJECT_REPAIR_RECORD_DETAIL: '/repair/records/:repairId',
  /** 商品報修表 · 進階資料表 UI 範本（假資料） */
  PROJECT_REPAIR_DEMO_TABLE: '/repair/product-repair-demo',

  /** 單租後台（租戶自管） */
  ADMIN: '/admin',
  ADMIN_TENANT_INFO: '/admin/tenant-info',
  ADMIN_PROJECTS: '/admin/projects',
  ADMIN_MEMBERS: '/admin/members',
  ADMIN_FORM_TEMPLATES: '/admin/form-templates',
  ADMIN_SELF_INSPECTION_TEMPLATES: '/admin/self-inspection-templates',
  ADMIN_SELF_INSPECTION_TEMPLATE_DETAIL: '/admin/self-inspection-templates/:templateId',
  ADMIN_SETTINGS: '/admin/settings',
  /** 多租後台（平台營運） */
  PLATFORM_ADMIN: '/platform-admin',
  PLATFORM_ADMIN_TENANTS: '/platform-admin/tenants',
  /** 單一租戶管理頁（path 含 :tenantId） */
  PLATFORM_ADMIN_TENANT_MANAGE: '/platform-admin/tenants/:tenantId',
  PLATFORM_ADMIN_PROJECTS: '/platform-admin/projects',
  PLATFORM_ADMIN_USERS: '/platform-admin/users',
  PLATFORM_ADMIN_MONITORING: '/platform-admin/monitoring',
  PLATFORM_ADMIN_LOGIN_LOGS: '/platform-admin/monitoring/login-logs',
  PLATFORM_ADMIN_AUDIT_LOGS: '/platform-admin/monitoring/audit-logs',
  PLATFORM_ADMIN_USAGE: '/platform-admin/usage',
  PLATFORM_ADMIN_ANNOUNCEMENTS: '/platform-admin/announcements',
  PLATFORM_ADMIN_SETTINGS: '/platform-admin/settings',
  PLATFORM_ADMIN_SYSTEM: '/platform-admin/system',
} as const

export const ROUTE_NAME = {
  HOME: 'home',
  LOGIN: 'login',
  PROJECTS: 'projects',
  MOBILE: 'mobile',
  MOBILE_PROJECT_PICKER: 'mobile-project-picker',
  MOBILE_INSPECTION: 'mobile-inspection',
  MOBILE_INSPECTION_TEMPLATE: 'mobile-inspection-template',
  MOBILE_INSPECTION_RECORD_NEW: 'mobile-inspection-record-new',
  MOBILE_INSPECTION_RECORD_DETAIL: 'mobile-inspection-record-detail',
  MOBILE_DIARY: 'mobile-diary',
  MOBILE_DEFECTS: 'mobile-defects',
  MOBILE_DEFECT_NEW: 'mobile-defect-new',
  MOBILE_DEFECT_EDIT: 'mobile-defect-edit',
  MOBILE_DEFECT_DETAIL: 'mobile-defect-detail',
  MOBILE_DEFECT_RECORD_NEW: 'mobile-defect-record-new',
  MOBILE_DEFECT_RECORD_DETAIL: 'mobile-defect-record-detail',
  MOBILE_PHOTO_VIEWER: 'mobile-photo-viewer',
  MOBILE_REPAIR: 'mobile-repair',
  MOBILE_REPAIR_NEW: 'mobile-repair-new',
  MOBILE_REPAIR_DETAIL: 'mobile-repair-detail',
  MOBILE_REPAIR_EDIT: 'mobile-repair-edit',
  MOBILE_REPAIR_RECORD_NEW: 'mobile-repair-record-new',
  MOBILE_REPAIR_RECORD_DETAIL: 'mobile-repair-record-detail',
  PROJECT_DASHBOARD: 'project-dashboard',
  PROJECT_OVERVIEW_EVENTS: 'project-overview-events',
  PROJECT_OVERVIEW_MILESTONES: 'project-overview-milestones',
  PROJECT_MONITORING_HISTORY: 'project-monitoring-history',
  PROJECT_MONITORING_DEVICES: 'project-monitoring-devices',
  PROJECT_MONITORING_DEVICE_DETAIL: 'project-monitoring-device-detail',
  PROJECT_MONITORING_REPORTS: 'project-monitoring-reports',
  PROJECT_MONITORING_UPLOAD: 'project-monitoring-upload',
  PROJECT_CONTRACT_PROJECT_INFO: 'project-contract-project-info',
  PROJECT_CONTRACT_SCHEDULE: 'project-contract-schedule',
  PROJECT_CONTRACT_MANAGEMENT: 'project-contract-management',
  PROJECT_MEMBERS: 'project-members',
  PROJECT_FILES: 'project-files',
  PROJECT_FILES_FORMS: 'project-files-forms',
  PROJECT_FILES_PHOTOS: 'project-files-photos',
  PROJECT_MANAGEMENT_WBS: 'project-management-wbs',
  PROJECT_MANAGEMENT_RESOURCES: 'project-management-resources',
  PROJECT_MANAGEMENT_RISKS: 'project-management-risks',
  PROJECT_MANAGEMENT_SCHEDULE: 'project-management-schedule',
  PROJECT_MANAGEMENT_GANTT: 'project-management-gantt',
  PROJECT_MANAGEMENT_OVERVIEW: 'project-management-overview',
  PROJECT_CONSTRUCTION_PROGRESS: 'project-construction-progress',
  PROJECT_CONSTRUCTION_PROGRESS_UPLOADS: 'project-construction-progress-uploads',
  PROJECT_CONSTRUCTION_SELF_CHECK: 'project-construction-self-check',
  PROJECT_CONSTRUCTION_SELF_CHECK_TEMPLATE: 'project-construction-self-check-template',
  PROJECT_CONSTRUCTION_SELF_CHECK_NEW: 'project-construction-self-check-new',
  PROJECT_CONSTRUCTION_SELF_CHECK_RECORD: 'project-construction-self-check-record',
  PROJECT_CONSTRUCTION_DIARY: 'project-construction-diary',
  PROJECT_CONSTRUCTION_DIARY_LOG_NEW: 'project-construction-diary-log-new',
  PROJECT_CONSTRUCTION_DIARY_LOG_DETAIL: 'project-construction-diary-log-detail',
  PROJECT_CONSTRUCTION_DIARY_VALUATIONS: 'project-construction-diary-valuations',
  PROJECT_CONSTRUCTION_DIARY_VALUATION_NEW: 'project-construction-diary-valuation-new',
  PROJECT_CONSTRUCTION_DIARY_VALUATION_DETAIL: 'project-construction-diary-valuation-detail',
  PROJECT_CONSTRUCTION_PCCES_UPLOAD: 'project-construction-pcces-upload',
  PROJECT_CONSTRUCTION_PCCES_EXCEL_CHANGE: 'project-construction-pcces-excel-change',
  PROJECT_CONSTRUCTION_PCCES_VERSIONS: 'project-construction-pcces-versions',
  PROJECT_CONSTRUCTION_PCCES_VERSION_DETAIL: 'project-construction-pcces-version-detail',
  PROJECT_CONSTRUCTION_DRAWINGS: 'project-construction-drawings',
  PROJECT_CONSTRUCTION_DEFECTS: 'project-construction-defects',
  PROJECT_CONSTRUCTION_DEFECT_DETAIL: 'project-construction-defect-detail',
  PROJECT_REPAIR_OVERVIEW: 'project-repair-overview',
  PROJECT_REPAIR_RECORDS: 'project-repair-records',
  PROJECT_REPAIR_RECORD_NEW: 'project-repair-record-new',
  PROJECT_REPAIR_RECORD_DETAIL: 'project-repair-record-detail',
  PROJECT_REPAIR_DEMO_TABLE: 'project-repair-demo-table',
  ADMIN: 'admin',
  ADMIN_TENANT_INFO: 'admin-tenant-info',
  ADMIN_PROJECTS: 'admin-projects',
  ADMIN_MEMBERS: 'admin-members',
  ADMIN_FORM_TEMPLATES: 'admin-form-templates',
  ADMIN_SELF_INSPECTION_TEMPLATES: 'admin-self-inspection-templates',
  ADMIN_SELF_INSPECTION_TEMPLATE_DETAIL: 'admin-self-inspection-template-detail',
  ADMIN_SETTINGS: 'admin-settings',
  PLATFORM_ADMIN: 'platform-admin',
  PLATFORM_ADMIN_TENANTS: 'platform-admin-tenants',
  PLATFORM_ADMIN_TENANT_MANAGE: 'platform-admin-tenant-manage',
  PLATFORM_ADMIN_PROJECTS: 'platform-admin-projects',
  PLATFORM_ADMIN_USERS: 'platform-admin-users',
  PLATFORM_ADMIN_MONITORING: 'platform-admin-monitoring',
  PLATFORM_ADMIN_LOGIN_LOGS: 'platform-admin-login-logs',
  PLATFORM_ADMIN_AUDIT_LOGS: 'platform-admin-audit-logs',
  PLATFORM_ADMIN_USAGE: 'platform-admin-usage',
  PLATFORM_ADMIN_ANNOUNCEMENTS: 'platform-admin-announcements',
  PLATFORM_ADMIN_SETTINGS: 'platform-admin-settings',
  PLATFORM_ADMIN_SYSTEM: 'platform-admin-system',
} as const

/** 組出單一租戶管理頁 path */
export function buildTenantManagePath(tenantId: string): string {
  return `/platform-admin/tenants/${encodeURIComponent(tenantId)}`
}
