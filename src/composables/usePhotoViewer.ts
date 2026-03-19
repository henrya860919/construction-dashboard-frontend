import { useRouter } from 'vue-router'
import { usePhotoViewerStore } from '@/stores/photoViewer'
import { ROUTE_NAME } from '@/constants/routes'

/**
 * 通用照片查看：設定照片列表後導向查看頁，任何有顯示照片的畫面都可使用。
 * @example
 * const photoViewer = usePhotoViewer()
 * photoViewer.open([url1, url2], 0)  // 從第一張開始
 */
export function usePhotoViewer() {
  const router = useRouter()
  const store = usePhotoViewerStore()

  function open(urls: string[], index = 0) {
    if (!urls?.length) return
    store.setPhotos(urls, index)
    router.push({ name: ROUTE_NAME.MOBILE_PHOTO_VIEWER })
  }

  return { open }
}
