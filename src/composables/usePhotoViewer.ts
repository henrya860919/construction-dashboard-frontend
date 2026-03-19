import { useRouter } from 'vue-router'
import { usePhotoViewerStore } from '@/stores/photoViewer'
import { ROUTE_NAME } from '@/constants/routes'
import { apiClient } from '@/api/client'
import { API_PATH } from '@/constants/api'
import { extractAttachmentIdFromApiFileUrl } from '@/lib/attachment-url'

/**
 * 通用照片查看：以帶 JWT 的請求取得檔案 blob 後再導向查看頁（純 img src 無法帶 Authorization）。
 * @example
 * await photoViewer.open([url1, url2], 0)
 */
export function usePhotoViewer() {
  const router = useRouter()
  const store = usePhotoViewerStore()

  async function open(urls: string[], index = 0) {
    if (!urls?.length) return
    const blobUrls: string[] = []
    try {
      for (const url of urls) {
        const id = extractAttachmentIdFromApiFileUrl(url)
        if (id) {
          const res = await apiClient.get(API_PATH.FILES_GET(id), { responseType: 'blob' })
          blobUrls.push(URL.createObjectURL(res.data as Blob))
        } else {
          blobUrls.push(url)
        }
      }
    } catch {
      for (const b of blobUrls) {
        if (b.startsWith('blob:')) URL.revokeObjectURL(b)
      }
      return
    }
    if (!blobUrls.length) return
    const start = Math.max(0, Math.min(index, blobUrls.length - 1))
    store.setPhotos(blobUrls, start)
    await router.push({ name: ROUTE_NAME.MOBILE_PHOTO_VIEWER })
  }

  return { open }
}
