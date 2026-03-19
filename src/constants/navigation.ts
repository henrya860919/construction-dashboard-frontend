/**
 * 側欄導航項目，供 AppSidebar 使用
 * 架構：專案內路徑為 /p/:projectId/...，需用 buildProjectPath(projectId, pathSuffix) 組出實際 path
 * 翻頁式：Layer 1（主畫面）→ Layer 2（專案內第一層）→ Layer 3-A/B/C（專案管理/施工管理/報修管理）
 */

import type {
  NavItem,
  NavItemProject,
  NavGroup,
  NavGroupProject,
  SidebarEntry,
  NavLayer2Item,
  SidebarPanelId,
} from '@/types/navigation'

export type {
  NavItem,
  NavItemProject,
  NavGroup,
  NavGroupProject,
  SidebarEntry,
  NavLayer2Item,
  SidebarPanelId,
}

/** Layer 1：未進專案時顯示（專案列表、後台管理由 AppSidebar 依權限動態加入） */
export const LAYER1_ENTRIES: NavItem[] = [
  { id: 'projects', label: '專案列表', path: '/projects', icon: 'FolderKanban' },
]

/** Layer 2：專案內第一層（契約、專案基本資料、儀表板、檔案、相關表單；工作執行群組置底） */
export const LAYER2_ITEMS: NavLayer2Item[] = [
  { type: 'link', id: 'dashboard', label: '儀表板', pathSuffix: '/dashboard', icon: 'LayoutGrid' },
  {
    type: 'link',
    id: 'project-info',
    label: '專案資料',
    pathSuffix: '/contract/project-info',
    icon: 'ClipboardList',
  },
  {
    type: 'link',
    id: 'contract-management',
    label: '契約管理',
    pathSuffix: '/contract/management',
    icon: 'FileSignature',
  },
  { type: 'link', id: 'files', label: '檔案管理', pathSuffix: '/files', icon: 'FolderOpen' },
  {
    type: 'link',
    id: 'files-forms',
    label: '相關表單',
    pathSuffix: '/files/forms',
    icon: 'FileText',
  },
  { type: 'group', label: '工作執行' },
  {
    type: 'drill',
    id: 'project-mgmt',
    label: '專案管理',
    panelId: 'project-mgmt',
    icon: 'ListTree',
  },
  {
    type: 'drill',
    id: 'construction',
    label: '施工管理',
    panelId: 'construction',
    icon: 'HardHat',
  },
  { type: 'drill', id: 'repair', label: '報修管理', panelId: 'repair', icon: 'Wrench' },
]

/** Layer 3-A：專案管理（總覽、WBS、甘特、資源、排班、風險、工期調整） */
export const LAYER3_PROJECT_MGMT: NavItemProject[] = [
  {
    id: 'management-overview',
    label: '總覽',
    pathSuffix: '/management/overview',
    icon: 'LayoutDashboard',
  },
  { id: 'management-wbs', label: 'WBS清單', pathSuffix: '/management/wbs', icon: 'ListTree' },
  { id: 'management-gantt', label: '甘特圖', pathSuffix: '/management/gantt', icon: 'ChartGantt' },
  {
    id: 'management-resources',
    label: '資源庫',
    pathSuffix: '/management/resources',
    icon: 'Library',
  },
  {
    id: 'management-schedule',
    label: '排班表',
    pathSuffix: '/management/schedule',
    icon: 'CalendarDays',
  },
  {
    id: 'management-risks',
    label: '風險與議題',
    pathSuffix: '/management/risks',
    icon: 'AlertTriangle',
  },
  {
    id: 'contract-schedule',
    label: '工期調整',
    pathSuffix: '/contract/schedule',
    icon: 'CalendarRange',
  },
]

