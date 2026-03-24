import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'construction_dashboard_app_preference'

function getStored(): { preferDesktopOnMobile: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { preferDesktopOnMobile: false }
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && 'preferDesktopOnMobile' in parsed) {
      return { preferDesktopOnMobile: Boolean((parsed as { preferDesktopOnMobile: unknown }).preferDesktopOnMobile) }
    }
  } catch {
    // ignore
  }
  return { preferDesktopOnMobile: false }
}

function save(preferDesktopOnMobile: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ preferDesktopOnMobile }))
  } catch {
    // ignore
  }
}

/**
 * App 偏好（含手機版「切回桌面版」）。
 * 手機端獨立 store，持久化於 localStorage。
 */
export const useAppPreferenceStore = defineStore('appPreference', () => {
  const stored = getStored()
  const preferDesktopOnMobile = ref(stored.preferDesktopOnMobile)

  function setPreferDesktopOnMobile(value: boolean) {
    preferDesktopOnMobile.value = value
    save(value)
  }

  return {
    preferDesktopOnMobile,
    setPreferDesktopOnMobile,
  }
})
