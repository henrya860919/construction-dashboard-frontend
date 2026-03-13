import { ref, watch, onUnmounted, type Ref } from 'vue'
import { getFileBlob } from '@/api/files'

/**
 * 取得需認證的圖片 URL（用於 img src）。
 * 透過 API 取得 blob 後建立 object URL，unmount 時自動 revoke。
 */
export function useAuthImageUrl(fileId: string | undefined | Ref<string | undefined>) {
  const getter = () => (typeof fileId === 'object' && fileId && 'value' in fileId ? fileId.value : fileId)
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
    const fid = getter()
    if (!fid) {
      revoke()
      return
    }
    loading.value = true
    error.value = false
    revoke()
    try {
      const { blob } = await getFileBlob(fid)
      objectUrl.value = URL.createObjectURL(blob)
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  watch(getter, (val) => {
    if (val) load()
    else revoke()
  }, { immediate: true })

  onUnmounted(revoke)

  return { objectUrl, loading, error, reload: load }
}
