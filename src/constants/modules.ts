/** 四大系統（Header、之後側欄第一層）；icon 為 lucide-vue-next 元件名稱，見 AppHeader MODULE_ICONS */

export interface SystemModule {
  key: string
  name: string
  /** Lucide 圖示鍵，與 AppHeader 內 MODULE_ICONS 對齊 */
  icon: 'HardHat' | 'Package' | 'Users' | 'Wallet'
  path: string
  description: string
  /** false = 即將推出，顯示但不可進入 */
  available: boolean
}

export interface SubModule {
  key: string
  name: string
  systemModule: string
}

export const SYSTEM_MODULES: SystemModule[] = [
  {
    key: 'engineering',
    name: '工程管理',
    icon: 'HardHat',
    path: '/projects',
    description: '專案、施工、合約、報修',
    available: true,
  },
  {
    key: 'procurement',
    name: '採購管理',
    icon: 'Package',
    path: '/procurement',
    description: '請購、供應商、庫存',
    available: false,
  },
  {
    key: 'hr',
    name: '人資管理',
    icon: 'Users',
    path: '/hr',
    description: '組織、職位、員工',
    available: true,
  },
  {
    key: 'finance',
    name: '財務管理',
    icon: 'Wallet',
    path: '/finance',
    description: '預算、帳款、報表',
    available: false,
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
