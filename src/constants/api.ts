/**
 * API 路徑常數，與後端對齊
 */
const API_V1 = '/api/v1'

export const API_PATH = {
  AUTH_LOGIN: `${API_V1}/auth/login`,
  AUTH_LOGOUT: `${API_V1}/auth/logout`,
  AUTH_REFRESH: `${API_V1}/auth/refresh`,
  AUTH_ME: `${API_V1}/auth/me`,
  PROJECTS: `${API_V1}/projects`,
  /** 單租後台（需 admin 角色） */
  ADMIN_PROJECTS: `${API_V1}/admin/projects`,
  ADMIN_USERS: `${API_V1}/admin/users`,
  /** 多租後台（需 platform_admin） */
  PLATFORM_TENANTS: `${API_V1}/platform-admin/tenants`,
  PLATFORM_PROJECTS: `${API_V1}/platform-admin/projects`,
  PLATFORM_USERS: `${API_V1}/platform-admin/users`,
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
} as const
