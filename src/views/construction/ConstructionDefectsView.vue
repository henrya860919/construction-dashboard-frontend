<script setup lang="ts">
import type { ColumnDef, FilterFn } from '@tanstack/vue-table'
import { computed, h, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
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
import DataTableColumnHeader from '@/components/common/data-table/DataTableColumnHeader.vue'
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTableFeatureToolbar from '@/components/common/data-table/DataTableFeatureToolbar.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import { useClientDataTable } from '@/composables/useClientDataTable'
import {
  listAllDefectImprovements,
  getDefectImprovement,
  createDefectImprovement,
  updateDefectImprovement,
  deleteDefectImprovement,
} from '@/api/defect-improvements'
import { uploadFile } from '@/api/files'
import type { DefectItem, DefectPriority, DefectStatus } from '@/types/defect-improvement'
import type { TableListFeatures } from '@/types/data-table'
import { Plus, Loader2, ClipboardList, CircleDot, CheckCircle2 } from 'lucide-vue-next'
import StateCard from '@/components/common/StateCard.vue'
import ConstructionDefectsRowActions from '@/views/construction/ConstructionDefectsRowActions.vue'
import { ROUTE_NAME } from '@/constants/routes'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { ensureProjectPermission } from '@/lib/permission-toast'

const route = useRoute()
const router = useRouter()

const projectId = computed(() => (route.params.projectId as string) ?? '')
const defectPerm = useProjectModuleActions(projectId, 'construction.defect')

const list = ref<DefectItem[]>([])
const loading = ref(true)
const errorMessage = ref('')

/** 全文搜尋 + 狀態／優先度分面 + 更新時間區間；無欄位顯示開關；表頭可排序（更新時間） */
const TABLE_FEATURES: TableListFeatures = {
  search: true,
  filtersAndSort: true,
  columnVisibility: false,
}

const COLUMN_LABELS: Record<string, string> = {
  description: '問題說明',
  discoveredBy: '發現人',
  priority: '優先度',
  floor: '樓層',
  location: '位置',
  status: '狀態',
  updatedAt: '更新時間',
}

const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingItem = ref<DefectItem | null>(null)
const formDescription = ref('')
const formDiscoveredBy = ref('')
const formPriority = ref<DefectPriority>('medium')
const formFloor = ref('')
const formLocation = ref('')
const formStatus = ref<DefectStatus>('in_progress')
const formAttachmentIds = ref<string[]>([])
const formSubmitting = ref(false)
const formError = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

const removeDialogOpen = ref(false)
const removingItem = ref<DefectItem | null>(null)
const removing = ref(false)

const batchDeleteOpen = ref(false)
const batchDeleteLoading = ref(false)

const PRIORITY_LABELS: Record<DefectPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

const STATUS_LABELS: Record<DefectStatus, string> = {
  in_progress: '進行中',
  completed: '已完成',
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

function defectUpdatedDateOnly(iso: string): string {
  return iso.slice(0, 10)
}

const defectsGlobalFilterFn: FilterFn<DefectItem> = (row, _columnId, filterValue) => {
  const q = String(filterValue ?? '')
    .trim()
    .toLowerCase()
  if (!q) return true
  const r = row.original
  const parts = [
    r.description,
    r.discoveredBy,
    PRIORITY_LABELS[r.priority] ?? r.priority,
    r.floor ?? '',
    r.location ?? '',
    STATUS_LABELS[r.status] ?? r.status,
    r.updatedAt.toLowerCase(),
    formatDateTime(r.updatedAt).toLowerCase(),
    r.createdAt.toLowerCase(),
    formatDateTime(r.createdAt).toLowerCase(),
  ].map((s) => String(s).toLowerCase())
  return parts.some((p) => p.includes(q))
}

async function load() {
  if (!projectId.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    list.value = await listAllDefectImprovements(projectId.value)
  } catch {
    list.value = []
    errorMessage.value = '無法載入缺失改善列表'
  } finally {
    loading.value = false
  }
}

const statsTotal = computed(() => list.value.length)
const statsInProgress = computed(() => list.value.filter((d) => d.status === 'in_progress').length)
const statsCompleted = computed(() => list.value.filter((d) => d.status === 'completed').length)

function openCreateDialog() {
  if (!ensureProjectPermission(defectPerm.canCreate.value, 'create')) return
  formMode.value = 'create'
  editingItem.value = null
  formDescription.value = ''
  formDiscoveredBy.value = ''
  formPriority.value = 'medium'
  formFloor.value = ''
  formLocation.value = ''
  formStatus.value = 'in_progress'
  formAttachmentIds.value = []
  formError.value = ''
  formOpen.value = true
}

async function openEditDialog(row: DefectItem) {
  formMode.value = 'edit'
  editingItem.value = row
  formError.value = ''
  formOpen.value = true
  const full = await getDefectImprovement(projectId.value, row.id)
  if (full) {
    formDescription.value = full.description
    formDiscoveredBy.value = full.discoveredBy
    formPriority.value = full.priority
    formFloor.value = full.floor ?? ''
    formLocation.value = full.location ?? ''
    formStatus.value = full.status
  } else {
    formDescription.value = row.description
    formDiscoveredBy.value = row.discoveredBy
    formPriority.value = row.priority
    formFloor.value = row.floor ?? ''
    formLocation.value = row.location ?? ''
    formStatus.value = row.status
  }
  formAttachmentIds.value = []
}

function closeFormDialog() {
  formOpen.value = false
  editingItem.value = null
}

async function onFormPhotosChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files?.length || !projectId.value) return
  uploading.value = true
  formError.value = ''
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) continue
      const result = await uploadFile({
        file,
        projectId: projectId.value,
        category: 'defect',
      })
      formAttachmentIds.value = [...formAttachmentIds.value, result.id]
    }
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { error?: { message?: string } } } }
    formError.value = ax.response?.data?.error?.message ?? '上傳失敗'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function goView(row: DefectItem) {
  if (!ensureProjectPermission(defectPerm.canRead.value, 'read')) return
  router.push({
    name: ROUTE_NAME.PROJECT_CONSTRUCTION_DEFECT_DETAIL,
    params: { projectId: projectId.value, defectId: row.id },
  })
}

