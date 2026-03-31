import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { SYSTEM_MODULES, type SystemModule } from '@/constants/modules'
import type { PermissionSystemLayerId } from '@/constants/permission-modules'

/**
 * Header「系統模組」是否顯示（以**系統層**為單位）。
 * - 預設：全部顯示。
 * - `setLayerVisibleInHeader(id, false)` 可隱藏該層對應的 Header 項目。
 * - 日後可於登入後依租戶設定或使用者對該層代表模組的 read 權限呼叫 {@link setHeaderLayersVisibility}。
 */
export const useSystemModuleHeaderStore = defineStore('systemModuleHeader', () => {
  /** 僅存「覆寫」；鍵不存在或 true = 顯示；明確 false = 隱藏 */
  const layerVisibleOverride = ref<Partial<Record<PermissionSystemLayerId, boolean>>>({})

  function isLayerVisibleInHeader(layerId: PermissionSystemLayerId): boolean {
    return layerVisibleOverride.value[layerId] !== false
  }

  const visibleSystemModules = computed((): SystemModule[] =>
    SYSTEM_MODULES.filter((m) => isLayerVisibleInHeader(m.layerId))
  )

  function setLayerVisibleInHeader(layerId: PermissionSystemLayerId, visible: boolean) {
    layerVisibleOverride.value = {
      ...layerVisibleOverride.value,
      [layerId]: visible,
    }
  }

  /** 批次合併；未列出的層仍依預設（顯示） */
  function setHeaderLayersVisibility(map: Partial<Record<PermissionSystemLayerId, boolean>>) {
    layerVisibleOverride.value = { ...layerVisibleOverride.value, ...map }
  }

  /**
   * 登入後自 API 載入：以伺服器回傳的完整對照**整批取代**（避免舊狀態與合併殘留）。
   */
  function applyServerHeaderLayersVisibility(map: Record<PermissionSystemLayerId, boolean>) {
    layerVisibleOverride.value = { ...map }
  }

  function resetHeaderLayerVisibility() {
    layerVisibleOverride.value = {}
  }

  return {
    layerVisibleOverride,
    isLayerVisibleInHeader,
    visibleSystemModules,
    setLayerVisibleInHeader,
    setHeaderLayersVisibility,
    applyServerHeaderLayersVisibility,
    resetHeaderLayerVisibility,
  }
})
