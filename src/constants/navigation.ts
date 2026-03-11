/**
 * 側欄導航項目，供 AppSidebar 使用
 */
export interface NavItem {
  id: string
  label: string
  path: string
  /** lucide 圖示名稱，與元件對應 */
  icon: string
}

/** 側欄分組：僅顯示 group 標題 + 子項目，不手風琴展開 */
export interface NavGroup {
  id: string
  label: string
  children: NavItem[]
}

export type SidebarEntry =
  | { type: 'item'; item: NavItem }
  | { type: 'group'; group: NavGroup }

export const SIDEBAR_ENTRIES: SidebarEntry[] = [
  { type: 'item', item: { id: 'home', label: '首頁', path: '/', icon: 'LayoutDashboard' } },
  { type: 'item', item: { id: 'dashboard', label: '儀表板', path: '/dashboard', icon: 'LayoutGrid' } },
  {
    type: 'group',
    group: {
      id: 'monitoring',
      label: '監測',
      children: [
        { id: 'monitoring-metrics', label: '歷史數據', path: '/monitoring/metrics', icon: 'Activity' },
        { id: 'monitoring-upload', label: '數據上傳', path: '/monitoring/upload', icon: 'Upload' },
        { id: 'monitoring-devices', label: '設備', path: '/monitoring/devices', icon: 'Cpu' },
        { id: 'monitoring-media', label: '影像', path: '/monitoring/media', icon: 'Image' },
        { id: 'monitoring-reports', label: '報表', path: '/monitoring/reports', icon: 'FileText' },
      ],
    },
  },
  { type: 'item', item: { id: 'projects', label: '專案列表', path: '/projects', icon: 'FolderKanban' } },
  { type: 'item', item: { id: 'layout-verify', label: 'Layout 驗證', path: '/layout-verify', icon: 'ClipboardCheck' } },
  { type: 'item', item: { id: 'data-table-demo', label: 'DataTable 展示', path: '/data-table-demo', icon: 'Table2' } },
]

/** @deprecated 使用 SIDEBAR_ENTRIES；保留供尚未改為 group 的程式參考 */
export const SIDEBAR_NAV_ITEMS: NavItem[] = SIDEBAR_ENTRIES.flatMap((e) =>
  e.type === 'item' ? [e.item] : e.group.children
)
