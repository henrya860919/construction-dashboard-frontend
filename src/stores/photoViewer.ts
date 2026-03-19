import { ref } from 'vue'
import { defineStore } from 'pinia'

/**
 * 通用照片查看器狀態，供任何有照片的頁面開啟全螢幕查看。
 * 由 usePhotoViewer composable 設定後導向 /mobile/photo-viewer。
 */
export const usePhotoViewerStore = defineStore('photoViewer', () => {
  const photoUrls = ref<string[]>([])
  const photoIndex = ref(0)

  function setPhotos(urls: string[], index = 0) {
    photoUrls.value = urls
    photoIndex.value = Math.max(0, Math.min(index, urls.length - 1))
  }

  function setIndex(i: number) {
    photoIndex.value = Math.max(0, Math.min(i, photoUrls.value.length - 1))
  }

  function clear() {
    photoUrls.value = []
    photoIndex.value = 0
  }

  return { photoUrls, photoIndex, setPhotos, setIndex, clear }
})
