/**
 * 路由 path / name 常數，避免 magic string
 */
export const ROUTE_PATH = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  DASHBOARD_MONITORING: '/dashboard/monitoring',
  DASHBOARD_EXECUTION: '/dashboard/execution',
  /** 監測：歷史數據 */
  MONITORING_METRICS: '/monitoring/metrics',
  /** 監測：設備管理 */
  MONITORING_DEVICES: '/monitoring/devices',
  /** 監測：設備詳情（含 :deviceId） */
  MONITORING_DEVICE_DETAIL: '/monitoring/devices/:deviceId',
  /** 監測：影像 */
  MONITORING_MEDIA: '/monitoring/media',
  /** 監測：報表 */
  MONITORING_REPORTS: '/monitoring/reports',
  /** 監測：數據上傳（Excel 樣板下載與上傳） */
  MONITORING_UPLOAD: '/monitoring/upload',
  PROJECTS: '/projects',
  /** 驗證用測試頁（Layout / 導航 / 區塊） */
  LAYOUT_VERIFY: '/layout-verify',
  /** DataTable 功能展示頁 */
  DATA_TABLE_DEMO: '/data-table-demo',
} as const

export const ROUTE_NAME = {
  HOME: 'home',
  LOGIN: 'login',
  DASHBOARD: 'dashboard',
  DASHBOARD_MONITORING: 'dashboard-monitoring',
  DASHBOARD_EXECUTION: 'dashboard-execution',
  MONITORING_METRICS: 'monitoring-metrics',
  MONITORING_DEVICES: 'monitoring-devices',
  MONITORING_DEVICE_DETAIL: 'monitoring-device-detail',
  MONITORING_MEDIA: 'monitoring-media',
  MONITORING_REPORTS: 'monitoring-reports',
  MONITORING_UPLOAD: 'monitoring-upload',
  PROJECTS: 'projects',
  LAYOUT_VERIFY: 'layout-verify',
  DATA_TABLE_DEMO: 'data-table-demo',
} as const
