import { computed } from 'vue'

/**
 * 裝置與 PWA 情境判斷，供手機版／桌面版導向與 UI 使用。
 * 手機端獨立，不依賴桌機版 composables。
 */
export function useDevice() {
  const isPWA = computed(() => {
    if (typeof window === 'undefined') return false
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    return standalone
  })

  const isMobile = computed(() => {
    if (typeof window === 'undefined') return false
    const ua = /iPhone|iPad|iPod|Android|webOS|Mobile|IEMobile|BlackBerry/i.test(
      window.navigator.userAgent
    )
    const narrow = typeof window.innerWidth === 'number' && window.innerWidth < 768
    return ua || narrow
  })

  /** 是否視為「手機 App」情境（PWA 或手機裝置），預設進手機版 */
  const isMobileApp = computed(() => isPWA.value || isMobile.value)

  return { isPWA, isMobile, isMobileApp }
}
