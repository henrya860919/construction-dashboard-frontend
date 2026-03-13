import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getTenantBranding } from '@/api/admin'

/**
 * 當前使用者所屬租戶的品牌（公司名稱、是否有 Logo），供 header 顯示。
 * 登入後有 tenantId 時呼叫 fetch() 取得；登出時呼叫 clear()。
 */
export const useTenantBrandingStore = defineStore('tenantBranding', () => {
  const name = ref<string | null>(null)
  const hasLogo = ref(false)
  const loaded = ref(false)

  async function fetch() {
    try {
      const data = await getTenantBranding()
      name.value = data.name
      hasLogo.value = data.hasLogo
      loaded.value = true
    } catch {
      name.value = null
      hasLogo.value = false
      loaded.value = true
    }
  }

  function clear() {
    name.value = null
    hasLogo.value = false
    loaded.value = false
  }

  return {
    name,
    hasLogo,
    loaded,
    fetch,
    clear,
  }
})
