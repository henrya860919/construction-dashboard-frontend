import { ref, watch, onUnmounted, type Ref } from 'vue'
import { getTenantLogoBlob } from '@/api/admin'

/**
 * 取得公司 Logo 的 object URL（需登入，GET /admin/tenant-logo）。
 * hasLogo 為 true 時才請求；unmount 時自動 revoke。
 */
export function useTenantLogoUrl(hasLogo: Ref<boolean>) {
  const objectUrl = ref<string | null>(null)
  const loading = ref(false)
  const error = ref(false)

  function revoke() {
    if (objectUrl.value) {
      URL.revokeObjectURL(objectUrl.value)
      objectUrl.value = null
    }
  }

  async function load() {
    if (!hasLogo.value) {
      revoke()
      return
    }
    loading.value = true
    error.value = false
    revoke()
    try {
      const blob = await getTenantLogoBlob()
      objectUrl.value = URL.createObjectURL(blob)
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  watch(hasLogo, (val) => {
    if (val) load()
    else revoke()
  }, { immediate: true })

  onUnmounted(revoke)

  return { objectUrl, loading, error, reload: load }
}
