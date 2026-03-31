/**
 * Header「系統模組」與權限矩陣「系統層」對齊：`layerId` 對應 {@link PermissionSystemLayerId}。
 * 顯示與否由 {@link useSystemModuleHeaderStore} 控制（預設全顯，日後可接租戶設定／權限）。
 */
import type { PermissionSystemLayerId } from './permission-modules'

/** Lucide 圖示鍵，與 AppHeader 內 MODULE_ICONS 對齊 */
export type SystemModuleIconKey =
  | 'HardHat'
  | 'Package'
  | 'Gavel'
  | 'Handshake'
  | 'ClipboardList'
  | 'Users'
  | 'Wallet'

export interface SystemModule {
  /** 與 layerId 一致，供路由／除錯辨識 */
  key: string
  name: string
  icon: SystemModuleIconKey
  path: string
  description: string
  /** false = 即將推出，顯示但不可進入 */
  available: boolean
  /** 對應權限設定左欄系統層；Header 可依此層一併隱藏 */
  layerId: PermissionSystemLayerId
}

export interface SubModule {
  key: string
  name: string
  systemModule: string
}

/** 順序與 `permission-modules` 的 PERMISSION_SYSTEM_LAYERS 一致 */
export const SYSTEM_MODULES: SystemModule[] = [
  {
    key: 'engineering',
    name: '工程管理',
    icon: 'HardHat',
    path: '/projects',
    description: '專案、施工、合約、報修',
    available: true,
    layerId: 'engineering',
  },
  {
    key: 'procurement',
    name: '採購管理',
    icon: 'Package',
    path: '/procurement',
    description: '請購、供應商、庫存',
    available: false,
    layerId: 'procurement',
  },
  {
    key: 'bidding',
    name: '投標管理',
    icon: 'Gavel',
    path: '/bidding',
    description: '標案、投標、開標',
    available: false,
    layerId: 'bidding',
  },
  {
    key: 'customer',
    name: '客戶管理',
    icon: 'Handshake',
    path: '/customer',
    description: '客戶、聯絡、商機',
    available: false,
    layerId: 'customer',
  },
  {
    key: 'works',
    name: '工務管理',
    icon: 'ClipboardList',
    path: '/works',
    description: '工務、派工、現場事務',
    available: false,
    layerId: 'works',
  },
  {
    key: 'hr',
    name: '人資管理',
    icon: 'Users',
    path: '/hr',
    description: '組織、職位、員工',
    available: true,
    layerId: 'hr',
  },
  {
    key: 'finance',
    name: '財務管理',
    icon: 'Wallet',
    path: '/finance',
    description: '預算、帳款、報表',
    available: false,
    layerId: 'finance',
  },
]

export const SUB_MODULES: SubModule[] = [
  { key: 'project', name: '專案管理', systemModule: 'engineering' },
  { key: 'construction', name: '施工管理', systemModule: 'engineering' },
  { key: 'contract', name: '合約管理', systemModule: 'engineering' },
  { key: 'repair', name: '報修管理', systemModule: 'engineering' },
  { key: 'monitoring', name: '監測管理', systemModule: 'engineering' },
  { key: 'files', name: '檔案管理', systemModule: 'engineering' },
  { key: 'quality', name: '品質安全', systemModule: 'engineering' },
]
