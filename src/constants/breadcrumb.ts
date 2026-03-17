/**
 * 麵包屑：路由 path 對應的顯示名稱
 * 專案內路徑（/p/:projectId/...）的「後綴」對應見 BREADCRUMB_PROJECT_SUFFIX_LABELS
 */
export const BREADCRUMB_LABELS: Record<string, string> = {
  '/': '首頁',
  '/projects': '專案列表',
  '/admin': '後台',
  '/admin/tenant-info': '租戶資訊',
  '/admin/projects': '專案管理',
  '/admin/members': '成員管理',
  '/admin/form-templates': '表單樣板',
  '/admin/settings': '公司設定',
  '/platform-admin': '平台管理',
  '/platform-admin/tenants': '租戶管理',
  '/platform-admin/projects': '專案總覽',
  '/platform-admin/users': '使用者總覽',
  '/platform-admin/monitoring': '監控儀表板',
  '/platform-admin/monitoring/login-logs': '登入紀錄',
  '/platform-admin/monitoring/audit-logs': '稽核日誌',
  '/platform-admin/usage': '用量總覽',
  '/platform-admin/announcements': '平台公告',
  '/platform-admin/settings': '平台設定',
  '/platform-admin/system': '系統狀態',
}

/** 專案內路徑後綴（/p/:projectId 之後）對應的麵包屑名稱 */
export const BREADCRUMB_PROJECT_SUFFIX_LABELS: Record<string, string> = {
  '/dashboard': '儀表板',
  '/overview/events': '大事記',
  '/overview/milestones': '里程碑',
  '/monitoring/history': '歷史數據',
  '/monitoring/devices': '設備',
  '/monitoring/reports': '報表',
  '/monitoring/upload': '數據上傳',
  '/contract/project-info': '專案資訊',
  '/contract/schedule': '工期調整',
  '/contract/management': '契約管理',
  '/contract/members': '專案成員',
  '/files': '檔案管理',
  '/files/forms': '相關表單',
  '/files/photos': '照片管理',
  '/management/wbs': 'WBS清單',
  '/management/resources': '資源庫',
  '/management/risks': '風險與議題',
  '/management/schedule': '排班表',
  '/management/gantt': '甘特圖',
  '/management/overview': '總覽',
}
