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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import PhotoThumbnail from '@/components/files/PhotoThumbnail.vue'
import { Loader2, ArrowLeft, ImageIcon, Paperclip, Download, Plus, X } from 'lucide-vue-next'
import { Label } from '@/components/ui/label'
import { getRepairRequest, listRepairRecords, createRepairRecord } from '@/api/repair-requests'
import { getFileBlob, uploadFile } from '@/api/files'
import { ROUTE_NAME } from '@/constants'
import { useRepairBreadcrumbStore } from '@/stores/repairBreadcrumb'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { ensureProjectPermission } from '@/lib/permission-toast'
import type { RepairRequestItem, RepairExecutionRecordItem, RepairRequestStatus } from '@/types/repair-request'

const route = useRoute()
const router = useRouter()
const repairBreadcrumbStore = useRepairBreadcrumbStore()

const projectId = computed(() => route.params.projectId as string)
const repairId = computed(() => route.params.repairId as string)
const repairRecordPerm = useProjectModuleActions(projectId, 'repair.record')

const loading = ref(true)
const loadError = ref('')
const item = ref<RepairRequestItem | null>(null)
const records = ref<RepairExecutionRecordItem[]>([])
const recordsLoading = ref(false)

const imagePreviewOpen = ref(false)
const imagePreviewUrl = ref<string | null>(null)
const imagePreviewTitle = ref('')
const downloadingId = ref<string | null>(null)

const newRecordModalOpen = ref(false)
const newRecordContent = ref('')
const newRecordAttachmentIds = ref<string[]>([])
const newRecordPhotoInputRef = ref<HTMLInputElement | null>(null)
const newRecordUploading = ref(false)
const newRecordSubmitting = ref(false)
const newRecordError = ref('')

const newRecordTextareaClass =
  'flex min-h-[6rem] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30'

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
  imagePreviewTitle.value = ''
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value)
    imagePreviewUrl.value = null
  }
}

async function openImagePreview(attId: string, title?: string) {
  try {
    const { blob } = await getFileBlob(attId)
    if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
    imagePreviewUrl.value = URL.createObjectURL(blob)
    imagePreviewTitle.value = title?.trim() || '預覽'
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

function resetNewRecordForm() {
  newRecordContent.value = ''
  newRecordAttachmentIds.value = []
  newRecordError.value = ''
}

function openNewRecordModal() {
  resetNewRecordForm()
  newRecordModalOpen.value = true
}

function onNewRecordModalOpenChange(open: boolean) {
  newRecordModalOpen.value = open
  if (!open && !newRecordSubmitting.value) {
    resetNewRecordForm()
  }
}

function cancelNewRecordModal() {
  newRecordModalOpen.value = false
}

function removeDraftAttachment(id: string) {
  newRecordAttachmentIds.value = newRecordAttachmentIds.value.filter((x) => x !== id)
}

function pickNewRecordPhotos() {
  newRecordPhotoInputRef.value?.click()
}

async function onNewRecordPhotosChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files?.length || !projectId.value) return
  newRecordUploading.value = true
  newRecordError.value = ''
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) continue
      const result = await uploadFile({
        file,
        projectId: projectId.value,
        category: 'repair_record',
      })
      newRecordAttachmentIds.value = [...newRecordAttachmentIds.value, result.id]
    }
  } catch {
    newRecordError.value = '照片上傳失敗'
  } finally {
    newRecordUploading.value = false
    input.value = ''
  }
}

