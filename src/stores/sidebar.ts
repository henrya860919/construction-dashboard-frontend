import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SidebarPanelId } from '@/types/navigation'

export type SidebarPanelValue = 'root' | SidebarPanelId

export const useSidebarStore = defineStore('sidebar', () => {
  /** 桌面：側欄是否收合（只顯示 icon） */
  const collapsed = ref(false)
  /** 手機：側欄 Sheet 是否開啟 */
  const mobileOpen = ref(false)

  /** 翻頁式 Sidebar：當前顯示的 panel（root = Layer 2，project-mgmt/construction/repair = Layer 3） */
  const currentPanel = ref<SidebarPanelValue>('root')
  /**  drill 歷史，用於「← 主畫面」返回 */
  const panelHistory = ref<SidebarPanelValue[]>([])

  function toggleCollapsed() {
    collapsed.value = !collapsed.value
  }

  function toggleMobileOpen() {
    mobileOpen.value = !mobileOpen.value
  }

  function setMobileOpen(open: boolean) {
    mobileOpen.value = open
  }

  function drillIn(panelId: SidebarPanelId) {
    panelHistory.value.push(currentPanel.value)
    currentPanel.value = panelId
  }

  function drillOut() {
    const prev = panelHistory.value.pop()
    if (prev !== undefined) {
      currentPanel.value = prev
    }
  }

  /** 依 route path 還原 panel（重整／深連結時讓 sidebar 停在正確層級） */
  function setPanelFromRoute(path: string) {
    if (!path.startsWith('/p/')) {
      currentPanel.value = 'root'
      panelHistory.value = []
      return
    }
    const rest = path.replace(/^\/p\/[^/]+/, '') || '/'
    if (rest.startsWith('/management/') || rest.startsWith('/contract/schedule')) {
      currentPanel.value = 'project-mgmt'
      panelHistory.value = ['root']
    } else if (
      rest.startsWith('/monitoring/') ||
      rest.startsWith('/construction/') ||
      rest === '/files/photos'
    ) {
      currentPanel.value = 'construction'
      panelHistory.value = ['root']
    } else if (rest.startsWith('/repair/')) {
      currentPanel.value = 'repair'
      panelHistory.value = ['root']
    } else {
      currentPanel.value = 'root'
      panelHistory.value = []
    }
  }

  function resetPanel() {
    currentPanel.value = 'root'
    panelHistory.value = []
  }

  return {
    collapsed,
    mobileOpen,
    currentPanel,
    panelHistory,
    toggleCollapsed,
    toggleMobileOpen,
    setMobileOpen,
    drillIn,
    drillOut,
    setPanelFromRoute,
    resetPanel,
  }
})
