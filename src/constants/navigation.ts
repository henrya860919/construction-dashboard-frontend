/**
 * 側欄導航項目，供 AppSidebar 使用
 * 架構：專案內路徑為 /p/:projectId/...，需用 buildProjectPath(projectId, pathSuffix) 組出實際 path
 */

export interface NavItem {
  id: string
  label: string
  path: string
  icon: string
}

/** 專案內導航子項（path 為 pathSuffix，實際 path = /p/:projectId + pathSuffix） */
export interface NavItemProject {
  id: string
  label: string
  pathSuffix: string
  icon: string
}

export interface NavGroup {
  id: string
  label: string
  children: NavItem[]
}

export interface NavGroupProject {
  id: string
  label: string
  children: NavItemProject[]
}

export type SidebarEntry =
  | { type: 'item'; item: NavItem }
  | { type: 'group'; group: NavGroup }

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
    ],
  },
]

/** 非專案內（專案列表頁等）顯示的側欄項目 */
export const GLOBAL_SIDEBAR_ENTRIES: NavItem[] = [
  { id: 'projects', label: '專案列表', path: '/projects', icon: 'FolderKanban' },
]

/** 單租後台側欄（廠商管理員點「後台管理」後顯示） */
export const ADMIN_SIDEBAR_ENTRIES: NavItem[] = [
  { id: 'admin-projects', label: '專案管理', path: '/admin/projects', icon: 'FolderKanban' },
  { id: 'admin-members', label: '成員管理', path: '/admin/members', icon: 'Users' },
  { id: 'admin-settings', label: '公司設定', path: '/admin/settings', icon: 'Settings' },
]

/** 多租後台側欄（平台方登入後直接顯示） */
export const PLATFORM_ADMIN_SIDEBAR_ENTRIES: NavItem[] = [
  { id: 'platform-tenants', label: '租戶管理', path: '/platform-admin/tenants', icon: 'Building2' },
  { id: 'platform-projects', label: '專案總覽', path: '/platform-admin/projects', icon: 'FolderKanban' },
  { id: 'platform-users', label: '使用者總覽', path: '/platform-admin/users', icon: 'Users' },
]

/** @deprecated 使用 PROJECT_SIDEBAR_GROUPS + GLOBAL_SIDEBAR_ENTRIES；保留供相容 */
export const SIDEBAR_ENTRIES: SidebarEntry[] = [
  { type: 'item', item: { id: 'projects', label: '專案列表', path: '/projects', icon: 'FolderKanban' } },
]
