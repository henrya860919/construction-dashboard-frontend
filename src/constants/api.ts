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
} as const
