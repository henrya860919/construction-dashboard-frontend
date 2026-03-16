/**
 * 側欄導航項目，供 AppSidebar 使用
 * 架構：專案內路徑為 /p/:projectId/...，需用 buildProjectPath(projectId, pathSuffix) 組出實際 path
 */

import type {
  NavItem,
  NavItemProject,
  NavGroup,
  NavGroupProject,
  SidebarEntry,
} from '@/types/navigation'

export type { NavItem, NavItemProject, NavGroup, NavGroupProject, SidebarEntry }

/** 專案內側欄：概況、監測、契約（path 用 pathSuffix，由 AppSidebar 搭配 projectId 組出） */
export const PROJECT_SIDEBAR_GROUPS: NavGroupProject[] = [
  {
    id: 'overview',
    label: '概況',
    children: [
      { id: 'dashboard', label: '儀表板', pathSuffix: '/dashboard', icon: 'LayoutGrid' },
      { id: 'overview-events', label: '大事記', pathSuffix: '/overview/events', icon: 'CalendarClock' },
      { id: 'overview-milestones', label: '里程碑', pathSuffix: '/overview/milestones', icon: 'Flag' },
    ],
  },
  {
    id: 'monitoring',
    label: '監測',
    children: [
      { id: 'monitoring-metrics', label: '歷史數據', pathSuffix: '/monitoring/metrics', icon: 'Activity' },
      { id: 'monitoring-alerts', label: '歷史警報', pathSuffix: '/monitoring/alerts', icon: 'AlertTriangle' },
      { id: 'monitoring-upload', label: '數據上傳', pathSuffix: '/monitoring/upload', icon: 'Upload' },
      { id: 'monitoring-devices', label: '設備', pathSuffix: '/monitoring/devices', icon: 'Cpu' },
      { id: 'monitoring-media', label: '影像', pathSuffix: '/monitoring/media', icon: 'Image' },
      { id: 'monitoring-reports', label: '報表', pathSuffix: '/monitoring/reports', icon: 'FileText' },
    ],
  },
  {
    id: 'contract',
    label: '契約',
    children: [
      { id: 'contract-project-info', label: '專案資訊', pathSuffix: '/contract/project-info', icon: 'ClipboardList' },
      { id: 'contract-schedule', label: '工期調整', pathSuffix: '/contract/schedule', icon: 'CalendarRange' },
      { id: 'contract-management', label: '契約管理', pathSuffix: '/contract/management', icon: 'FileSignature' },
      { id: 'project-members', label: '專案成員', pathSuffix: '/contract/members', icon: 'Users' },
    ],
  },
  {
    id: 'files',
    label: '檔案',
    children: [
      { id: 'files-management', label: '檔案管理', pathSuffix: '/files', icon: 'FolderOpen' },
      { id: 'files-forms', label: '相關表單', pathSuffix: '/files/forms', icon: 'FileText' },
      { id: 'files-photos', label: '照片管理', pathSuffix: '/files/photos', icon: 'Image' },
    ],
  },
]

/** 非專案內（專案列表頁等）顯示的側欄項目；非平台方登入時顯示專案列表 */
export const GLOBAL_SIDEBAR_ENTRIES: NavItem[] = [
  { id: 'projects', label: '專案列表', path: '/projects', icon: 'FolderKanban' },
]

/** 單租後台側欄（廠商管理員點「後台管理」後顯示） */
export const ADMIN_SIDEBAR_ENTRIES: NavItem[] = [
  { id: 'admin-tenant-info', label: '租戶資訊', path: '/admin/tenant-info', icon: 'Info' },
  { id: 'admin-projects', label: '專案管理', path: '/admin/projects', icon: 'FolderKanban' },
  { id: 'admin-members', label: '成員管理', path: '/admin/members', icon: 'Users' },
  { id: 'admin-form-templates', label: '表單樣板', path: '/admin/form-templates', icon: 'FileText' },
  { id: 'admin-settings', label: '公司設定', path: '/admin/settings', icon: 'Settings' },
]

/** 多租後台側欄（平台方登入後直接顯示）— 扁平列表，供未分組時使用 */
export const PLATFORM_ADMIN_SIDEBAR_ENTRIES: NavItem[] = [
  { id: 'platform-tenants', label: '租戶管理', path: '/platform-admin/tenants', icon: 'Building2' },
  { id: 'platform-projects', label: '專案總覽', path: '/platform-admin/projects', icon: 'FolderKanban' },
  { id: 'platform-users', label: '使用者總覽', path: '/platform-admin/users', icon: 'Users' },
  { id: 'platform-monitoring', label: '監控儀表板', path: '/platform-admin/monitoring', icon: 'Activity' },
  { id: 'platform-login-logs', label: '登入紀錄', path: '/platform-admin/monitoring/login-logs', icon: 'LogIn' },
  { id: 'platform-audit-logs', label: '稽核日誌', path: '/platform-admin/monitoring/audit-logs', icon: 'FileText' },
  { id: 'platform-usage', label: '用量總覽', path: '/platform-admin/usage', icon: 'BarChart3' },
  { id: 'platform-announcements', label: '平台公告', path: '/platform-admin/announcements', icon: 'Megaphone' },
  { id: 'platform-settings', label: '平台設定', path: '/platform-admin/settings', icon: 'Settings' },
  { id: 'platform-system', label: '系統狀態', path: '/platform-admin/system', icon: 'Server' },
]

/** 多租後台側欄群組（文件 §7.9 建議）：租戶與組織、監控、營運、系統 */
export const PLATFORM_ADMIN_SIDEBAR_GROUPS: NavGroup[] = [
  {
    id: 'org',
    label: '租戶與組織',
    children: [
      { id: 'platform-tenants', label: '租戶管理', path: '/platform-admin/tenants', icon: 'Building2' },
      { id: 'platform-projects', label: '專案總覽', path: '/platform-admin/projects', icon: 'FolderKanban' },
      { id: 'platform-users', label: '使用者總覽', path: '/platform-admin/users', icon: 'Users' },
    ],
  },
  {
    id: 'monitoring',
    label: '監控',
    children: [
      { id: 'platform-monitoring', label: '監控儀表板', path: '/platform-admin/monitoring', icon: 'Activity' },
      { id: 'platform-login-logs', label: '登入紀錄', path: '/platform-admin/monitoring/login-logs', icon: 'LogIn' },
      { id: 'platform-audit-logs', label: '稽核日誌', path: '/platform-admin/monitoring/audit-logs', icon: 'FileText' },
    ],
  },
  {
    id: 'ops',
    label: '營運',
    children: [
      { id: 'platform-usage', label: '用量總覽', path: '/platform-admin/usage', icon: 'BarChart3' },
      { id: 'platform-announcements', label: '平台公告', path: '/platform-admin/announcements', icon: 'Megaphone' },
    ],
  },
  {
    id: 'system',
    label: '系統',
    children: [
      { id: 'platform-settings', label: '平台設定', path: '/platform-admin/settings', icon: 'Settings' },
      { id: 'platform-system', label: '系統狀態', path: '/platform-admin/system', icon: 'Server' },
    ],
  },
]

/** @deprecated 使用 PROJECT_SIDEBAR_GROUPS + GLOBAL_SIDEBAR_ENTRIES；保留供相容 */
export const SIDEBAR_ENTRIES: SidebarEntry[] = [
  { type: 'item', item: { id: 'projects', label: '專案列表', path: '/projects', icon: 'FolderKanban' } },
]
