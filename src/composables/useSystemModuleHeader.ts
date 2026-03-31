import { storeToRefs } from 'pinia'
import { useSystemModuleHeaderStore } from '@/stores/systemModuleHeader'
import type { PermissionSystemLayerId } from '@/constants/permission-modules'

/**
 * Header 系統模組顯示設定（依系統層）。
 * 日後可在登入／切換租戶後依 API 或專案權限呼叫 `setHeaderLayersVisibility`。
 */
export function useSystemModuleHeader() {
  const store = useSystemModuleHeaderStore()
  const { layerVisibleOverride, visibleSystemModules } = storeToRefs(store)

  /** 依各層代表模組是否可 read 等方式產生 map 後套用 */
  function applyLayerReadGates(gates: Partial<Record<PermissionSystemLayerId, boolean>>) {
    store.setHeaderLayersVisibility(gates)
  }

  return {
    layerVisibleOverride,
    visibleSystemModules,
    isLayerVisibleInHeader: store.isLayerVisibleInHeader,
    setLayerVisibleInHeader: store.setLayerVisibleInHeader,
    setHeaderLayersVisibility: store.setHeaderLayersVisibility,
    resetHeaderLayerVisibility: store.resetHeaderLayerVisibility,
    applyLayerReadGates,
  }
}
