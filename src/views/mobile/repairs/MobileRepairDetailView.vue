<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2, Plus, ImageIcon, Pencil, Paperclip } from 'lucide-vue-next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { getRepairRequest, listRepairRecords } from '@/api/repair-requests'
import { getFileBlob } from '@/api/files'
import { ROUTE_NAME } from '@/constants/routes'
import { usePhotoViewer } from '@/composables/usePhotoViewer'
import type { RepairRequestItem, RepairExecutionRecordItem } from '@/types/repair-request'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)
const repairId = computed(() => route.params.repairId as string)

const detailTab = ref<'detail' | 'records'>(
  (route.query.tab as string) === 'records' ? 'records' : 'detail'
)
const loading = ref(true)
const item = ref<RepairRequestItem | null>(null)
const records = ref<RepairExecutionRecordItem[]>([])
const recordsLoading = ref(false)

async function fetchItem() {
  if (!projectId.value || !repairId.value) return
  loading.value = true
  try {
    item.value = await getRepairRequest(projectId.value, repairId.value)
  } finally {
    loading.value = false
  }
}

async function fetchRecords() {
  if (!projectId.value || !repairId.value) return
  recordsLoading.value = true
  try {
    records.value = await listRepairRecords(projectId.value, repairId.value)
  } finally {
    recordsLoading.value = false
  }
}

watch([projectId, repairId], fetchItem, { immediate: true })
watch(
  () => route.query.tab as string | undefined,
  (tab) => {
    if (tab === 'records') detailTab.value = 'records'
    else if (tab === 'detail') detailTab.value = 'detail'
  },
  { immediate: true }
)

watch(detailTab, (tab) => {
  const wantRecords = tab === 'records'
  const hasRecords = route.query.tab === 'records'
  if (wantRecords === hasRecords) return
  router.replace({
    name: ROUTE_NAME.MOBILE_REPAIR_DETAIL,
    params: { projectId: projectId.value, repairId: repairId.value },
    query: wantRecords ? { tab: 'records' } : {},
  })
})
watch(
  [projectId, repairId, detailTab],
  () => {
    if (detailTab.value === 'records') fetchRecords()
  },
  { immediate: true }
)

async function goAddRecord() {
  await router.replace({
    name: ROUTE_NAME.MOBILE_REPAIR_DETAIL,
    params: { projectId: projectId.value, repairId: repairId.value },
    query: { tab: 'records' },
  })
  await router.push({
    name: ROUTE_NAME.MOBILE_REPAIR_RECORD_NEW,
    params: { projectId: projectId.value, repairId: repairId.value },
  })
}

function goEdit() {
  router.push({
    name: ROUTE_NAME.MOBILE_REPAIR_EDIT,
    params: { projectId: projectId.value, repairId: repairId.value },
  })
}

async function goViewRecord(record: RepairExecutionRecordItem) {
  await router.replace({
    name: ROUTE_NAME.MOBILE_REPAIR_DETAIL,
    params: { projectId: projectId.value, repairId: repairId.value },
    query: { tab: 'records' },
  })
  await router.push({
    name: ROUTE_NAME.MOBILE_REPAIR_RECORD_DETAIL,
    params: { projectId: projectId.value, repairId: repairId.value, recordId: record.id },
  })
}

function statusLabel(status: string) {
  return status === 'completed' ? '已完成' : '進行中'
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium' }).format(d)
}

const fileBaseUrl = computed(() => {
  const base = import.meta.env.VITE_API_URL ?? ''
  return base.replace(/\/$/, '')
})

const photoViewer = usePhotoViewer()

function openPhotos(urls: string[], index: number) {
  photoViewer.open(urls, index)
}

const downloadingId = ref<string | null>(null)

async function downloadFile(attId: string, fileName: string) {
  if (downloadingId.value) return
  downloadingId.value = attId
  try {
    const { blob, fileName: name } = await getFileBlob(attId, { download: true, fileName })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    downloadingId.value = null
  }
}
</script>

