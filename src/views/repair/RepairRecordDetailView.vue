<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, ArrowLeft, ImageIcon, Paperclip, Download } from 'lucide-vue-next'
import { getRepairRequest, listRepairRecords } from '@/api/repair-requests'
import { getFileBlob } from '@/api/files'
import { ROUTE_NAME } from '@/constants'
import { useRepairBreadcrumbStore } from '@/stores/repairBreadcrumb'
import type { RepairRequestItem, RepairExecutionRecordItem, RepairRequestStatus } from '@/types/repair-request'

const route = useRoute()
const router = useRouter()
const repairBreadcrumbStore = useRepairBreadcrumbStore()

const projectId = computed(() => route.params.projectId as string)
const repairId = computed(() => route.params.repairId as string)

const loading = ref(true)
const loadError = ref('')
const item = ref<RepairRequestItem | null>(null)
const records = ref<RepairExecutionRecordItem[]>([])
const recordsLoading = ref(false)

const imagePreviewOpen = ref(false)
const imagePreviewUrl = ref<string | null>(null)
const downloadingId = ref<string | null>(null)

const STATUS_LABELS: Record<RepairRequestStatus, string> = {
  in_progress: '進行中',
  completed: '已完成',
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium' }).format(d)
}

function formatDateTime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function goBack() {
  router.push({
    name: ROUTE_NAME.PROJECT_REPAIR_RECORDS,
    params: { projectId: projectId.value },
  })
}

async function loadDetail() {
  const pid = projectId.value
  const rid = repairId.value
  if (!pid || !rid) return
  loading.value = true
  loadError.value = ''
  repairBreadcrumbStore.setCurrentTitle(null)
  try {
    const data = await getRepairRequest(pid, rid)
    item.value = data
    if (data) {
      repairBreadcrumbStore.setCurrentTitle(`${data.customerName} · ${data.problemCategory}`)
    } else {
      loadError.value = '找不到此報修單'
    }
  } catch {
    item.value = null
    loadError.value = '無法載入報修資料'
  } finally {
    loading.value = false
  }
}

async function loadRecords() {
  const pid = projectId.value
  const rid = repairId.value
  if (!pid || !rid) return
  recordsLoading.value = true
  try {
    records.value = await listRepairRecords(pid, rid)
  } catch {
    records.value = []
  } finally {
    recordsLoading.value = false
  }
}

watch(
  [projectId, repairId],
  () => {
    loadDetail().then(() => {
      if (item.value) loadRecords()
      else records.value = []
    })
  },
  { immediate: true }
)

onUnmounted(() => {
  repairBreadcrumbStore.setCurrentTitle(null)
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value)
    imagePreviewUrl.value = null
  }
})

function closeImagePreview() {
  imagePreviewOpen.value = false
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value)
    imagePreviewUrl.value = null
  }
}

async function openImagePreview(attId: string) {
  try {
    const { blob } = await getFileBlob(attId)
    if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
    imagePreviewUrl.value = URL.createObjectURL(blob)
    imagePreviewOpen.value = true
  } catch {
    // ignore
  }
}

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

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/')
}