function openRemoveDialog(row: DefectItem) {
  removingItem.value = row
  removeDialogOpen.value = true
}

function closeRemoveDialog() {
  removeDialogOpen.value = false
  removingItem.value = null
}

const selectColumn: ColumnDef<DefectItem, unknown> = {
  id: 'select',
  header: ({ table }) =>
    h(Checkbox, {
      checked: table.getIsAllPageRowsSelected()
        ? true
        : table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : false,
      'onUpdate:checked': (v: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!v),
      'aria-label': '全選',
    }),
  cell: ({ row }) =>
    h(Checkbox, {
      checked: row.getIsSelected(),
      'onUpdate:checked': (v: boolean | 'indeterminate') => row.toggleSelected(!!v),
      'aria-label': '選取此列',
    }),
  enableSorting: false,
  enableHiding: false,
}

const columns = computed<ColumnDef<DefectItem, unknown>[]>(() => [
  selectColumn,
  {
    accessorKey: 'description',
    id: 'description',
    header: () => '問題說明',
    cell: ({ row }) =>
      h(
        'div',
        { class: 'max-w-[240px] truncate text-foreground', title: row.original.description },
        row.original.description || '—'
      ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'discoveredBy',
    id: 'discoveredBy',
    header: () => '發現人',
    cell: ({ row }) => h('div', { class: 'text-foreground' }, row.original.discoveredBy),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'priority',
    id: 'priority',
    header: () => '優先度',
    meta: {
      label: '優先度',
      filter: {
        type: 'faceted',
        title: '優先度',
        options: [
          { label: '低', value: 'low' },
          { label: '中', value: 'medium' },
          { label: '高', value: 'high' },
        ],
      },
    },
    filterFn: 'arrIncludesSome',
    cell: ({ row }) =>
      h(
        Badge,
        { variant: 'secondary', class: 'font-normal' },
        () => PRIORITY_LABELS[row.original.priority] ?? row.original.priority
      ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'floor',
    id: 'floor',
    header: () => '樓層',
    cell: ({ row }) => h('div', { class: 'text-muted-foreground' }, row.original.floor || '—'),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'location',
    id: 'location',
    header: () => '位置',
    cell: ({ row }) =>
      h(
        'div',
        {
          class: 'max-w-[140px] truncate text-muted-foreground',
          title: row.original.location ?? '',
        },
        row.original.location || '—'
      ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'status',
    id: 'status',
    header: () => '狀態',
    meta: {
      label: '狀態',
      filter: {
        type: 'faceted',
        title: '狀態',
        options: [
          { label: '進行中', value: 'in_progress' },
          { label: '已完成', value: 'completed' },
        ],
      },
    },
    filterFn: 'arrIncludesSome',
    cell: ({ row }) =>
      h(
        Badge,
        {
          variant: row.original.status === 'completed' ? 'default' : 'outline',
          class: 'font-normal',
        },
        () => STATUS_LABELS[row.original.status] ?? row.original.status
      ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'updatedAt',
    id: 'updatedAt',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column,
        title: '更新時間',
        class: 'text-foreground',
      }),
    meta: {
      label: '更新時間',
      filter: { type: 'dateRange', title: '更新時間' },
    },
    filterFn: (row, _columnId, raw) => {
      const v = raw as { from?: string; to?: string } | undefined
      if (!v?.from && !v?.to) return true
      const day = defectUpdatedDateOnly(row.original.updatedAt)
      if (v.from && day < v.from) return false
      if (v.to && day > v.to) return false
      return true
    },
    sortingFn: 'alphanumeric',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'tabular-nums text-muted-foreground' },
        formatDateTime(row.original.updatedAt)
      ),
    enableHiding: false,
  },
  {
    id: 'actions',
    header: () => '',
    cell: ({ row }) =>
      h(ConstructionDefectsRowActions, {
        row: row.original,
        canEdit: defectPerm.canUpdate.value,
        canRemove: defectPerm.canDelete.value,
        onView: goView,
        onEdit: openEditDialog,
        onRemove: openRemoveDialog,
      }),
    enableSorting: false,
    enableHiding: false,
  },
])

