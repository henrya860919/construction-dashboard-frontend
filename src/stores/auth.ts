import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types/auth'
import { useProjectPermissionsStore } from '@/stores/projectPermissions'

const TOKEN_KEY = 'construction_dashboard_access_token'
const USER_KEY = 'construction_dashboard_user'

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(getStoredToken())
  const user = ref<User | null>(getStoredUser())

  const isAuthenticated = computed(() => !!accessToken.value)

  const isPlatformAdmin = computed(
    () => user.value?.systemRole === 'platform_admin'
  )
  const isTenantAdmin = computed(
    () => user.value?.systemRole === 'tenant_admin'
  )
  const canAccessAdmin = computed(
    () =>
      user.value?.systemRole === 'platform_admin' ||
      user.value?.systemRole === 'tenant_admin'
  )

  function setAuth(token: string, userData: User) {
    accessToken.value = token
    user.value = userData
    try {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(userData))
    } catch {}
  }

  function setToken(token: string) {
    accessToken.value = token
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {}
  }

  function setUser(userData: User) {
    user.value = userData
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(userData))
    } catch {}
  }

  function clearAuth() {
    accessToken.value = null
    user.value = null
    try {
      useProjectPermissionsStore().clearAll()
    } catch {
      /* pinia 尚未就緒時略過 */
    }
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    } catch {}
  }

  return {
    accessToken,
    user,
    isAuthenticated,
    isPlatformAdmin,
    isTenantAdmin,
    canAccessAdmin,
    setAuth,
    setToken,
    setUser,
    clearAuth,
  }
})
