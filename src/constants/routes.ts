/**
 * 路由 path / name 常數，避免 magic string
 */
export const ROUTE_PATH = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
} as const

export const ROUTE_NAME = {
  HOME: 'home',
  LOGIN: 'login',
  DASHBOARD: 'dashboard',
} as const
