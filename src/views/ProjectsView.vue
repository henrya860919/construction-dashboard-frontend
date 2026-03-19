<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FolderKanban } from 'lucide-vue-next'
import { buildProjectPath } from '@/constants/routes'
import { useProjectStore } from '@/stores/project'
import { apiClient } from '@/api/client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse, ProjectItem } from '@/types'

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

function openProject(projectId: string, projectName: string) {
  projectStore.setProjectName(projectId, projectName)
  projectStore.setCurrentProjectId(projectId)
  router.push(buildProjectPath(projectId, '/dashboard'))
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">專案列表</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        選擇專案後進入該專案的工作區（儀表板、監測、契約等）
      </p>
    </div>

    <p v-if="errorMessage" class="text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <div v-if="loading" class="text-sm text-muted-foreground">載入中…</div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card
        v-for="p in projects"
        :key="p.id"
        class="cursor-pointer border-border transition-colors hover:border-primary/50 hover:bg-muted/30"
        @click="openProject(p.id, p.name)"
      >
        <CardHeader class="flex flex-row items-center gap-3 pb-2">
          <div
            class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <FolderKanban class="size-6" />
          </div>
          <div class="min-w-0 flex-1">
            <CardTitle class="text-base truncate">{{ p.name }}</CardTitle>
            <CardDescription v-if="p.description" class="truncate">
              {{ p.description }}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent class="pt-0">
          <Button variant="outline" size="sm" class="w-full"> 進入工作區 </Button>
        </CardContent>
      </Card>
    </div>

    <p v-if="!loading && !errorMessage" class="text-xs text-muted-foreground">
      專案列表依登入角色顯示：平台管理員可看全部，租戶管理員可看本租戶，專案層僅顯示被指派的專案。
    </p>
  </div>
</template>
