<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Loader2, Plus, Pencil, Trash2, ImageIcon } from 'lucide-vue-next'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getDefectImprovement,
  listDefectRecords,
  updateDefectImprovement,
  deleteDefectImprovement,
  createDefectRecord,
} from '@/api/defect-improvements'
import { uploadFile, getFileBlob } from '@/api/files'
import type { DefectItem, DefectExecutionRecordItem, DefectPriority, DefectStatus } from '@/types/defect-improvement'
import { ROUTE_NAME, ROUTE_PATH, buildProjectPath } from '@/constants/routes'

const route = useRoute()
const router = useRouter()

const projectId = computed(() => route.params.projectId as string)
const defectId = computed(() => route.params.defectId as string)

const listPath = computed(() => buildProjectPath(projectId.value, ROUTE_PATH.PROJECT_CONSTRUCTION_DEFECTS))

const loading = ref(true)
const defect = ref<DefectItem | null>(null)
const loadError = ref('')

const records = ref<DefectExecutionRecordItem[]>([])
const recordsLoading = ref(false)

const editOpen = ref(false)
const formDescription = ref('')
const formDiscoveredBy = ref('')
const formPriority = ref<DefectPriority>('medium')
const formFloor = ref('')
const formLocation = ref('')
const formStatus = ref<DefectStatus>('in_progress')
const formSubmitting = ref(false)
const formError = ref('')

const recordOpen = ref(false)
const recordContent = ref('')
const recordAttachmentIds = ref<string[]>([])
const recordSubmitting = ref(false)
const recordError = ref('')
const recordFileInputRef = ref<HTMLInputElement | null>(null)
const recordUploading = ref(false)

const removeOpen = ref(false)
const removing = ref(false)
const removeError = ref('')

const lightboxOpen = ref(false)
const lightboxUrl = ref<string | null>(null)

const PRIORITY_LABELS: Record<DefectPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

const STATUS_LABELS: Record<DefectStatus, string> = {
  in_progress: '進行中',
  completed: '已完成',
}

async function fetchDefect() {
  if (!projectId.value || !defectId.value) return
  loading.value = true
  loadError.value = ''
  try {
    defect.value = await getDefectImprovement(projectId.value, defectId.value)
    if (!defect.value) loadError.value = '找不到此筆缺失'
  } catch {
    defect.value = null
    loadError.value = '無法載入缺失資料'
  } finally {
    loading.value = false
  }
}

async function fetchRecords() {
  if (!projectId.value || !defectId.value) return
  recordsLoading.value = true
  try {
    records.value = await listDefectRecords(projectId.value, defectId.value)
  } catch {
    records.value = []
  } finally {
    recordsLoading.value = false
  }
}

watch([projectId, defectId], () => {
  fetchDefect()
  fetchRecords()
}, { immediate: true })

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

function openEdit() {
  const d = defect.value
  if (!d) return
  formDescription.value = d.description
  formDiscoveredBy.value = d.discoveredBy
  formPriority.value = d.priority
  formFloor.value = d.floor ?? ''
  formLocation.value = d.location ?? ''
  formStatus.value = d.status
  formError.value = ''
  editOpen.value = true
}

function closeEdit() {
  editOpen.value = false
}

async function submitEdit() {
  const desc = formDescription.value.trim()
  const by = formDiscoveredBy.value.trim()
  if (!desc) {
    formError.value = '請填寫問題說明'
    return
  }
  if (!by) {
    formError.value = '請填寫發現人'
    return
  }
  if (!projectId.value || !defectId.value) return
  formSubmitting.value = true
  formError.value = ''
  try {
    await updateDefectImprovement(projectId.value, defectId.value, {
      description: desc,
      discoveredBy: by,
      priority: formPriority.value,
      floor: formFloor.value.trim() || undefined,
      location: formLocation.value.trim() || undefined,
      status: formStatus.value,
    })
    closeEdit()
    await fetchDefect()
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    formError.value = ax.response?.data?.error?.message ?? '更新失敗'
  } finally {
    formSubmitting.value = false
  }
}

function openRecordDialog() {
  recordContent.value = ''
  recordAttachmentIds.value = []
  recordError.value = ''
  recordOpen.value = true
}

async function onRecordPhotosChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files?.length || !projectId.value) return
  recordUploading.value = true
  recordError.value = ''
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) continue
      const result = await uploadFile({
        file,
        projectId: projectId.value,
        category: 'defect_record',
      })
      recordAttachmentIds.value = [...recordAttachmentIds.value, result.id]
    }
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { error?: { message?: string } } } }
    recordError.value = ax.response?.data?.error?.message ?? '上傳失敗'
  } finally {
    recordUploading.value = false
    input.value = ''
  }
}