const detailFields = computed(() => {
  const r = item.value
  if (!r) return []
  return [
    { label: '客戶姓名', value: r.customerName },
    { label: '聯絡電話', value: r.contactPhone },
    { label: '問題類別', value: r.problemCategory },
    {
      label: '狀態',
      value: STATUS_LABELS[r.status as RepairRequestStatus] ?? r.status,
    },
    { label: '戶別', value: r.unitLabel?.trim() ? r.unitLabel : '—' },
    { label: '二次報修', value: r.isSecondRepair ? '是' : '否' },
    { label: '交屋日', value: formatDate(r.deliveryDate) },
    { label: '修繕日', value: formatDate(r.repairDate) },
    { label: '建立時間', value: formatDateTime(r.createdAt) },
    { label: '最後更新', value: formatDateTime(r.updatedAt) },
  ]
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-3">
      <Button variant="outline" class="gap-2" @click="goBack">
        <ArrowLeft class="size-4" />
        返回列表
      </Button>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Loader2 class="size-8 animate-spin" />
      <p class="mt-2 text-sm">載入中…</p>
    </div>

    <div v-else-if="loadError || !item" class="rounded-lg border border-border bg-card p-8 text-center">
      <p class="text-sm text-destructive">{{ loadError || '找不到此報修單' }}</p>
      <Button variant="outline" class="mt-4" @click="goBack">返回列表</Button>
    </div>

    <template v-else>
      <div class="rounded-lg border border-border bg-card p-4 sm:p-6">
        <h2 class="text-lg font-semibold text-foreground">基本資料</h2>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <Badge
            :variant="item.status === 'completed' ? 'secondary' : 'default'"
            class="font-normal"
          >
            {{ STATUS_LABELS[item.status as RepairRequestStatus] ?? item.status }}
          </Badge>
          <Badge v-if="item.isSecondRepair" variant="outline" class="font-normal">
            二次報修
          </Badge>
        </div>
        <dl class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="row in detailFields" :key="row.label" class="min-w-0">
            <dt class="text-xs font-medium text-muted-foreground">{{ row.label }}</dt>
            <dd class="mt-0.5 text-sm text-foreground">{{ row.value }}</dd>
          </div>
        </dl>

        <div class="mt-6 border-t border-border pt-4">
          <h3 class="text-sm font-medium text-muted-foreground">報修內容</h3>
          <p class="mt-2 whitespace-pre-wrap text-sm text-foreground">{{ item.repairContent }}</p>
        </div>

        <div v-if="item.remarks?.trim()" class="mt-4">
          <h3 class="text-sm font-medium text-muted-foreground">備註</h3>
          <p class="mt-2 whitespace-pre-wrap text-sm text-foreground">{{ item.remarks }}</p>
        </div>

        <div v-if="item.photos?.length" class="mt-6 border-t border-border pt-4">
          <h3 class="flex items-center gap-2 text-sm font-medium text-foreground">
            <ImageIcon class="size-4 text-muted-foreground" />
            照片
          </h3>
          <ul class="mt-3 flex flex-col gap-2">
            <li
              v-for="p in item.photos"
              :key="p.id"
              class="flex flex-wrap items-center gap-2"
            >
              <Button
                v-if="isImageMime(p.mimeType)"
                variant="outline"
                size="sm"
                class="max-w-[240px] truncate"
                :title="p.fileName"
                @click="openImagePreview(p.id)"
              >
                {{ p.fileName }}
              </Button>
              <template v-else>
                <span class="max-w-[200px] truncate text-sm text-foreground">{{ p.fileName }}</span>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="downloadingId === p.id"
                  @click="downloadFile(p.id, p.fileName)"
                >
                  <Download class="mr-1 size-3.5" />
                  下載
                </Button>
              </template>
            </li>
          </ul>
        </div>

        <div v-if="item.attachments?.length" class="mt-6 border-t border-border pt-4">
          <h3 class="flex items-center gap-2 text-sm font-medium text-foreground">
            <Paperclip class="size-4 text-muted-foreground" />
            附件
          </h3>
          <ul class="mt-3 flex flex-col gap-2">
            <li v-for="a in item.attachments" :key="a.id" class="flex flex-wrap items-center gap-2">
              <span class="truncate text-sm text-foreground">{{ a.fileName }}</span>
              <span class="text-xs tabular-nums text-muted-foreground">
                {{ (a.fileSize / 1024).toFixed(1) }} KB
              </span>
              <Button
                variant="outline"
                size="sm"
                :disabled="downloadingId === a.id"
                @click="downloadFile(a.id, a.fileName)"
              >
                <Download class="mr-1 size-3.5" />
                下載
              </Button>
            </li>
          </ul>
        </div>
      </div>

      <div class="rounded-lg border border-border bg-card p-4 sm:p-6">
        <h2 class="text-lg font-semibold text-foreground">執行紀錄</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          現場填寫之處理歷程（含照片）；新增紀錄請使用手機版。
        </p>

        <div v-if="recordsLoading" class="flex justify-center py-12 text-muted-foreground">
          <Loader2 class="size-8 animate-spin" />
        </div>
        <Table v-else-if="records.length > 0" class="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead class="w-[160px]">時間</TableHead>
              <TableHead class="w-[140px]">紀錄人</TableHead>
              <TableHead>內容</TableHead>
              <TableHead class="w-[100px] text-right">照片</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="rec in records" :key="rec.id">
              <TableCell class="align-top tabular-nums text-sm text-muted-foreground">
                {{ formatDateTime(rec.createdAt) }}
              </TableCell>
              <TableCell class="align-top text-sm text-foreground">
                {{ rec.recordedBy?.name || rec.recordedBy?.email || '—' }}
              </TableCell>
              <TableCell class="align-top">
                <p class="whitespace-pre-wrap text-sm text-foreground">{{ rec.content }}</p>
                <div v-if="rec.photos?.length" class="mt-2 flex flex-wrap gap-2">
                  <Button
                    v-for="ph in rec.photos"
                    :key="ph.id"
                    variant="secondary"
                    size="sm"
                    class="max-w-[160px] truncate"
                    :disabled="!isImageMime(ph.mimeType)"
                    @click="openImagePreview(ph.id)"
                  >
                    {{ ph.fileName }}
                  </Button>
                </div>
              </TableCell>
              <TableCell class="align-top text-right text-sm text-muted-foreground">
                {{ rec.photos?.length ?? 0 }} 張
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div
          v-else
          class="mt-6 rounded-md border border-dashed border-border py-10 text-center text-sm text-muted-foreground"
        >
          尚無執行紀錄
        </div>
      </div>
    </template>

    <Dialog :open="imagePreviewOpen" @update:open="(v) => !v && closeImagePreview()">
      <DialogContent class="max-w-3xl border-border bg-card p-4">
        <DialogHeader>
          <DialogTitle>預覽</DialogTitle>
        </DialogHeader>
        <div v-if="imagePreviewUrl" class="max-h-[70vh] overflow-auto rounded-md border border-border bg-background p-2">
          <img
            :src="imagePreviewUrl"
            alt="預覽"
            class="mx-auto max-h-[65vh] w-auto max-w-full object-contain"
          >
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
