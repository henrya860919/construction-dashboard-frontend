/**
 * API 路徑常數，與後端對齊
 */
const API_V1 = '/api/v1'

export const API_PATH = {
  AUTH_LOGIN: `${API_V1}/auth/login`,
  AUTH_LOGOUT: `${API_V1}/auth/logout`,
  AUTH_REFRESH: `${API_V1}/auth/refresh`,
  AUTH_ME: `${API_V1}/auth/me`,
  AUTH_CHANGE_PASSWORD: `${API_V1}/auth/me/password`,
  /** 個人頭貼：POST 上傳、GET 取得圖片 */
  AUTH_ME_AVATAR: `${API_V1}/auth/me/avatar`,
  /** 當前使用者所屬租戶品牌（名稱、是否有 Logo），供 header 顯示 */
  AUTH_TENANT_BRANDING: `${API_V1}/auth/me/tenant-branding`,
  /** 當前使用者所屬租戶 Logo 圖片 */
  AUTH_TENANT_LOGO: `${API_V1}/auth/me/tenant-logo`,
  PROJECTS: `${API_V1}/projects`,
  /** 單租後台（需 admin 角色） */
  ADMIN_PROJECTS: `${API_V1}/admin/projects`,
  ADMIN_USERS: `${API_V1}/admin/users`,
  ADMIN_TENANT_INFO: `${API_V1}/admin/tenant-info`,
  /** 本租戶模組開通狀態（唯讀）；platform_admin 須帶 query tenantId */
  ADMIN_TENANT_MODULE_ENTITLEMENTS: `${API_V1}/admin/tenant/module-entitlements`,
  /** 公司設定：PATCH 名稱、POST logo、GET logo 用 /admin/tenant-logo */
  ADMIN_COMPANY_SETTINGS: `${API_V1}/admin/company-settings`,
  ADMIN_TENANT_LOGO: `${API_V1}/admin/tenant-logo`,
  ADMIN_FORM_TEMPLATES: `${API_V1}/admin/form-templates`,
  ADMIN_SELF_INSPECTION_TEMPLATES: `${API_V1}/admin/self-inspection-templates`,
  ADMIN_SELF_INSPECTION_TEMPLATE: (id: string) => `${API_V1}/admin/self-inspection-templates/${id}`,
  ADMIN_SELF_INSPECTION_TEMPLATE_BLOCKS: (templateId: string) =>
    `${API_V1}/admin/self-inspection-templates/${templateId}/blocks`,
  ADMIN_SELF_INSPECTION_TEMPLATE_BLOCK: (templateId: string, blockId: string) =>
    `${API_V1}/admin/self-inspection-templates/${templateId}/blocks/${blockId}`,
  ADMIN_SELF_INSPECTION_TEMPLATE_BLOCK_ITEMS: (templateId: string, blockId: string) =>
    `${API_V1}/admin/self-inspection-templates/${templateId}/blocks/${blockId}/items`,
  ADMIN_SELF_INSPECTION_TEMPLATE_BLOCK_ITEM: (
    templateId: string,
    blockId: string,
    itemId: string
  ) =>
    `${API_V1}/admin/self-inspection-templates/${templateId}/blocks/${blockId}/items/${itemId}`,
  /** 專案表單樣板（GET 列表、POST 新增） */
  PROJECT_FORM_TEMPLATES: (projectId: string) => `${API_V1}/projects/${projectId}/form-templates`,
  /** 單一表單樣板（GET 下載、PATCH、DELETE） */
  FORM_TEMPLATE: (id: string) => `${API_V1}/form-templates/${id}`,
  /** 多租後台（需 platform_admin） */
  PLATFORM_TENANTS: `${API_V1}/platform-admin/tenants`,
  PLATFORM_PROJECTS: `${API_V1}/platform-admin/projects`,
  PLATFORM_USERS: `${API_V1}/platform-admin/users`,
  PLATFORM_MONITORING_STATS: `${API_V1}/platform-admin/monitoring/stats`,
  PLATFORM_MONITORING_LOGIN_LOGS: `${API_V1}/platform-admin/monitoring/login-logs`,
  PLATFORM_MONITORING_AUDIT_LOGS: `${API_V1}/platform-admin/monitoring/audit-logs`,
  PLATFORM_USAGE: `${API_V1}/platform-admin/usage`,
  PLATFORM_ANNOUNCEMENTS: `${API_V1}/platform-admin/announcements`,
  PLATFORM_SETTINGS: `${API_V1}/platform-admin/settings`,
  PLATFORM_SYSTEM_STATUS: `${API_V1}/platform-admin/system/status`,
  ANNOUNCEMENTS_ACTIVE: `${API_V1}/announcements/active`,
  SITES: `${API_V1}/sites`,
  /** 監測：下載 Excel 樣板（GET，回傳檔案） */
  MONITORING_TEMPLATE: `${API_V1}/monitoring/template`,
  /** 監測：上傳 Excel 填寫資料（POST multipart/form-data） */
  MONITORING_UPLOAD: `${API_V1}/monitoring/upload`,
  /** 檔案：傳統上傳（POST multipart: file, projectId, category?） */
  FILES_UPLOAD: `${API_V1}/files/upload`,
  /** 檔案：取得／下載（GET，?download=true 下載） */
  FILES_GET: (id: string) => `${API_V1}/files/${id}`,
  /** 檔案：刪除 */
  FILES_DELETE: (id: string) => `${API_V1}/files/${id}`,
  /** 專案附件列表（GET，query: page, limit, category?） */
  PROJECT_FILES: (projectId: string) => `${API_V1}/projects/${projectId}/files`,
  /** 專案相簿（照片管理） */
  PROJECT_ALBUMS: (projectId: string) => `${API_V1}/projects/${projectId}/albums`,
  PROJECT_ALBUM_PHOTOS: (projectId: string, albumId: string) =>
    `${API_V1}/projects/${projectId}/albums/${albumId}/photos`,
  /** 我的最愛（個人） */
  PROJECT_PHOTO_FAVORITES: (projectId: string) => `${API_V1}/projects/${projectId}/photo-favorites`,
  /** 攝影機（CCTV / go2rtc） */
  PROJECT_CAMERAS: (projectId: string) => `${API_V1}/projects/${projectId}/cameras`,
  /** 專案層級一鍵安裝包（zip，含本專案所有攝影機），query os=win|mac */
  PROJECT_CAMERAS_INSTALL_PACKAGE: (projectId: string, os: 'win' | 'mac') =>
    `${API_V1}/projects/${projectId}/cameras/install-package?os=${os}`,
  PROJECT_CAMERA: (projectId: string, cameraId: string) =>
    `${API_V1}/projects/${projectId}/cameras/${cameraId}`,
  /** 手動標示為離線／清除標示 */
  PROJECT_CAMERA_CONNECTION_STATUS_OVERRIDE: (projectId: string, cameraId: string) =>
    `${API_V1}/projects/${projectId}/cameras/${cameraId}/connection-status-override`,
  PROJECT_CAMERA_PLAY_URL: (projectId: string, cameraId: string) =>
    `${API_V1}/projects/${projectId}/cameras/${cameraId}/play-url`,
  PROJECT_CAMERA_INSTALL_CONFIG: (projectId: string, cameraId: string) =>
    `${API_V1}/projects/${projectId}/cameras/${cameraId}/install-config`,
  PROJECT_CAMERA_INSTALL_CONFIG_DOWNLOAD: (projectId: string, cameraId: string) =>
    `${API_V1}/projects/${projectId}/cameras/${cameraId}/install-config/download`,
  /** 單一攝影機一鍵安裝包（zip），query os=win|mac */
  PROJECT_CAMERA_INSTALL_PACKAGE: (projectId: string, cameraId: string, os: 'win' | 'mac') =>
    `${API_V1}/projects/${projectId}/cameras/${cameraId}/install-package?os=${os}`,
  PROJECT_CAMERA_INSTALL: (projectId: string, cameraId: string) =>
    `${API_V1}/projects/${projectId}/cameras/${cameraId}/install`,
  /** 專案成員（列表、可加入名單、新增、移除） */
  PROJECT_MEMBERS: (projectId: string) => `${API_V1}/projects/${projectId}/members`,
  PROJECT_MEMBERS_AVAILABLE: (projectId: string) => `${API_V1}/projects/${projectId}/members/available`,
  /** 圖說管理（樹狀分類／圖說項） */
  PROJECT_DRAWING_NODES: (projectId: string) => `${API_V1}/projects/${projectId}/drawing-nodes`,
  PROJECT_DRAWING_NODE: (projectId: string, nodeId: string) =>
    `${API_V1}/projects/${projectId}/drawing-nodes/${nodeId}`,
  PROJECT_DRAWING_NODE_MOVE: (projectId: string, nodeId: string) =>
    `${API_V1}/projects/${projectId}/drawing-nodes/${nodeId}/move`,
  PROJECT_DRAWING_NODE_REVISIONS: (projectId: string, nodeId: string) =>
    `${API_V1}/projects/${projectId}/drawing-nodes/${nodeId}/revisions`,
  /** PCCES／eTender XML 匯入 */
  PROJECT_PCCES_IMPORTS: (projectId: string) => `${API_V1}/projects/${projectId}/pcces-imports`,
  PROJECT_PCCES_IMPORT: (projectId: string, importId: string) =>
    `${API_V1}/projects/${projectId}/pcces-imports/${importId}`,
  PROJECT_PCCES_IMPORT_ITEMS: (projectId: string, importId: string) =>
    `${API_V1}/projects/${projectId}/pcces-imports/${importId}/items`,
  PROJECT_PCCES_IMPORT_APPROVE: (projectId: string, importId: string) =>
    `${API_V1}/projects/${projectId}/pcces-imports/${importId}/approve`,
  PROJECT_PCCES_IMPORT_EXCEL_APPLY: (projectId: string, importId: string) =>
    `${API_V1}/projects/${projectId}/pcces-imports/${importId}/excel-apply`,
  /** PCCES Excel 變更用工程變更清單樣板（construction_project_change_list.xlsx） */
  PROJECT_PCCES_IMPORTS_CONSTRUCTION_PROJECT_CHANGE_LIST_EXCEL_TEMPLATE: (projectId: string) =>
    `${API_V1}/projects/${projectId}/pcces-imports/construction-project-change-list-excel-template`,

  /** 公共工程施工日誌（依附表四） */
  PROJECT_CONSTRUCTION_DAILY_LOGS: (projectId: string) =>
    `${API_V1}/projects/${projectId}/construction-daily-logs`,
  PROJECT_CONSTRUCTION_DAILY_LOG_DEFAULTS: (projectId: string) =>
    `${API_V1}/projects/${projectId}/construction-daily-logs/defaults`,
  PROJECT_CONSTRUCTION_DAILY_LOG_PROGRESS_PLAN_KNOTS: (projectId: string) =>
    `${API_V1}/projects/${projectId}/construction-daily-logs/progress-plan-knots`,
  PROJECT_CONSTRUCTION_DAILY_LOG_PCCES_WORK_ITEMS: (projectId: string) =>
    `${API_V1}/projects/${projectId}/construction-daily-logs/pcces-work-items`,
  PROJECT_CONSTRUCTION_DAILY_LOG_PREVIEW_PCCES_ACTUAL: (projectId: string) =>
    `${API_V1}/projects/${projectId}/construction-daily-logs/preview-pcces-actual-progress`,
  PROJECT_CONSTRUCTION_DAILY_LOG: (projectId: string, logId: string) =>
    `${API_V1}/projects/${projectId}/construction-daily-logs/${logId}`,
  /** 估驗計價 */
  PROJECT_CONSTRUCTION_VALUATIONS: (projectId: string) =>
    `${API_V1}/projects/${projectId}/construction-valuations`,
  PROJECT_CONSTRUCTION_VALUATION_PCCES_LINES: (projectId: string) =>
    `${API_V1}/projects/${projectId}/construction-valuations/pcces-lines`,
  PROJECT_CONSTRUCTION_VALUATION: (projectId: string, valuationId: string) =>
    `${API_V1}/projects/${projectId}/construction-valuations/${valuationId}`,
  /** 進度管理 */
  PROJECT_PROGRESS_DASHBOARD: (projectId: string) =>
    `${API_V1}/projects/${projectId}/progress/dashboard`,
  PROJECT_PROGRESS_PLANS: (projectId: string) => `${API_V1}/projects/${projectId}/progress/plans`,
  PROJECT_PROGRESS_PLAN: (projectId: string, planId: string) =>
    `${API_V1}/projects/${projectId}/progress/plans/${planId}`,
  PROJECT_PROGRESS_PLAN_WITH_UPLOAD: (projectId: string) =>
    `${API_V1}/projects/${projectId}/progress/plans/with-upload`,
  PROJECT_PROGRESS_PLAN_UPLOADS: (projectId: string) =>
    `${API_V1}/projects/${projectId}/progress/plan-uploads`,
  PROJECT_PROGRESS_PLAN_UPLOADS_EXCEL_TEMPLATE: (projectId: string) =>
    `${API_V1}/projects/${projectId}/progress/plan-uploads/excel-template`,
  PROJECT_PROGRESS_PLAN_DUPLICATE: (projectId: string) =>
    `${API_V1}/projects/${projectId}/progress/plans/duplicate`,
  PROJECT_PROGRESS_PLAN_ENTRIES: (projectId: string, planId: string) =>
    `${API_V1}/projects/${projectId}/progress/plans/${planId}/entries`,
  PROJECT_PROGRESS_PLAN_EFFECTIVE: (projectId: string, planId: string) =>
    `${API_V1}/projects/${projectId}/progress/plans/${planId}/effective`,
  PROJECT_PROGRESS_ACTUALS: (projectId: string) =>
    `${API_V1}/projects/${projectId}/progress/actuals`,
  /** WBS 工作分解結構（樹狀） */
  PROJECT_WBS: (projectId: string) => `${API_V1}/projects/${projectId}/wbs`,
  PROJECT_WBS_NODE: (projectId: string, nodeId: string) => `${API_V1}/projects/${projectId}/wbs/${nodeId}`,
  PROJECT_WBS_NODE_MOVE: (projectId: string, nodeId: string) =>
    `${API_V1}/projects/${projectId}/wbs/${nodeId}/move`,
  /** 議題風險表（列表、新增、編輯、刪除） */
  PROJECT_ISSUE_RISKS: (projectId: string) => `${API_V1}/projects/${projectId}/issue-risks`,
  PROJECT_ISSUE_RISK: (projectId: string, id: string) =>
    `${API_V1}/projects/${projectId}/issue-risks/${id}`,
  /** 資源庫（人力、機具、材料），query type=labor|equipment|material */
  PROJECT_RESOURCES: (projectId: string) => `${API_V1}/projects/${projectId}/resources`,
  PROJECT_RESOURCE: (projectId: string, id: string) =>
    `${API_V1}/projects/${projectId}/resources/${id}`,
  /** 缺失改善（手機／現場：列表、詳情、執行紀錄） */
  PROJECT_DEFECT_IMPROVEMENTS: (projectId: string) =>
    `${API_V1}/projects/${projectId}/defect-improvements`,
  PROJECT_DEFECT_IMPROVEMENT: (projectId: string, defectId: string) =>
    `${API_V1}/projects/${projectId}/defect-improvements/${defectId}`,
  PROJECT_DEFECT_IMPROVEMENT_RECORDS: (projectId: string, defectId: string) =>
    `${API_V1}/projects/${projectId}/defect-improvements/${defectId}/records`,
  PROJECT_DEFECT_IMPROVEMENT_RECORD: (projectId: string, defectId: string, recordId: string) =>
    `${API_V1}/projects/${projectId}/defect-improvements/${defectId}/records/${recordId}`,
  /** 報修（手機／現場） */
  PROJECT_REPAIR_REQUESTS: (projectId: string) =>
    `${API_V1}/projects/${projectId}/repair-requests`,
  PROJECT_REPAIR_REQUEST: (projectId: string, repairId: string) =>
    `${API_V1}/projects/${projectId}/repair-requests/${repairId}`,
  PROJECT_REPAIR_REQUEST_RECORDS: (projectId: string, repairId: string) =>
    `${API_V1}/projects/${projectId}/repair-requests/${repairId}/records`,
  PROJECT_REPAIR_REQUEST_RECORD: (projectId: string, repairId: string, recordId: string) =>
    `${API_V1}/projects/${projectId}/repair-requests/${repairId}/records/${recordId}`,
  /** 自主查驗（專案內：樣板、紀錄） */
  PROJECT_SELF_INSPECTIONS: (projectId: string) =>
    `${API_V1}/projects/${projectId}/self-inspections`,
  PROJECT_SELF_INSPECTION_TEMPLATES_AVAILABLE: (projectId: string) =>
    `${API_V1}/projects/${projectId}/self-inspections/templates/available`,
  PROJECT_SELF_INSPECTION_TEMPLATES_IMPORT_CATALOG: (projectId: string) =>
    `${API_V1}/projects/${projectId}/self-inspections/templates/import-catalog`,
  PROJECT_SELF_INSPECTION_TEMPLATE: (projectId: string, templateId: string) =>
    `${API_V1}/projects/${projectId}/self-inspections/templates/${templateId}`,
  PROJECT_SELF_INSPECTION_RECORDS: (projectId: string, templateId: string) =>
    `${API_V1}/projects/${projectId}/self-inspections/templates/${templateId}/records`,
  PROJECT_SELF_INSPECTION_RECORD: (projectId: string, templateId: string, recordId: string) =>
    `${API_V1}/projects/${projectId}/self-inspections/templates/${templateId}/records/${recordId}`,
  /** 即時警報（目前假資料；之後接 CWA） */
  ALERTS_CURRENT: `${API_V1}/alerts/current`,
  /** 歷史警報（query: projectId?, startDate, endDate, limit?） */
  ALERTS_HISTORY: `${API_V1}/alerts/history`,
} as const
