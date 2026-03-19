import { ref } from 'vue'
import { defineStore } from 'pinia'

function revokeBlobUrls(urls: readonly string[]) {
  for (const u of urls) {
    if (u.startsWith('blob:')) URL.revokeObjectURL(u)
  }
}

/**
 * 通用照片查看器狀態，供任何有照片的頁面開啟全螢幕查看。
 * 由 usePhotoViewer composable 設定後導向 /mobile/photo-viewer。
 * 顯示用 URL 通常為 blob:（由 apiClient 帶 JWT 取回後建立），clear 時須 revoke。
 */
export const usePhotoViewerStore = defineStore('photoViewer', () => {
  const photoUrls = ref<string[]>([])
  const photoIndex = ref(0)

  function setPhotos(urls: string[], index = 0) {
    revokeBlobUrls(photoUrls.value)
    photoUrls.value = urls
    photoIndex.value = Math.max(0, Math.min(index, urls.length - 1))
  }

  function setIndex(i: number) {
    photoIndex.value = Math.max(0, Math.min(i, photoUrls.value.length - 1))
  }

  function clear() {
    revokeBlobUrls(photoUrls.value)
    photoUrls.value = []
    photoIndex.value = 0
  }

  return { photoUrls, photoIndex, setPhotos, setIndex, clear }
})