/** Layer 3-B：施工管理（監測、上傳、設備、自主檢查、施工日誌、缺失改善、圖說管理、報表、照片） */
export const LAYER3_CONSTRUCTION: NavItemProject[] = [
  {
    id: 'monitoring-history',
    label: '監測數據',
    pathSuffix: '/monitoring/history',
    icon: 'Activity',
  },
  { id: 'monitoring-upload', label: '數據上傳', pathSuffix: '/monitoring/upload', icon: 'Upload' },
  { id: 'monitoring-devices', label: '設備管理', pathSuffix: '/monitoring/devices', icon: 'Cpu' },
  {
    id: 'construction-self-check',
    label: '自主檢查',
    pathSuffix: '/construction/self-check',
    icon: 'ClipboardCheck',
  },
  {
    id: 'construction-diary',
    label: '施工日誌',
    pathSuffix: '/construction/diary',
    icon: 'BookOpen',
  },
  {
    id: 'construction-defects',
    label: '缺失改善',
    pathSuffix: '/construction/defects',
    icon: 'AlertCircle',
  },
  {
    id: 'construction-drawings',
    label: '圖說管理',
    pathSuffix: '/construction/drawings',
    icon: 'DraftingCompass',
  },
  { id: 'monitoring-reports', label: '報表', pathSuffix: '/monitoring/reports', icon: 'FileText' },
  { id: 'files-photos', label: '照片管理', pathSuffix: '/files/photos', icon: 'Image' },
]

/** Layer 3-C：報修管理（總覽、報修紀錄表） */
export const LAYER3_REPAIR: NavItemProject[] = [
  { id: 'repair-overview', label: '總覽', pathSuffix: '/repair/overview', icon: 'LayoutDashboard' },
  { id: 'repair-records', label: '報修紀錄表', pathSuffix: '/repair/records', icon: 'FileText' },
]

