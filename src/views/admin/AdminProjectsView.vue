<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiClient } from '@/api/client'
import { API_PATH } from '@/constants'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import type { ApiResponse } from '@/types'

interface ProjectItem {
  id: string
  name: string
  description: string | null
  code: string | null
  status: string
  tenantId: string | null
  createdAt: string
  updatedAt: string
}

const authStore = useAuthStore()
const adminStore = useAdminStore()
const list = ref<ProjectItem[]>([])
const loading = ref(true)

const tenantIdParam = computed(() => {
  if (authStore.isPlatformAdmin && adminStore.selectedTenantId)
    return { tenantId: adminStore.selectedTenantId }
  return {}
})

onMounted(async () => {
  try {
    const { data } = await apiClient.get<ApiResponse<ProjectItem[]> & { meta: { page: number; limit: number; total: number } }>(
      API_PATH.ADMIN_PROJECTS,
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
    <h1 class="text-xl font-semibold text-foreground">專案管理</h1>
    <p class="text-sm text-muted-foreground">
      管理本租戶專案：新增、編輯、停用；專案成員維護。
    </p>
    <div v-if="loading" class="text-sm text-muted-foreground">載入中…</div>
    <ul v-else-if="list.length" class="space-y-2">
      <li
        v-for="p in list"
        :key="p.id"
        class="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
      >
        {{ p.name }}
        <span v-if="p.code" class="text-muted-foreground">（{{ p.code }}）</span>
      </li>
    </ul>
    <p v-else class="text-sm text-muted-foreground">尚無專案。</p>
  </div>
</template>
