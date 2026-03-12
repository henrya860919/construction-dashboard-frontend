import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 平台管理員進入單租後台時所選的租戶 ID。
 * tenant_admin 不需要（用 JWT 的 tenantId）；platform_admin 必選後才進 /admin。
 */
export const useAdminStore = defineStore('admin', () => {
  const selectedTenantId = ref<string | null>(null)

  function setSelectedTenantId(tenantId: string) {
    selectedTenantId.value = tenantId
  }

  function clearSelectedTenantId() {
    selectedTenantId.value = null
  }

  return {
    selectedTenantId,
    setSelectedTenantId,
    clearSelectedTenantId,
  }
})