const { table, globalFilter, hasActiveFilters, resetTableState } = useClientDataTable({
  data: list,
  columns,
  features: TABLE_FEATURES,
  getRowId: (row) => row.id,
  globalFilterFn: defectsGlobalFilterFn,
  initialPageSize: 20,
})

async function submitForm() {
  if (formMode.value === 'create') {
    if (!ensureProjectPermission(defectPerm.canCreate.value, 'create')) return
  } else if (editingItem.value) {
    if (!ensureProjectPermission(defectPerm.canUpdate.value, 'change')) return
  }
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
  const pid = projectId.value
  if (!pid) return
  formSubmitting.value = true
  formError.value = ''
  try {
    if (formMode.value === 'create') {
      await createDefectImprovement(pid, {
        description: desc,
        discoveredBy: by,
        priority: formPriority.value,
        floor: formFloor.value.trim() || undefined,
        location: formLocation.value.trim() || undefined,
        status: formStatus.value,
        attachmentIds: formAttachmentIds.value.length ? formAttachmentIds.value : undefined,
      })
    } else if (editingItem.value) {
      await updateDefectImprovement(pid, editingItem.value.id, {
        description: desc,
        discoveredBy: by,
        priority: formPriority.value,
        floor: formFloor.value.trim() || undefined,
        location: formLocation.value.trim() || undefined,
        status: formStatus.value,
      })
    }
    closeFormDialog()
    table.setRowSelection({})
    await load()
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { error?: { message?: string } } } }
    formError.value = ax.response?.data?.error?.message ?? '儲存失敗'
  } finally {
    formSubmitting.value = false
  }
}

