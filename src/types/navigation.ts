/**
 * 側欄導航結構（供 AppSidebar、constants/navigation 使用）
 * 專案內路徑為 /p/:projectId/...，需用 buildProjectPath(projectId, pathSuffix) 組出實際 path
 * 翻頁式 Sidebar：Layer 1 → Layer 2（專案內）→ Layer 3-A/B/C（專案管理 / 施工管理 / 報修管理）
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

/** 翻頁式 Sidebar：可 drill 進入的 panel（Layer 3） */
export type SidebarPanelId = 'project-mgmt' | 'construction' | 'repair'

/** Layer 2 項目：直接連結、群組標籤、或 drill 進 Layer 3 */
export type NavLayer2Item =
  | { type: 'link'; id: string; label: string; pathSuffix: string; icon: string }
  | { type: 'group'; label: string }
  | { type: 'drill'; id: string; label: string; panelId: SidebarPanelId; icon: string }
