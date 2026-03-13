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
  /** 當前使用者所屬租戶品牌（名稱、是否有 Logo），供 header 顯示 */
  AUTH_TENANT_BRANDING: `${API_V1}/auth/me/tenant-branding`,
  /** 當前使用者所屬租戶 Logo 圖片 */
  AUTH_TENANT_LOGO: `${API_V1}/auth/me/tenant-logo`,
  PROJECTS: `${API_V1}/projects`,
  /** 單租後台（需 admin 角色） */
  ADMIN_PROJECTS: `${API_V1}/admin/projects`,
  ADMIN_USERS: `${API_V1}/admin/users`,
  ADMIN_TENANT_INFO: `${API_V1}/admin/tenant-info`,
  /** 公司設定：PATCH 名稱、POST logo、GET logo 用 /admin/tenant-logo */
  ADMIN_COMPANY_SETTINGS: `${API_V1}/admin/company-settings`,
  ADMIN_TENANT_LOGO: `${API_V1}/admin/tenant-logo`,
  ADMIN_FORM_TEMPLATES: `${API_V1}/admin/form-templates`,
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
} as const