<template>
  <div class="mobile-page flex flex-col px-4 pb-6 pt-4">
    <div v-if="loading" class="flex flex-col items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" aria-hidden />
      <p class="mt-2 text-sm text-muted-foreground">載入中...</p>
    </div>

    <template v-else-if="item">
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
            報修紀錄
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
            <h3 class="text-sm font-medium text-muted-foreground">報修內容</h3>
            <p class="mt-1 whitespace-pre-wrap text-sm text-foreground">{{ item.repairContent }}</p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 class="text-sm font-medium text-muted-foreground">客戶姓名</h3>
              <p class="mt-1 text-sm text-foreground">{{ item.customerName }}</p>
            </div>
            <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 class="text-sm font-medium text-muted-foreground">聯絡電話</h3>
              <p class="mt-1 text-sm text-foreground">{{ item.contactPhone }}</p>
            </div>
            <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 class="text-sm font-medium text-muted-foreground">戶別</h3>
              <p class="mt-1 text-sm text-foreground">{{ item.unitLabel || '—' }}</p>
            </div>
            <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 class="text-sm font-medium text-muted-foreground">問題類別</h3>
              <p class="mt-1 text-sm text-foreground">{{ item.problemCategory }}</p>
            </div>
            <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 class="text-sm font-medium text-muted-foreground">是否二次維修</h3>
              <p class="mt-1 text-sm text-foreground">{{ item.isSecondRepair ? '是' : '否' }}</p>
            </div>
            <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 class="text-sm font-medium text-muted-foreground">狀態</h3>
              <p
                class="mt-1 text-sm font-medium"
                :class="item.status === 'completed' ? 'text-primary' : 'text-amber-600 dark:text-amber-400'"
              >
                {{ statusLabel(item.status) }}
              </p>
            </div>
            <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 class="text-sm font-medium text-muted-foreground">交付日期</h3>
              <p class="mt-1 text-sm text-foreground">{{ formatDate(item.deliveryDate) }}</p>
            </div>
            <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 class="text-sm font-medium text-muted-foreground">報修日期</h3>
              <p class="mt-1 text-sm text-foreground">{{ formatDate(item.repairDate) }}</p>
            </div>
          </div>

          <div v-if="item.remarks" class="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h3 class="text-sm font-medium text-muted-foreground">備註</h3>
            <p class="mt-1 whitespace-pre-wrap text-sm text-foreground">{{ item.remarks }}</p>
          </div>

          <div v-if="item.photos?.length" class="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h3 class="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <ImageIcon class="size-4" />
              照片
            </h3>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="(photo, idx) in item.photos"
                :key="photo.id"
                type="button"
                class="rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-xs text-foreground underline-offset-2 hover:underline active:bg-muted/50"
                @click="openPhotos(item.photos!.map((p) => fileBaseUrl + p.url), idx)"
              >
                {{ photo.fileName }}
              </button>
            </div>
          </div>

          <div v-if="item.attachments?.length" class="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h3 class="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Paperclip class="size-4" />
              附件
            </h3>
            <ul class="flex flex-col gap-2">
              <li v-for="att in item.attachments" :key="att.id">
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-left text-sm text-foreground touch-manipulation active:bg-muted/50"
                  :disabled="downloadingId === att.id"
                  @click="downloadFile(att.id, att.fileName)"
                >
                  <span class="min-w-0 truncate">{{ att.fileName }}</span>
                  <Loader2 v-if="downloadingId === att.id" class="size-4 shrink-0 animate-spin text-muted-foreground" />
                  <span v-else class="shrink-0 text-xs text-muted-foreground">下載</span>
                </button>
              </li>
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="records" class="mt-0 flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-medium text-foreground">報修紀錄歷程</h3>
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
            尚無報修紀錄，點擊「新增」填寫
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
              <div v-if="record.photos?.length" class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="(photo, idx) in record.photos"
                  :key="photo.id"
                  type="button"
                  class="rounded border border-border bg-muted/30 px-2 py-1 text-left text-xs text-foreground underline-offset-2 hover:underline active:bg-muted/50"
                  @click.stop="openPhotos(record.photos!.map((p) => fileBaseUrl + p.url), idx)"
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
      <p class="text-sm text-muted-foreground">找不到該筆報修</p>
    </div>
  </div>
</template>
