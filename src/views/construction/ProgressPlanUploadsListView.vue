<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import {
  Loader2,
  Download,
  FileSpreadsheet,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  deleteProgressPlan,
  downloadProgressPlanExcelTemplate,
  getProgressDashboard,
  listProgressPlanUploads,
  patchProgressPlanEffective,
  type ProgressPlanUploadListItemDto,
} from '@/api/project-progress'
import { getFileBlob } from '@/api/files'
import { buildProjectPath, ROUTE_PATH } from '@/constants/routes'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { getApiErrorMessage } from '@/lib/api-error'
import { toast } from '@/components/ui/sonner'
import type { ProgressPeriodDto } from '@/types/project-progress'

const props = withDefaults(
  defineProps<{
    /** 嵌於「進度管理」分頁時隱藏頁級標題與返回連結 */
    embedded?: boolean
  }>(),
  { embedded: false }
)

const route = useRoute()
const projectId = computed(() => (route.params.projectId as string) ?? '')
const perm = useProjectModuleActions(projectId, 'construction.progress')

const list = ref<ProgressPlanUploadListItemDto[]>([])
const periods = ref<ProgressPeriodDto[]>([])
const loading = ref(true)
const downloadingId = ref<string | null>(null)
const downloadingTemplate = ref(false)

const effectiveDialogOpen = ref(false)
const editRow = ref<ProgressPlanUploadListItemDto | null>(null)
const editEffectiveDate = ref('')
const savingEffective = ref(false)

const deleteOpen = ref(false)
const deleteTarget = ref<ProgressPlanUploadListItemDto | null>(null)
const deleteLoading = ref(false)

const progressPath = computed(() =>
  buildProjectPath(projectId.value, ROUTE_PATH.PROJECT_CONSTRUCTION_PROGRESS)
)

const rootClass = computed(() =>
  props.embedded ? 'space-y-4' : 'space-y-4 p-4 md:p-6'
)