/** 專案內側欄：概況、監測、契約（path 用 pathSuffix，由 AppSidebar 搭配 projectId 組出） */
export const PROJECT_SIDEBAR_GROUPS: NavGroupProject[] = [
  {
    id: 'overview',
    label: '概況',
    children: [
      { id: 'dashboard', label: '儀表板', pathSuffix: '/dashboard', icon: 'LayoutGrid' },
      {
        id: 'overview-events',
        label: '大事記',
        pathSuffix: '/overview/events',
        icon: 'CalendarClock',
      },
      {
        id: 'overview-milestones',
        label: '里程碑',
        pathSuffix: '/overview/milestones',
        icon: 'Flag',
      },
    ],
  },
  {
    id: 'monitoring',
    label: '監測',
    children: [
      {
        id: 'monitoring-history',
        label: '歷史數據',
        pathSuffix: '/monitoring/history',
        icon: 'Activity',
      },
      {
        id: 'monitoring-upload',
        label: '數據上傳',
        pathSuffix: '/monitoring/upload',
        icon: 'Upload',
      },
      { id: 'monitoring-devices', label: '設備', pathSuffix: '/monitoring/devices', icon: 'Cpu' },
      {
        id: 'monitoring-reports',
        label: '報表',
        pathSuffix: '/monitoring/reports',
        icon: 'FileText',
      },
    ],
  },
  {
    id: 'contract',
    label: '契約',
    children: [
      {
        id: 'contract-project-info',
        label: '專案資訊',
        pathSuffix: '/contract/project-info',
        icon: 'ClipboardList',
      },
      {
        id: 'contract-schedule',
        label: '工期調整',
        pathSuffix: '/contract/schedule',
        icon: 'CalendarRange',
      },
      {
        id: 'contract-management',
        label: '契約管理',
        pathSuffix: '/contract/management',
        icon: 'FileSignature',
      },
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
  {
    id: 'management',
    label: '管理',
    children: [
      { id: 'management-wbs', label: 'WBS清單', pathSuffix: '/management/wbs', icon: 'ListTree' },
      {
        id: 'management-resources',
        label: '資源庫',
        pathSuffix: '/management/resources',
        icon: 'Library',
      },
      {
        id: 'management-risks',
        label: '風險與議題',
        pathSuffix: '/management/risks',
        icon: 'AlertTriangle',
      },
      {
        id: 'management-schedule',
        label: '排班表',
        pathSuffix: '/management/schedule',
        icon: 'CalendarDays',
      },
      {
        id: 'management-gantt',
        label: '甘特圖',
        pathSuffix: '/management/gantt',
        icon: 'ChartGantt',
      },
      {
        id: 'management-overview',
        label: '總覽',
        pathSuffix: '/management/overview',
        icon: 'LayoutDashboard',
      },
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
  {
    id: 'admin-form-templates',
    label: '表單樣板',
    path: '/admin/form-templates',
    icon: 'FileText',
  },
  {
    id: 'admin-self-inspection-templates',
    label: '自主檢查樣板',
    path: '/admin/self-inspection-templates',
    icon: 'ClipboardCheck',
  },
  { id: 'admin-settings', label: '公司設定', path: '/admin/settings', icon: 'Settings' },
]

/** 多租後台側欄（平台方登入後直接顯示）— 扁平列表，供未分組時使用 */
export const PLATFORM_ADMIN_SIDEBAR_ENTRIES: NavItem[] = [
  { id: 'platform-tenants', label: '租戶管理', path: '/platform-admin/tenants', icon: 'Building2' },
  {
    id: 'platform-projects',
    label: '專案總覽',
    path: '/platform-admin/projects',
    icon: 'FolderKanban',
  },
  { id: 'platform-users', label: '使用者總覽', path: '/platform-admin/users', icon: 'Users' },
  {
    id: 'platform-monitoring',
    label: '監控儀表板',
    path: '/platform-admin/monitoring',
    icon: 'Activity',
  },
  {
    id: 'platform-login-logs',
    label: '登入紀錄',
    path: '/platform-admin/monitoring/login-logs',
    icon: 'LogIn',
  },
  {
    id: 'platform-audit-logs',
    label: '稽核日誌',
    path: '/platform-admin/monitoring/audit-logs',
    icon: 'FileText',
  },
  { id: 'platform-usage', label: '用量總覽', path: '/platform-admin/usage', icon: 'BarChart3' },
  {
    id: 'platform-announcements',
    label: '平台公告',
    path: '/platform-admin/announcements',
    icon: 'Megaphone',
  },
  {
    id: 'platform-settings',
    label: '平台設定',
    path: '/platform-admin/settings',
    icon: 'Settings',
  },
  { id: 'platform-system', label: '系統狀態', path: '/platform-admin/system', icon: 'Server' },
]

/** 多租後台側欄群組（文件 §7.9 建議）：租戶與組織、監控、營運、系統 */
export const PLATFORM_ADMIN_SIDEBAR_GROUPS: NavGroup[] = [
  {
    id: 'org',
    label: '租戶與組織',
    children: [
      {
        id: 'platform-tenants',
        label: '租戶管理',
        path: '/platform-admin/tenants',
        icon: 'Building2',
      },
      {
        id: 'platform-projects',
        label: '專案總覽',
        path: '/platform-admin/projects',
        icon: 'FolderKanban',
      },
      { id: 'platform-users', label: '使用者總覽', path: '/platform-admin/users', icon: 'Users' },
    ],
  },
  {
    id: 'monitoring',
    label: '監控',
    children: [
      {
        id: 'platform-monitoring',
        label: '監控儀表板',
        path: '/platform-admin/monitoring',
        icon: 'Activity',
      },
      {
        id: 'platform-login-logs',
        label: '登入紀錄',
        path: '/platform-admin/monitoring/login-logs',
        icon: 'LogIn',
      },
      {
        id: 'platform-audit-logs',
        label: '稽核日誌',
        path: '/platform-admin/monitoring/audit-logs',
        icon: 'FileText',
      },
    ],
  },
  {
    id: 'ops',
    label: '營運',
    children: [
      { id: 'platform-usage', label: '用量總覽', path: '/platform-admin/usage', icon: 'BarChart3' },
      {
        id: 'platform-announcements',
        label: '平台公告',
        path: '/platform-admin/announcements',
        icon: 'Megaphone',
      },
    ],
  },
  {
    id: 'system',
    label: '系統',
    children: [
      {
        id: 'platform-settings',
        label: '平台設定',
        path: '/platform-admin/settings',
        icon: 'Settings',
      },
      { id: 'platform-system', label: '系統狀態', path: '/platform-admin/system', icon: 'Server' },
    ],
  },
]

/** @deprecated 使用 PROJECT_SIDEBAR_GROUPS + GLOBAL_SIDEBAR_ENTRIES；保留供相容 */
export const SIDEBAR_ENTRIES: SidebarEntry[] = [
  {
    type: 'item',
    item: { id: 'projects', label: '專案列表', path: '/projects', icon: 'FolderKanban' },
  },
]
