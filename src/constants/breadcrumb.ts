/**
 * 麵包屑：路由 path 對應的顯示名稱
 * 新增路由時請在此補上 label，麵包屑會依 path 層級自動組出
 */
export const BREADCRUMB_LABELS: Record<string, string> = {
  '/': '首頁',
  '/dashboard': '儀表板',
  '/dashboard/monitoring': '監測數據',
  '/dashboard/execution': '施工執行',
  '/monitoring': '監測',
  '/monitoring/metrics': '歷史數據',
  '/monitoring/devices': '設備',
  '/monitoring/media': '影像',
  '/monitoring/reports': '報表',
  '/monitoring/upload': '數據上傳',
  '/projects': '專案列表',
  '/layout-verify': 'Layout 驗證',
}
