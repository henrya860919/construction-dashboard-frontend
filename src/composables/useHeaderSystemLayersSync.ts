import { onMounted, onUnmounted, watch } from 'vue'
import { fetchMyHeaderSystemLayers } from '@/api/project-permissions'
import { useAuthStore } from '@/stores/auth'
import { useSystemModuleHeaderStore } from '@/stores/systemModuleHeader'

/**
 * 登入後依後台儲存之「頂部系統層顯示」同步 {@link useSystemModuleHeaderStore}。
 * 僅 platform_admin 固定全部顯示；tenant_admin／project_user 呼叫 API 套用該成員範本。
 */
export function useHeaderSystemLayersSync() {
  const auth = useAuthStore()
  const headerStore = useSystemModuleHeaderStore()

  async function loadAndApply() {
    if (!auth.isAuthenticated || !auth.user?.id) return
    if (auth.user.systemRole === 'platform_admin') return
    try {
      const map = await fetchMyHeaderSystemLayers()
      headerStore.applyServerHeaderLayersVisibility(map)
    } catch (err) {
      console.warn('[headerSystemLayers] 無法載入頂部系統列設定', err)
    }
  }

  watch(
    () =>
      [
        auth.isAuthenticated,
        auth.user?.id,
        auth.user?.systemRole,
        auth.user?.tenantId,
      ] as const,
    async ([authed, userId, role]) => {
      if (!authed || !userId) {
        headerStore.resetHeaderLayerVisibility()
        return
      }
      if (role === 'platform_admin') {
        headerStore.resetHeaderLayerVisibility()
        return
      }
      await loadAndApply()
    },
    { immediate: true }
  )

  /** 後台儲存範本後，使用者切回分頁即可更新，無需重登 */
  function onVisibilityChange() {
    if (document.visibilityState !== 'visible') return
    void loadAndApply()
  }

  onMounted(() => document.addEventListener('visibilitychange', onVisibilityChange))
  onUnmounted(() => document.removeEventListener('visibilitychange', onVisibilityChange))
}
