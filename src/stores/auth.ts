import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)

  const isAuthenticated = computed(() => !!accessToken.value)

  function setToken(token: string) {
    accessToken.value = token
  }

  function clearAuth() {
    accessToken.value = null
  }

  return {
    accessToken,
    isAuthenticated,
    setToken,
    clearAuth,
  }
})