async function confirmRemove() {
  const item = removingItem.value
  if (!item) return
  removing.value = true
  errorMessage.value = ''
  try {
    await deleteDefectImprovement(projectId.value, item.id)
    closeRemoveDialog()
    table.setRowSelection({})
    await load()
  } catch {
    errorMessage.value = '刪除失敗'
  } finally {
    removing.value = false
  }
}

const selectedRows = computed(() => table.getSelectedRowModel().rows)
const hasSelection = computed(() => selectedRows.value.length > 0)
const selectedCount = computed(() => selectedRows.value.length)

function clearSelection() {
  table.setRowSelection({})
}

function openBatchDelete() {
  batchDeleteOpen.value = true
}

function closeBatchDelete() {
  batchDeleteOpen.value = false
}

async function confirmBatchDelete() {
  const rows = selectedRows.value.map((r) => r.original)
  if (!rows.length) return
  batchDeleteLoading.value = true
  errorMessage.value = ''
  try {
    for (const item of rows) {
      await deleteDefectImprovement(projectId.value, item.id)
    }
    closeBatchDelete()
    table.setRowSelection({})
    await load()
  } catch {
    errorMessage.value = '批次刪除失敗'
  } finally {
    batchDeleteLoading.value = false
  }
}

watch(
  projectId,
  (id) => {
    if (!id) {
      list.value = []
      loading.value = false
      return
    }
    resetTableState()
    void load()
  },
  { immediate: true }
)

