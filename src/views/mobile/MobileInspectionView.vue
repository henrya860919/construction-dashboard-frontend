<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ClipboardCheck, ChevronRight, Loader2 } from 'lucide-vue-next'
import { listProjectSelfInspectionTemplates } from '@/api/project-self-inspections'
import type { ProjectSelfInspectionTemplateItem } from '@/api/project-self-inspections'
import { ROUTE_NAME } from '@/constants/routes'

defineOptions({ name: 'MobileInspectionView' })

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)

const loading = ref(false)
const loadError = ref('')
const templates = ref<ProjectSelfInspectionTemplateItem[]>([])

async function fetchTemplates() {
  if (!projectId.value) return
  loading.value = true
  loadError.value = ''
  try {
    templates.value = await listProjectSelfInspectionTemplates(projectId.value)
  } catch {
    loadError.value = '無法載入樣板'
    templates.value = []
  } finally {
    loading.value = false
  }
}

watch(
  projectId,
  () => {
    void fetchTemplates()
  },
  { immediate: true }
)

function goTemplate(row: ProjectSelfInspectionTemplateItem) {
  router.push({
    name: ROUTE_NAME.MOBILE_INSPECTION_TEMPLATE,
    params: { projectId: projectId.value, templateId: row.id },
  })
}
</script>

<template>
  <div class="mobile-page px-4 pb-6 pt-4">
    <p class="mb-4 text-sm text-muted-foreground">
      選擇樣板後可檢視與新增查驗紀錄。若列表為空，請於桌面版將樣板匯入專案。
    </p>

    <p v-if="loadError" class="mb-4 text-sm text-destructive">{{ loadError }}</p>

    <div v-if="loading" class="flex flex-col items-center py-16">
      <Loader2 class="size-8 animate-spin text-muted-foreground" aria-hidden />
      <p class="mt-2 text-sm text-muted-foreground">載入中…</p>
    </div>

    <div
      v-else-if="templates.length === 0"
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center"
    >
      <ClipboardCheck class="mb-3 size-12 text-muted-foreground" aria-hidden />
      <p class="text-sm font-medium text-foreground">尚無可用樣板</p>
      <p class="mt-1 max-w-[18rem] text-sm text-muted-foreground">
        請在電腦版「施工管理 → 自主檢查」將租戶樣板匯入本專案
      </p>
    </div>

    <ul v-else class="flex flex-col gap-3">
      <li v-for="row in templates" :key="row.id">
        <button
          type="button"
          class="mobile-card-touch flex w-full min-h-[3.75rem] items-center gap-3 rounded-xl border border-border bg-card p-4 text-left active:bg-muted/50"
          @click="goTemplate(row)"
        >
          <div
            class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden
          >
            <ClipboardCheck class="size-5" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-base font-medium text-foreground">{{ row.name }}</p>
            <p v-if="row.description" class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {{ row.description }}
            </p>
          </div>
          <ChevronRight class="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </li>
    </ul>
  </div>
</template>
