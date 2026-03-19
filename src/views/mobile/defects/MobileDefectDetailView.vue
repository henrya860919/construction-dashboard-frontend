<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2, Plus, ImageIcon, Pencil } from 'lucide-vue-next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { getDefectImprovement, listDefectRecords } from '@/api/defect-improvements'
import { ROUTE_NAME } from '@/constants/routes'
import { usePhotoViewer } from '@/composables/usePhotoViewer'
import type { DefectItem, DefectExecutionRecordItem } from '@/types/defect-improvement'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)
const defectId = computed(() => route.params.defectId as string)

const detailTab = ref<'detail' | 'records'>(
  (route.query.tab as string) === 'records' ? 'records' : 'detail'
)
const loading = ref(true)
const defect = ref<DefectItem | null>(null)
const records = ref<DefectExecutionRecordItem[]>([])
const recordsLoading = ref(false)

async function fetchDefect() {
  if (!projectId.value || !defectId.value) return
  loading.value = true
  try {
    defect.value = await getDefectImprovement(projectId.value, defectId.value)
  } finally {
    loading.value = false
  }
}

async function fetchRecords() {
  if (!projectId.value || !defectId.value) return
  recordsLoading.value = true
  try {
    records.value = await listDefectRecords(projectId.value, defectId.value)
  } finally {
    recordsLoading.value = false
  }
}

watch([projectId, defectId], fetchDefect, { immediate: true })
watch(
  () => route.query.tab as string | undefined,
  (tab) => {
    if (tab === 'records') detailTab.value = 'records'
    else if (tab === 'detail') detailTab.value = 'detail'
  },
  { immediate: true }
)

/** 分頁與 URL 同步，從執行紀錄進子頁再 back() 時能回到「執行紀錄」分頁 */
watch(detailTab, (tab) => {
  const wantRecords = tab === 'records'
  const hasRecords = route.query.tab === 'records'
  if (wantRecords === hasRecords) return
  router.replace({
    name: ROUTE_NAME.MOBILE_DEFECT_DETAIL,
    params: { projectId: projectId.value, defectId: defectId.value },
    query: wantRecords ? { tab: 'records' } : {},
  })
})
watch(
  [projectId, defectId, detailTab],
  () => {
    if (detailTab.value === 'records') fetchRecords()
  },
  { immediate: true }
)

async function goAddRecord() {
  await router.replace({
    name: ROUTE_NAME.MOBILE_DEFECT_DETAIL,
    params: { projectId: projectId.value, defectId: defectId.value },
    query: { tab: 'records' },
  })
  await router.push({
    name: ROUTE_NAME.MOBILE_DEFECT_RECORD_NEW,
    params: { projectId: projectId.value, defectId: defectId.value },
  })
}

function goEdit() {
  router.push({
    name: ROUTE_NAME.MOBILE_DEFECT_EDIT,
    params: { projectId: projectId.value, defectId: defectId.value },
  })
}

async function goViewRecord(record: DefectExecutionRecordItem) {
  await router.replace({
    name: ROUTE_NAME.MOBILE_DEFECT_DETAIL,
    params: { projectId: projectId.value, defectId: defectId.value },
    query: { tab: 'records' },
  })
  await router.push({
    name: ROUTE_NAME.MOBILE_DEFECT_RECORD_DETAIL,
    params: { projectId: projectId.value, defectId: defectId.value, recordId: record.id },
  })
}

function priorityLabel(priority: string) {
  const map: Record<string, string> = { low: '低', medium: '中', high: '高' }
  return map[priority] ?? priority
}

function statusLabel(status: string) {
  return status === 'completed' ? '已完成' : '進行中'
}

const fileBaseUrl = computed(() => {
  const base = import.meta.env.VITE_API_URL ?? ''
  return base.replace(/\/$/, '')
})

const photoViewer = usePhotoViewer()

function openPhotos(urls: string[], index: number) {
  photoViewer.open(urls, index)
}
</script>