const defectsEmptyText = computed(() => {
  if (!projectId.value) return '缺少專案 ID'
  const q = globalFilter.value.trim()
  if (list.value.length === 0) {
    return q
      ? '沒有符合條件的資料'
      : '尚無缺失紀錄，可點「新增缺失」或於手機現場建立。'
  }
  return '沒有符合條件的資料'
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">缺失改善</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        檢視與管理專案缺失紀錄；可於手機現場新增照片與執行紀錄，此處可統籌列表與狀態。支援全文搜尋，並可篩選狀態、優先度與更新時間區間。
      </p>
    </div>

    <div v-if="!defectPerm.canRead.value" class="text-sm text-muted-foreground">
      您沒有缺失改善檢視權限（<code class="rounded bg-muted px-1 py-0.5 text-xs"
        >construction.defect</code
      >）。
    </div>

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StateCard title="總筆數">
          <template #icon>
            <ClipboardList class="size-6 text-muted-foreground" />
          </template>
          <p v-if="loading" class="text-3xl font-bold tabular-nums text-muted-foreground">…</p>
          <p v-else class="text-3xl font-bold tabular-nums text-foreground">
            {{ statsTotal }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">本專案缺失改善總數（載入後統計）</p>
        </StateCard>
        <StateCard title="進行中">
          <template #icon>
            <CircleDot class="size-6 text-muted-foreground" />
          </template>
          <p v-if="loading" class="text-3xl font-bold tabular-nums text-muted-foreground">…</p>
          <p v-else class="text-3xl font-bold tabular-nums text-foreground">
            {{ statsInProgress }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">狀態為進行中</p>
        </StateCard>
        <StateCard title="已完成">
          <template #icon>
            <CheckCircle2 class="size-6 text-muted-foreground" />
          </template>
          <p v-if="loading" class="text-3xl font-bold tabular-nums text-muted-foreground">…</p>
          <p v-else class="text-3xl font-bold tabular-nums text-foreground">
            {{ statsCompleted }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">狀態為已完成</p>
        </StateCard>
      </div>

      <DataTableFeatureToolbar
        v-if="!loading && projectId"
        :table="table"
        :features="TABLE_FEATURES"
        :column-labels="COLUMN_LABELS"
        :has-active-filters="hasActiveFilters"
        :global-filter="globalFilter"
        search-placeholder="搜尋問題說明、發現人、樓層、位置、狀態、優先度、時間…"
        @reset="resetTableState"
      >
        <template #actions>
          <div class="flex flex-wrap items-center justify-end gap-3">
            <template v-if="hasSelection">
              <span class="text-sm text-muted-foreground">已選 {{ selectedCount }} 項</span>
              <ButtonGroup>
                <Button variant="outline" size="sm" @click="clearSelection">取消選取</Button>
                <Button
                  v-if="defectPerm.canDelete.value"
                  variant="outline"
                  size="sm"
                  class="text-destructive hover:text-destructive"
                  @click="openBatchDelete"
                >
                  批次刪除
                </Button>
              </ButtonGroup>
            </template>
            <Button
              v-if="defectPerm.canCreate.value && !hasSelection"
              size="sm"
              class="gap-2"
              @click="openCreateDialog"
            >
              <Plus class="size-4" />
              新增缺失
            </Button>
          </div>
        </template>
      </DataTableFeatureToolbar>

      <div class="rounded-lg border border-border bg-card">
        <p v-if="errorMessage" class="mb-3 px-4 pt-4 text-sm text-destructive">{{ errorMessage }}</p>
        <div v-else-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 class="size-8 animate-spin" />
        </div>
        <DataTableFeatureSection v-else :table="table" :empty-text="defectsEmptyText" />
      </div>
      <div
        v-if="!loading && !errorMessage && list.length > 0"
        class="mt-4"
      >
        <DataTablePagination :table="table" />
      </div>
    </template>

    <Dialog v-model:open="formOpen" @update:open="(v: boolean) => !v && closeFormDialog()">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ formMode === 'create' ? '新增缺失' : '編輯缺失' }}</DialogTitle>
          <DialogDescription>
            填寫問題說明、發現人、優先度與位置；新增時可上傳照片（手機現場亦同）。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
          <div class="space-y-2">
            <Label for="defect-desc">問題說明 <span class="text-destructive">*</span></Label>
            <textarea
              id="defect-desc"
              v-model="formDescription"
              rows="3"
              placeholder="請描述問題"
              class="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[80px] w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:opacity-50"
            />
          </div>
          <div class="space-y-2">
            <Label for="defect-by">發現人 <span class="text-destructive">*</span></Label>
            <input
              id="defect-by"
              v-model="formDiscoveredBy"
              type="text"
              class="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              placeholder="姓名"
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
              <Label for="defect-floor">樓層</Label>
              <input
                id="defect-floor"
                v-model="formFloor"
                type="text"
                class="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              />
            </div>
            <div class="space-y-2">
              <Label for="defect-loc">位置</Label>
              <input
                id="defect-loc"
                v-model="formLocation"
                type="text"
                class="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              />
            </div>
          </div>
          <div v-if="formMode === 'create'" class="space-y-2">
            <Label>照片（選填）</Label>
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              multiple
              class="sr-only"
              @change="onFormPhotosChange"
            />
            <div class="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                :disabled="uploading"
                @click="fileInputRef?.click()"
              >
                {{ uploading ? '上傳中…' : '選擇圖片' }}
              </Button>
              <span v-if="formAttachmentIds.length" class="text-xs text-muted-foreground">
                已選 {{ formAttachmentIds.length }} 張
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="closeFormDialog">取消</Button>
          <Button :disabled="formSubmitting" @click="submitForm">
            <Loader2 v-if="formSubmitting" class="mr-2 size-4 animate-spin" />
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      v-model:open="removeDialogOpen"
      @update:open="(v: boolean) => !v && closeRemoveDialog()"
    >
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>刪除缺失</DialogTitle>
          <DialogDescription> 確定刪除此筆缺失？執行紀錄一併刪除且無法復原。 </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="closeRemoveDialog">取消</Button>
          <Button variant="destructive" :disabled="removing" @click="confirmRemove">
            {{ removing ? '刪除中…' : '刪除' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="batchDeleteOpen" @update:open="(v: boolean) => !v && closeBatchDelete()">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批次刪除</DialogTitle>
          <DialogDescription>
            確定刪除已選的 {{ selectedCount }} 筆缺失？無法復原。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="closeBatchDelete">取消</Button>
          <Button variant="destructive" :disabled="batchDeleteLoading" @click="confirmBatchDelete">
            {{ batchDeleteLoading ? '刪除中…' : '刪除' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
