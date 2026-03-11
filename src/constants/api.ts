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
  SITES: `${API_V1}/sites`,
} as const