<template>
  <div class="mobile-page flex flex-col px-4 pb-6 pt-4">
    <div v-if="loading" class="flex flex-col items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" aria-hidden />
      <p class="mt-2 text-sm text-muted-foreground">載入中...</p>
    </div>

    <template v-else-if="defect">
      <Tabs v-model="detailTab" class="flex flex-1 flex-col gap-4">
        <TabsList class="grid w-full grid-cols-2 rounded-xl bg-muted/60 p-1">
          <TabsTrigger
            value="detail"
            class="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            詳細內容
          </TabsTrigger>
          <TabsTrigger
            value="records"
            class="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            執行紀錄
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detail" class="mt-0 space-y-4">
          <div class="flex justify-end">
            <Button size="sm" variant="outline" class="min-h-10 touch-manipulation" @click="goEdit">
              <Pencil class="size-4" aria-hidden />
              <span class="ml-1">編輯</span>
            </Button>
          </div>
          <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h3 class="text-sm font-medium text-muted-foreground">問題說明</h3>
            <p class="mt-1 text-sm text-foreground">{{ defect.description }}</p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 class="text-sm font-medium text-muted-foreground">發現人</h3>
              <p class="mt-1 text-sm text-foreground">{{ defect.discoveredBy }}</p>
            </div>
            <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 class="text-sm font-medium text-muted-foreground">優先度</h3>
              <p class="mt-1 text-sm text-foreground">{{ priorityLabel(defect.priority) }}</p>
            </div>
            <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 class="text-sm font-medium text-muted-foreground">樓層</h3>
              <p class="mt-1 text-sm text-foreground">{{ defect.floor || '—' }}</p>
            </div>
            <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 class="text-sm font-medium text-muted-foreground">狀態</h3>
              <p class="mt-1 text-sm font-medium" :class="defect.status === 'completed' ? 'text-primary' : 'text-amber-600 dark:text-amber-400'">
                {{ statusLabel(defect.status) }}
              </p>
            </div>
          </div>
          <div v-if="defect.location" class="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h3 class="text-sm font-medium text-muted-foreground">位置</h3>
            <p class="mt-1 text-sm text-foreground">{{ defect.location }}</p>
          </div>
          <div v-if="defect.photos?.length" class="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h3 class="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <ImageIcon class="size-4" />
              照片
            </h3>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="(photo, idx) in defect.photos"
                :key="photo.id"
                type="button"
                class="rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-xs text-foreground underline-offset-2 hover:underline active:bg-muted/50"
                @click="openPhotos(defect.photos!.map((p) => fileBaseUrl + p.url), idx)"
              >
                {{ photo.fileName }}
              </button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="records" class="mt-0 flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-medium text-foreground">執行紀錄歷程</h3>
            <Button size="sm" class="min-h-10 touch-manipulation" @click="goAddRecord">
              <Plus class="size-4" aria-hidden />
              <span class="ml-1">新增</span>
            </Button>
          </div>

          <div v-if="recordsLoading" class="flex justify-center py-8">
            <Loader2 class="size-6 animate-spin text-muted-foreground" aria-hidden />
          </div>
          <div
            v-else-if="records.length === 0"
            class="rounded-xl border border-dashed border-border bg-muted/30 py-10 text-center text-sm text-muted-foreground"
          >
            尚無執行紀錄，點擊「新增」填寫
          </div>
          <ul v-else class="flex flex-col gap-3">
            <li
              v-for="record in records"
              :key="record.id"
              class="cursor-pointer rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow active:bg-muted/50"
              @click="goViewRecord(record)"
            >
              <p class="line-clamp-2 whitespace-pre-wrap text-sm text-foreground">{{ record.content }}</p>
              <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>{{ record.recordedBy?.name ?? '—' }}</span>
                <span>{{ new Date(record.createdAt).toLocaleString('zh-TW') }}</span>
              </div>
              <div
                v-if="record.photos?.length"
                class="mt-2 flex flex-wrap gap-2"
              >
                <button
                  v-for="(photo, idx) in record.photos"
                  :key="photo.id"
                  type="button"
                  class="rounded border border-border bg-muted/30 px-2 py-1 text-left text-xs text-foreground underline-offset-2 hover:underline active:bg-muted/50"
                  @click="openPhotos(record.photos!.map((p) => fileBaseUrl + p.url), idx)"
                >
                  {{ photo.fileName }}
                </button>
              </div>
            </li>
          </ul>
        </TabsContent>
      </Tabs>
    </template>

    <div
      v-else
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center"
    >
      <p class="text-sm text-muted-foreground">找不到該筆缺失</p>
    </div>
  </div>
</template>
