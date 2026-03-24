<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { FolderKanban } from 'lucide-vue-next'
import { buildMobileProjectPath } from '@/constants/routes'
import { ROUTE_PATH } from '@/constants/routes'
import { useProjectStore } from '@/stores/project'
import { apiClient } from '@/api/client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse, ProjectItem } from '@/types'
import IOSInstallPrompt from '@/views/mobile/components/IOSInstallPrompt.vue'

const router = useRouter()
const projectStore = useProjectStore()

const projects = ref<ProjectItem[]>([])
const loading = ref(true)
const errorMessage = ref('')

onMounted(async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await apiClient.get<ApiResponse<ProjectItem[]>>(API_PATH.PROJECTS, {
      params: { page: 1, limit: 50 },
    })
    const list = Array.isArray(data.data) ? data.data : []
    projects.value = list
    list.forEach((p) => projectStore.setProjectName(p.id, p.name))
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: { message?: string } } } }
    errorMessage.value = err.response?.data?.error?.message ?? '無法載入專案列表'
  } finally {
    loading.value = false
  }
})

function selectProject(projectId: string, projectName: string) {
  projectStore.setProjectName(projectId, projectName)
  projectStore.setCurrentProjectId(projectId)
  router.push(buildMobileProjectPath(projectId, ROUTE_PATH.MOBILE_INSPECTION))
}
</script>

<template>
  <div class="mobile-page px-4 pb-6 pt-4">
    <IOSInstallPrompt />

    <h2 class="mb-1 text-lg font-semibold text-foreground">選擇專案</h2>
    <p class="mb-4 text-sm text-muted-foreground">選擇要進行現場查驗的專案</p>

    <p v-if="errorMessage" class="mb-4 text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <div v-if="loading" class="py-8 text-center text-sm text-muted-foreground">載入中…</div>

    <ul v-else class="flex flex-col gap-3">
      <li v-for="p in projects" :key="p.id">
        <button
          type="button"
          class="mobile-card-touch flex w-full min-h-[3.5rem] items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors active:bg-muted/50"
          @click="selectProject(p.id, p.name)"
        >
          <div
            class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <FolderKanban class="size-6" aria-hidden />
          </div>
          <span class="min-w-0 flex-1 truncate text-base font-medium text-foreground">
            {{ p.name }}
          </span>
        </button>
      </li>
      <li
        v-if="!loading && projects.length === 0"
        class="py-8 text-center text-sm text-muted-foreground"
      >
        尚無專案
      </li>
    </ul>
  </div>
</template>