async function submitRecord() {
  const content = recordContent.value.trim()
  if (!content) {
    recordError.value = '請填寫紀錄內容'
    return
  }
  if (!projectId.value || !defectId.value) return
  recordSubmitting.value = true
  recordError.value = ''
  try {
    await createDefectRecord(projectId.value, defectId.value, {
      content,
      attachmentIds: recordAttachmentIds.value.length ? recordAttachmentIds.value : undefined,
    })
    recordOpen.value = false
    await fetchRecords()
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    recordError.value = ax.response?.data?.error?.message ?? '新增失敗'
  } finally {
    recordSubmitting.value = false
  }
}

function openRemove() {
  removeError.value = ''
  removeOpen.value = true
}

async function confirmRemove() {
  if (!projectId.value || !defectId.value) return
  removing.value = true
  removeError.value = ''
  try {
    await deleteDefectImprovement(projectId.value, defectId.value)
    removeOpen.value = false
    await router.push({
      name: ROUTE_NAME.PROJECT_CONSTRUCTION_DEFECTS,
      params: { projectId: projectId.value },
    })
  } catch {
    removeError.value = '刪除失敗，請稍後再試'
  } finally {
    removing.value = false
  }
}

async function previewAttachment(id: string) {
  try {
    const { blob } = await getFileBlob(id)
    if (lightboxUrl.value) URL.revokeObjectURL(lightboxUrl.value)
    lightboxUrl.value = URL.createObjectURL(blob)
    lightboxOpen.value = true
  } catch {
    /* ignore */
  }
}

function onLightboxOpen(v: boolean) {
  if (!v && lightboxUrl.value) {
    URL.revokeObjectURL(lightboxUrl.value)
    lightboxUrl.value = null
  }
  lightboxOpen.value = v
}

