<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiClient } from '@/api/client'
import { API_PATH } from '@/constants'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import type { ApiResponse } from '@/types'

interface UserItem {
  id: string
  email: string
  name: string | null
  systemRole: string
  tenantId: string | null
  createdAt: string
  updatedAt: string
}

const authStore = useAuthStore()
const adminStore = useAdminStore()
const list = ref<UserItem[]>([])
const loading = ref(true)

const tenantIdParam = computed(() => {
  if (authStore.isPlatformAdmin && adminStore.selectedTenantId)
    return { tenantId: adminStore.selectedTenantId }
  return {}
})

onMounted(async () => {
  try {
    const { data } = await apiClient.get<ApiResponse<UserItem[]> & { meta: { page: number; limit: number; total: number } }>(
      API_PATH.ADMIN_USERS,
      { params: { page: 1, limit: 20, ...tenantIdParam.value } }
    )
    list.value = data.data ?? []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-semibold text-foreground">成員管理</h1>
    <p class="text-sm text-muted-foreground">
      管理本租戶使用者：邀請、移除、指派專案與角色。
    </p>
    <div v-if="loading" class="text-sm text-muted-foreground">載入中…</div>
    <ul v-else-if="list.length" class="space-y-2">
      <li
        v-for="u in list"
        :key="u.id"
        class="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
      >
        {{ u.name || u.email }}
        <span class="text-muted-foreground">（{{ u.systemRole }}）</span>
      </li>
    </ul>
    <p v-else class="text-sm text-muted-foreground">尚無成員。</p>
  </div>
</template>