function shortDate(iso: string) {
  const p = iso.split('-')
  if (p.length < 3) return iso
  return `${p[1]}-${p[2]}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function canEditEffective(row: ProgressPlanUploadListItemDto): boolean {
  return Boolean(perm.canUpdate.value && row.planId && row.planIsBaseline === false)
}

function canDeleteRow(row: ProgressPlanUploadListItemDto): boolean {
  return Boolean(perm.canDelete.value && row.planId)
}

function openDeleteDialog(row: ProgressPlanUploadListItemDto) {
  deleteTarget.value = row
  deleteOpen.value = true
}

function closeDeleteDialog() {
  deleteOpen.value = false
  deleteTarget.value = null
}

async function confirmDeletePlan() {
  const row = deleteTarget.value
  if (!projectId.value || !row?.planId) return
  deleteLoading.value = true
  try {
    await deleteProgressPlan(projectId.value, row.planId)
    toast.success('已刪除此進度計畫版本')
    closeDeleteDialog()
    await load()
  } catch (e) {
    toast.error('刪除失敗', { description: getApiErrorMessage(e) })
  } finally {
    deleteLoading.value = false
  }
}

function openEffectiveDialog(row: ProgressPlanUploadListItemDto) {
  editRow.value = row
  editEffectiveDate.value =
    row.effectiveFromDate ?? periods.value[0]?.periodDate ?? ''
  effectiveDialogOpen.value = true
}

async function saveEffective() {
  const row = editRow.value
  if (!projectId.value || !row?.planId) return
  const p = periods.value.find((x) => x.periodDate === editEffectiveDate.value)
  if (!p) {
    toast.error('請選擇變更生效之週期')
    return
  }
  savingEffective.value = true
  try {
    await patchProgressPlanEffective(projectId.value, row.planId, {
      effectiveFromDate: p.periodDate,
      effectiveFromIdx: p.periodIndex,
    })
    toast.success('已更新變更生效時間')
    effectiveDialogOpen.value = false
    editRow.value = null
    await loadList()
  } catch (e) {
    toast.error('更新失敗', { description: getApiErrorMessage(e) })
  } finally {
    savingEffective.value = false
  }
}

async function loadList() {
  if (!projectId.value) return
  try {
    list.value = await listProgressPlanUploads(projectId.value)
  } catch {
    list.value = []
    toast.error('無法載入上傳紀錄')
  }
}

async function loadPeriods() {
  if (!projectId.value) return
  try {
    const dash = await getProgressDashboard(projectId.value)
    periods.value = dash.periods ?? []
  } catch {
    periods.value = []
  }
}

async function load() {
  if (!projectId.value) return
  loading.value = true
  try {
    await Promise.all([loadList(), loadPeriods()])
  } finally {
    loading.value = false
  }
}

async function downloadTemplateFile() {
  if (!projectId.value || downloadingTemplate.value) return
  downloadingTemplate.value = true
  try {
    await downloadProgressPlanExcelTemplate(projectId.value)
    toast.success('已下載樣板')
  } catch (e) {
    toast.error('下載樣板失敗', { description: getApiErrorMessage(e) })
  } finally {
    downloadingTemplate.value = false
  }
}

async function downloadRow(row: ProgressPlanUploadListItemDto) {
  if (downloadingId.value) return
  downloadingId.value = row.attachmentId
  try {
    const { blob, fileName: name } = await getFileBlob(row.attachmentId, {
      download: true,
      fileName: row.fileName,
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.error('下載失敗')
  } finally {
    downloadingId.value = null
  }
}

onMounted(load)
</script>

<template>
  <div :class="rootClass">
    <div v-if="!embedded">
      <h1 class="text-xl font-semibold tracking-tight text-foreground">進度表上傳紀錄</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        建立計畫版本時一併保存的 Excel；可下載備查。變更版本可調整「變更生效時間」（對齊進度圖表虛線）；原始計畫無此欄位。有刪除權限者可刪除變更版本（軟刪除）；若尚有變更版本，須先刪除後才可刪除原始計畫。
      </p>
    </div>
    <p v-else class="text-sm text-muted-foreground">
      建立計畫版本時一併保存的 Excel；可下載備查。變更版本可調整「變更生效時間」（對齊進度圖表虛線）；原始計畫無此欄位。有刪除權限者可刪除變更版本（軟刪除）；若尚有變更版本，須先刪除後才可刪除原始計畫。
    </p>

    <div v-if="!perm.canRead" class="text-sm text-muted-foreground">
      您沒有進度管理檢視權限。
    </div>

    <template v-else>
      <div v-if="!embedded" class="flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="outline"
          :disabled="downloadingTemplate"
          @click="downloadTemplateFile"
        >
          <Download
            class="size-4"
            :class="{ 'animate-pulse': downloadingTemplate }"
            aria-hidden="true"
          />
          {{ downloadingTemplate ? '下載中…' : '下載 Excel 樣板' }}
        </Button>
        <Button variant="outline" as-child>
          <RouterLink :to="progressPath">返回進度管理</RouterLink>
        </Button>
      </div>
      <div v-else class="flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="outline"
          :disabled="downloadingTemplate"
          @click="downloadTemplateFile"
        >
          <Download
            class="size-4"
            :class="{ 'animate-pulse': downloadingTemplate }"
            aria-hidden="true"
          />
          {{ downloadingTemplate ? '下載中…' : '下載 Excel 樣板' }}
        </Button>
      </div>

      <div
        class="min-w-0 overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-card p-4"
      >
        <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 class="size-8 animate-spin" />
        </div>
        <template v-else>
          <Table :scroll-container="false">
            <TableHeader>
              <TableRow>
                <TableHead class="w-10" />
                <TableHead>檔名</TableHead>
                <TableHead>版本</TableHead>
                <TableHead>變更生效時間</TableHead>
                <TableHead>檔案大小</TableHead>
                <TableHead>上傳者</TableHead>
                <TableHead>上傳時間</TableHead>
                <TableHead class="w-28 text-end">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="list.length === 0">
                <TableCell colspan="8" class="h-24 text-center text-muted-foreground">
                  尚無上傳紀錄。請在「進度管理」建立原始計畫或變更版本時上傳 Excel。
                </TableCell>
              </TableRow>
              <TableRow v-for="row in list" :key="row.attachmentId">
                <TableCell class="align-middle">
                  <FileSpreadsheet class="size-4 text-muted-foreground" aria-hidden="true" />
                </TableCell>
                <TableCell
                  class="max-w-[200px] truncate font-medium text-foreground"
                  :title="row.fileName"
                >
                  {{ row.fileName }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  <template v-if="row.planLabel != null && row.planVersion != null">
                    {{ row.planLabel }}（v{{ row.planVersion }}）{{
                      row.planIsBaseline ? ' · 原始' : ''
                    }}
                  </template>
                  <span v-else>—</span>
                </TableCell>
                <TableCell class="text-muted-foreground">
                  <template v-if="row.planIsBaseline === true">
                    <span>—</span>
                  </template>
                  <template v-else-if="!row.planId">
                    <span>—</span>
                  </template>
                  <template v-else>
                    <div class="flex flex-wrap items-center gap-2">
                      <span
                        v-if="row.effectiveFromDate"
                        class="tabular-nums"
                        :title="row.effectiveFromDate"
                      >
                        {{ row.effectiveFromDate }}（{{ shortDate(row.effectiveFromDate) }}）
                      </span>
                      <span v-else class="text-muted-foreground">—</span>
                      <Button
                        v-if="canEditEffective(row)"
                        variant="outline"
                        class="h-7 gap-1 px-2"
                        type="button"
                        @click="openEffectiveDialog(row)"
                      >
                        <Pencil class="size-3.5" />
                        變更
                      </Button>
                    </div>
                  </template>
                </TableCell>
                <TableCell class="tabular-nums text-muted-foreground">{{
                  formatSize(row.fileSize)
                }}</TableCell>
                <TableCell class="text-muted-foreground">{{ row.uploaderName ?? '—' }}</TableCell>
                <TableCell class="tabular-nums text-muted-foreground">{{
                  formatDate(row.createdAt)
                }}</TableCell>
                <TableCell class="text-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" :aria-label="`操作 ${row.fileName}`">
                        <MoreHorizontal class="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-44">
                      <DropdownMenuItem
                        class="cursor-pointer gap-2"
                        :disabled="downloadingId === row.attachmentId"
                        @click="downloadRow(row)"
                      >
                        <Loader2
                          v-if="downloadingId === row.attachmentId"
                          class="size-4 animate-spin"
                        />
                        <Download v-else class="size-4" />
                        下載
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        v-if="canDeleteRow(row)"
                        class="cursor-pointer gap-2 text-destructive focus:text-destructive"
                        @click="openDeleteDialog(row)"
                      >
                        <Trash2 class="size-4" />
                        刪除紀錄
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </template>
      </div>
    </template>

    <AlertDialog :open="deleteOpen" @update:open="(v: boolean) => !v && closeDeleteDialog()">
      <AlertDialogContent class="border-border bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>刪除此進度計畫版本？</AlertDialogTitle>
          <AlertDialogDescription>
            將軟刪除「{{ deleteTarget?.planLabel ?? deleteTarget?.fileName }}」及其週期資料與此筆上傳檔案。原始計畫若仍有變更版本存在，請先刪除所有變更版本後再刪除原始計畫。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleteLoading">取消</AlertDialogCancel>
          <Button variant="destructive" :disabled="deleteLoading" @click="confirmDeletePlan">
            <Loader2 v-if="deleteLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog v-model:open="effectiveDialogOpen">
      <DialogContent class="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>變更生效時間</DialogTitle>
        </DialogHeader>
        <p class="text-sm text-muted-foreground">
          選擇此變更版本在進度圖表上對齊之週期（與「進度管理」新增變更時之生效日期相同語意）。
        </p>
        <div v-if="!periods.length" class="py-2 text-sm text-destructive">
          無法載入專案週期列表，請確認進度管理已有原始計畫後再試。
        </div>
        <div v-else class="space-y-2">
          <Label>週期（時間區間）</Label>
          <Select v-model="editEffectiveDate">
            <SelectTrigger class="w-full border-border bg-background">
              <SelectValue placeholder="選擇週期" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="p in periods"
                :key="`${p.periodDate}-${p.periodIndex}`"
                :value="p.periodDate"
              >
                {{ p.periodDate }}（{{ shortDate(p.periodDate) }}）
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            :disabled="savingEffective"
            @click="effectiveDialogOpen = false"
          >
            取消
          </Button>
          <Button
            type="button"
            :disabled="savingEffective || !periods.length"
            @click="saveEffective"
          >
            <Loader2 v-if="savingEffective" class="mr-2 size-4 animate-spin" />
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