function recorderLabel(rec: DefectExecutionRecordItem) {
  return rec.recordedBy?.name || rec.recordedBy?.email || '—'
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <Button variant="outline" as-child>
        <RouterLink :to="listPath">返回列表</RouterLink>
      </Button>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Loader2 class="size-8 animate-spin" />
      <p class="mt-2 text-sm">載入中…</p>
    </div>

    <div v-else-if="loadError" class="rounded-lg border border-border bg-card p-6 text-center text-sm text-destructive">
      {{ loadError }}
    </div>

    <template v-else-if="defect">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold text-foreground">缺失詳情</h1>
        <div class="flex flex-wrap items-center gap-2">
          <Button variant="outline" @click="openEdit">
            <Pencil class="mr-2 size-4" />
            編輯
          </Button>
          <Button variant="outline" class="text-destructive hover:text-destructive" @click="openRemove">
            <Trash2 class="mr-2 size-4" />
            刪除
          </Button>
        </div>
      </div>

      <div class="rounded-lg border border-border bg-card p-6 space-y-6">
        <div>
          <h2 class="text-sm font-medium text-muted-foreground">問題說明</h2>
          <p class="mt-2 whitespace-pre-wrap text-sm text-foreground">{{ defect.description }}</p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h3 class="text-xs font-medium text-muted-foreground">發現人</h3>
            <p class="mt-1 text-sm text-foreground">{{ defect.discoveredBy }}</p>
          </div>
          <div>
            <h3 class="text-xs font-medium text-muted-foreground">優先度</h3>
            <p class="mt-1">
              <Badge variant="secondary" class="font-normal">
                {{ PRIORITY_LABELS[defect.priority] ?? defect.priority }}
              </Badge>
            </p>
          </div>
          <div>
            <h3 class="text-xs font-medium text-muted-foreground">狀態</h3>
            <p class="mt-1">
              <Badge
                :variant="defect.status === 'completed' ? 'default' : 'outline'"
                class="font-normal"
              >
                {{ STATUS_LABELS[defect.status] ?? defect.status }}
              </Badge>
            </p>
          </div>
          <div>
            <h3 class="text-xs font-medium text-muted-foreground">樓層</h3>
            <p class="mt-1 text-sm text-foreground">{{ defect.floor || '—' }}</p>
          </div>
          <div>
            <h3 class="text-xs font-medium text-muted-foreground">位置</h3>
            <p class="mt-1 text-sm text-foreground">{{ defect.location || '—' }}</p>
          </div>
          <div>
            <h3 class="text-xs font-medium text-muted-foreground">更新時間</h3>
            <p class="mt-1 text-sm tabular-nums text-muted-foreground">{{ formatDateTime(defect.updatedAt) }}</p>
          </div>
        </div>
        <div v-if="defect.photos?.length">
          <h3 class="text-xs font-medium text-muted-foreground">照片</h3>
          <div class="mt-2 flex flex-wrap gap-2">
            <Button
              v-for="p in defect.photos"
              :key="p.id"
              variant="outline"
              @click="previewAttachment(p.id)"
            >
              <ImageIcon class="mr-2 size-4" />
              <span class="max-w-[160px] truncate">{{ p.fileName }}</span>
            </Button>
          </div>
        </div>
      </div>

      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-foreground">執行紀錄</h2>
          <Button @click="openRecordDialog">
            <Plus class="mr-2 size-4" />
            新增紀錄
          </Button>
        </div>

        <div class="rounded-lg border border-border bg-card">
          <div v-if="recordsLoading" class="flex justify-center py-12 text-muted-foreground">
            <Loader2 class="size-8 animate-spin" />
          </div>
          <Table v-else-if="records.length > 0">
            <TableHeader>
              <TableRow>
                <TableHead class="w-[180px]">時間</TableHead>
                <TableHead>紀錄內容</TableHead>
                <TableHead class="w-[140px]">紀錄人</TableHead>
                <TableHead class="w-[120px]">照片</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="rec in records" :key="rec.id">
                <TableCell class="tabular-nums text-muted-foreground">
                  {{ formatDateTime(rec.createdAt) }}
                </TableCell>
                <TableCell class="whitespace-pre-wrap text-sm text-foreground">
                  {{ rec.content }}
                </TableCell>
                <TableCell class="text-sm text-foreground">
                  {{ recorderLabel(rec) }}
                </TableCell>
                <TableCell>
                  <span v-if="!rec.photos?.length" class="text-sm text-muted-foreground">—</span>
                  <Button
                    v-else
                    variant="ghost"
                    class="h-auto px-2 py-1 text-primary"
                    @click="previewAttachment(rec.photos![0].id)"
                  >
                    {{ rec.photos!.length }} 張
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div v-else class="py-12 text-center text-sm text-muted-foreground">
            尚無執行紀錄
          </div>
        </div>
      </div>
    </template>

    <Dialog v-model:open="editOpen" @update:open="(v: boolean) => !v && closeEdit()">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>編輯缺失</DialogTitle>
          <DialogDescription>更新問題說明、發現人、優先度與狀態。</DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
          <div class="space-y-2">
            <Label for="edit-desc">問題說明 <span class="text-destructive">*</span></Label>
            <textarea
              id="edit-desc"
              v-model="formDescription"
              rows="3"
              class="border-input focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[80px] w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            />
          </div>
          <div class="space-y-2">
            <Label for="edit-by">發現人 <span class="text-destructive">*</span></Label>
            <input
              id="edit-by"
              v-model="formDiscoveredBy"
              type="text"
              class="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label>優先度</Label>
              <Select v-model="formPriority">
                <SelectTrigger class="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">低</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label>狀態</Label>
              <Select v-model="formStatus">
                <SelectTrigger class="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">進行中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label for="edit-floor">樓層</Label>
              <input
                id="edit-floor"
                v-model="formFloor"
                type="text"
                class="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
              />
            </div>
            <div class="space-y-2">
              <Label for="edit-loc">位置</Label>
              <input
                id="edit-loc"
                v-model="formLocation"
                type="text"
                class="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="closeEdit">取消</Button>
          <Button :disabled="formSubmitting" @click="submitEdit">
            <Loader2 v-if="formSubmitting" class="mr-2 size-4 animate-spin" />
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="recordOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新增執行紀錄</DialogTitle>
          <DialogDescription>填寫處理內容，可附照片。</DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <p v-if="recordError" class="text-sm text-destructive">{{ recordError }}</p>
          <div class="space-y-2">
            <Label for="rec-content">紀錄內容 <span class="text-destructive">*</span></Label>
            <textarea
              id="rec-content"
              v-model="recordContent"
              rows="4"
              class="border-input flex min-h-[100px] w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div class="space-y-2">
            <Label>照片（選填）</Label>
            <input
              ref="recordFileInputRef"
              type="file"
              accept="image/*"
              multiple
              class="sr-only"
              @change="onRecordPhotosChange"
            />
            <Button type="button" variant="outline" :disabled="recordUploading" @click="recordFileInputRef?.click()">
              {{ recordUploading ? '上傳中…' : '選擇圖片' }}
            </Button>
            <span v-if="recordAttachmentIds.length" class="ml-2 text-xs text-muted-foreground">
              已選 {{ recordAttachmentIds.length }} 張
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="recordOpen = false">取消</Button>
          <Button :disabled="recordSubmitting" @click="submitRecord">
            <Loader2 v-if="recordSubmitting" class="mr-2 size-4 animate-spin" />
            送出
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="removeOpen" @update:open="(v) => (removeOpen = v)">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>刪除缺失</DialogTitle>
          <DialogDescription>確定刪除？執行紀錄與照片將一併移除，無法復原。</DialogDescription>
        </DialogHeader>
        <p v-if="removeError" class="text-sm text-destructive">{{ removeError }}</p>
        <DialogFooter>
          <Button variant="outline" @click="removeOpen = false">取消</Button>
          <Button variant="destructive" :disabled="removing" @click="confirmRemove">
            {{ removing ? '刪除中…' : '刪除' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="lightboxOpen" @update:open="onLightboxOpen">
      <DialogContent class="max-w-4xl border-none bg-transparent p-0 shadow-none">
        <img
          v-if="lightboxUrl"
          :src="lightboxUrl"
          alt=""
          class="max-h-[85vh] w-full rounded-lg object-contain"
        />
      </DialogContent>
    </Dialog>
  </div>
</template>
