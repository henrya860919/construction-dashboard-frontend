import { ref, computed, watchEffect } from 'vue'
import { defineStore } from 'pinia'
import {
  getThemeMode,
  setThemeMode,
  getAccent,
  setAccent as setAccentStorage,
  applyTheme,
  subscribeToSystemPreference,
} from '@/lib/theme'
import type { ThemeMode, AccentScheme } from '@/constants/theme'

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(getThemeMode())
  const accent = ref<AccentScheme>(getAccent())

  function setMode(value: ThemeMode) {
    mode.value = value
    setThemeMode(value)
    applyTheme()
  }

  function setAccent(value: AccentScheme) {
    accent.value = value
    setAccentStorage(value)
    applyTheme()
  }

  /** 在淺色／深色之間切換（不經過 system） */
  function toggle() {
    setMode(mode.value === 'dark' ? 'light' : 'dark')
  }

  /** 是否為深色（用於顯示圖示等） */
  const isDark = computed(() => {
    if (mode.value === 'dark') return true
    if (mode.value === 'light') return false
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  watchEffect(() => {
    if (mode.value !== 'system') return
    const unsub = subscribeToSystemPreference(() => applyTheme())
    return unsub
  })

  return { mode, accent, isDark, setMode, setAccent, toggle }
})