async function submitNewRecord() {
  if (!ensureProjectPermission(repairRecordPerm.canUpdate.value, 'change')) return
  const trimmed = newRecordContent.value.trim()
  if (!trimmed) {
    newRecordError.value = '請填寫執行紀錄內容'
    return
  }
  const pid = projectId.value
  const rid = repairId.value
  if (!pid || !rid) return
  newRecordSubmitting.value = true
  newRecordError.value = ''
  try {
    await createRepairRecord(pid, rid, {
      content: trimmed,
      attachmentIds: newRecordAttachmentIds.value.length
        ? newRecordAttachmentIds.value
        : undefined,
    })
    resetNewRecordForm()
    newRecordModalOpen.value = false
    await loadRecords()
  } catch {
    newRecordError.value = '送出失敗'
  } finally {
    newRecordSubmitting.value = false
  }
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
          <p class="mt-1 text-xs text-muted-foreground">點縮圖可放大預覽；非圖檔請用下載。</p>
          <ul class="mt-3 flex flex-wrap gap-3">
            <li
              v-for="p in item.photos"
              :key="p.id"
              class="flex flex-col items-start gap-1.5"
            >
              <button
                v-if="isImageMime(p.mimeType)"
                type="button"
                class="relative size-24 shrink-0 overflow-hidden rounded-md border border-border bg-muted ring-offset-background transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :title="p.fileName"
                :aria-label="`預覽 ${p.fileName}`"
                @click="openImagePreview(p.id, p.fileName)"
              >
                <PhotoThumbnail :file-id="p.id" />
              </button>
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
              <span
                v-if="isImageMime(p.mimeType)"
                class="max-w-[6.5rem] truncate text-xs text-muted-foreground"
                :title="p.fileName"
              >
                {{ p.fileName }}
              </span>
            </li>
          </ul>
        </div>

        <div v-if="item.attachments?.length" class="mt-6 border-t border-border pt-4">
          <h3 class="flex items-center gap-2 text-sm font-medium text-foreground">
            <Paperclip class="size-4 text-muted-foreground" />
            附件
          </h3>
          <ul class="mt-3 flex flex-wrap gap-3">
            <li
              v-for="a in item.attachments"
              :key="a.id"
              class="flex flex-col items-start gap-1.5"
            >
              <button
                v-if="isImageMime(a.mimeType)"
                type="button"
                class="relative size-24 shrink-0 overflow-hidden rounded-md border border-border bg-muted ring-offset-background transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :title="a.fileName"
                :aria-label="`預覽 ${a.fileName}`"
                @click="openImagePreview(a.id, a.fileName)"
              >
                <PhotoThumbnail :file-id="a.id" />
              </button>
              <div class="flex flex-wrap items-center gap-2">
                <span class="max-w-[200px] truncate text-sm text-foreground">{{ a.fileName }}</span>
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
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div class="rounded-lg border border-border bg-card p-4 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-foreground">執行紀錄</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              處理歷程與照片；具變更權限者可開啟視窗新增紀錄（與手機版寫入相同資料）。
            </p>
          </div>
          <Button
            v-if="repairRecordPerm.canUpdate"
            type="button"
            size="sm"
            class="gap-1.5 shrink-0"
            @click="openNewRecordModal"
          >
            <Plus class="size-4" />
            新增執行紀錄
          </Button>
        </div>

        <div
          v-if="recordsLoading"
          class="mt-6 flex justify-center py-12 text-muted-foreground"
        >
          <Loader2 class="size-8 animate-spin" />
        </div>
        <Table v-else-if="records.length > 0" class="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead class="w-[160px]">時間</TableHead>
              <TableHead class="w-[140px]">紀錄人</TableHead>
              <TableHead>內容</TableHead>
              <TableHead class="min-w-[200px]">照片</TableHead>
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
              </TableCell>
              <TableCell class="align-top">
                <div v-if="rec.photos?.length" class="flex max-w-[220px] flex-wrap gap-2">
                  <div
                    v-for="ph in rec.photos"
                    :key="ph.id"
                    class="flex flex-col items-center gap-1"
                  >
                    <button
                      v-if="isImageMime(ph.mimeType)"
                      type="button"
                      class="relative size-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted ring-offset-background transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      :title="ph.fileName"
                      :aria-label="`預覽 ${ph.fileName}`"
                      @click="openImagePreview(ph.id, ph.fileName)"
                    >
                      <PhotoThumbnail :file-id="ph.id" />
                    </button>
                    <Button
                      v-else
                      variant="outline"
                      size="sm"
                      class="max-w-[100px] truncate text-xs"
                      :disabled="downloadingId === ph.id"
                      @click="downloadFile(ph.id, ph.fileName)"
                    >
                      <Download class="mr-1 size-3" />
                      檔案
                    </Button>
                    <span
                      v-if="isImageMime(ph.mimeType)"
                      class="line-clamp-2 w-16 text-center text-[10px] leading-tight text-muted-foreground"
                      :title="ph.fileName"
                    >
                      {{ ph.fileName }}
                    </span>
                  </div>
                </div>
                <span v-else class="text-sm text-muted-foreground">—</span>
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

    <Dialog
      :open="newRecordModalOpen"
      @update:open="onNewRecordModalOpenChange"
    >
      <DialogContent
        class="max-h-[min(92vh,40rem)] gap-0 overflow-y-auto border-border bg-card p-0 sm:max-w-lg"
        @pointer-down-outside="(e) => newRecordSubmitting && e.preventDefault()"
        @escape-key-down="(e) => newRecordSubmitting && e.preventDefault()"
      >
        <DialogHeader class="border-b border-border px-6 py-4 text-left">
          <DialogTitle>新增執行紀錄</DialogTitle>
          <DialogDescription>
            填寫處理內容；照片選填，上傳後可見縮圖，點縮圖可預覽，送出後寫入此報修單。
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 px-6 py-4">
          <div class="space-y-2">
            <Label for="newRecordContentModal" class="text-foreground">
              紀錄內容 <span class="text-destructive">*</span>
            </Label>
            <textarea
              id="newRecordContentModal"
              v-model="newRecordContent"
              :class="newRecordTextareaClass"
              placeholder="請描述本次處理或回覆內容…"
              rows="5"
            />
          </div>
          <div class="space-y-2">
            <Label class="text-foreground">照片（選填）</Label>
            <input
              ref="newRecordPhotoInputRef"
              type="file"
              accept="image/*"
              multiple
              class="sr-only"
              @change="onNewRecordPhotosChange"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="h-8"
              :disabled="newRecordUploading || newRecordSubmitting"
              @click="pickNewRecordPhotos"
            >
              選擇圖片
            </Button>
            <p
              v-if="newRecordUploading"
              class="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <Loader2 class="size-3.5 animate-spin" />
              上傳中…
            </p>
            <div v-else-if="newRecordAttachmentIds.length" class="flex flex-wrap gap-3 pt-1">
              <div
                v-for="aid in newRecordAttachmentIds"
                :key="aid"
                class="relative shrink-0"
              >
                <button
                  type="button"
                  class="relative size-20 overflow-hidden rounded-md border border-border bg-muted ring-offset-background transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="預覽"
                  @click="openImagePreview(aid)"
                >
                  <PhotoThumbnail :file-id="aid" />
                </button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  class="absolute -right-1.5 -top-1.5 size-6 rounded-full border border-border shadow-sm"
                  :disabled="newRecordSubmitting"
                  aria-label="移除此照片"
                  @click.stop="removeDraftAttachment(aid)"
                >
                  <X class="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
          <p v-if="newRecordError" class="text-sm text-destructive">{{ newRecordError }}</p>
        </div>
        <DialogFooter class="border-t border-border bg-muted/30 px-6 py-3 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            :disabled="newRecordSubmitting"
            @click="cancelNewRecordModal"
          >
            取消
          </Button>
          <Button type="button" size="sm" :disabled="newRecordSubmitting" @click="submitNewRecord">
            <Loader2 v-if="newRecordSubmitting" class="mr-2 size-4 animate-spin" />
            送出紀錄
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="imagePreviewOpen" @update:open="(v) => !v && closeImagePreview()">
      <DialogContent class="max-w-3xl border-border bg-card p-4">
        <DialogHeader>
          <DialogTitle>{{ imagePreviewTitle || '預覽' }}</DialogTitle>
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
