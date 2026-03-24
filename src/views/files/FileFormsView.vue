<script setup lang="ts">
import type { ColumnDef, FilterFn } from '@tanstack/vue-table'
import { ref, computed, watch, onMounted, h } from 'vue'
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import FileFormsRowActions from '@/views/files/FileFormsRowActions.vue'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { ensureProjectPermission } from '@/lib/permission-toast'
import {
  listProjectFormTemplates,
  createProjectFormTemplate,
  deleteFormTemplate,
  getFormTemplateBlob,
} from '@/api/form-templates'
import type { FormTemplateItem } from '@/api/form-templates'
import { Upload, Loader2, Trash2, Download, FileText } from 'lucide-vue-next'
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import DataTableFeatureToolbar from '@/components/common/data-table/DataTableFeatureToolbar.vue'
import { useClientDataTable } from '@/composables/useClientDataTable'
import type { TableListFeatures } from '@/types/data-table'

const route = useRoute()
const projectId = computed(() => (route.params.projectId as string) ?? '')
const uploadPerm = useProjectModuleActions(projectId, 'construction.upload')

const list = ref<FormTemplateItem[]>([])
const loading = ref(true)

/** 僅全文搜尋，無分面／多欄排序／欄位顯示 */
const TABLE_FEATURES: TableListFeatures = {
  search: true,
  filtersAndSort: false,
  columnVisibility: false,
}

const COLUMN_LABELS: Record<string, string> = {
  name: '名稱',
  description: '描述',
  fileSize: '檔案大小',
  isDefault: '類型',
  updatedAt: '更新時間',
}

const formsGlobalFilterFn: FilterFn<FormTemplateItem> = (row, _columnId, filterValue) => {
  const q = String(filterValue ?? '')
    .trim()
    .toLowerCase()
  if (!q) return true
  const r = row.original
  const name = (r.name ?? '').toLowerCase()
  const desc = (r.description ?? '').toLowerCase()
  const file = (r.fileName ?? '').toLowerCase()
  const uploader = (r.uploaderName ?? '').toLowerCase()
  const mime = (r.mimeType ?? '').toLowerCase()
  const typeLabel = r.isDefault ? '預設樣板' : '專案樣板'
  return (
    name.includes(q) ||
    desc.includes(q) ||
    file.includes(q) ||
    uploader.includes(q) ||
    mime.includes(q) ||
    typeLabel.toLowerCase().includes(q)
  )
}

const addDialogOpen = ref(false)
const addForm = ref({ name: '', description: '', file: null as File | null })
const addLoading = ref(false)
const addError = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const deleteDialogOpen = ref(false)
const deleteTarget = ref<FormTemplateItem | null>(null)
const deleteLoading = ref(false)

async function fetchList() {
  if (!projectId.value) return
  loading.value = true
  try {
    list.value = await listProjectFormTemplates(projectId.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => fetchList())
watch(projectId, (id) => {
  if (id) fetchList()
})

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 僅專案自訂樣板可刪除（預設樣板不可刪） */
function rowIsProjectDeletable(row: FormTemplateItem) {
  return row.isDefault === false
}

function canDeleteForRow(row: FormTemplateItem) {
  return rowIsProjectDeletable(row) && uploadPerm.canDelete.value
}

async function handleDownload(row: FormTemplateItem) {
  if (!ensureProjectPermission(uploadPerm.canRead.value, 'read')) return
  try {
    const { blob, fileName } = await getFormTemplateBlob(row.id, { fileName: row.fileName })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    // ignore
  }
}

function openDelete(row: FormTemplateItem) {
  if (!canDeleteForRow(row)) return
  deleteTarget.value = row
  deleteDialogOpen.value = true
}

/** 僅專案樣板可刪除；用於判斷選取項是否可批次刪除 */
const deletableIds = computed(
  () => new Set(list.value.filter((r) => r.isDefault !== true).map((r) => r.id))
)

const hasSelectColumn = computed(() => uploadPerm.canRead.value || uploadPerm.canDelete.value)

const selectColumnForms: ColumnDef<FormTemplateItem, unknown> = {
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

const columns = computed<ColumnDef<FormTemplateItem, unknown>[]>(() => {
  const cols: ColumnDef<FormTemplateItem, unknown>[] = []
  if (hasSelectColumn.value) {
    cols.push(selectColumnForms)
  }
  cols.push(
    {
      accessorKey: 'name',
      header: '名稱',
      cell: ({ row }) =>
        h('div', { class: 'flex items-center gap-2 font-medium' }, [
          h(FileText, { class: 'size-4 shrink-0 text-muted-foreground' }),
          h('span', { class: 'truncate', title: row.original.name }, row.original.name),
        ]),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'description',
      header: '描述',
      cell: ({ row }) =>
        h(
          'div',
          {
            class: 'max-w-[220px] truncate text-muted-foreground',
            title: row.original.description ?? '',
          },
          row.original.description || '—'
        ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'fileSize',
      header: '檔案大小',
      cell: ({ row }) =>
        h(
          'div',
          { class: 'text-muted-foreground text-sm' },
          formatSize(row.original.fileSize ?? 0)
        ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'isDefault',
      header: '類型',
      cell: ({ row }) =>
        h(
          Badge,
          {
            variant: row.original.isDefault ? 'secondary' : 'default',
            class: 'text-xs',
          },
          () => (row.original.isDefault ? '預設樣板' : '專案樣板')
        ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'updatedAt',
      header: '更新時間',
      cell: ({ row }) =>
        h('div', { class: 'text-muted-foreground text-sm' }, formatDate(row.original.updatedAt)),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: 'actions',
      header: () => h('div', { class: 'w-[80px]' }),
      cell: ({ row }) =>
        h('div', { class: 'flex justify-end' }, [
          h(FileFormsRowActions, {
            row: row.original,
            canDelete: canDeleteForRow,
            onDownload: handleDownload,
            onDelete: openDelete,
          }),
        ]),
      enableSorting: false,
      enableHiding: false,
    }
  )
  return cols
})

const { table, globalFilter, hasActiveFilters, resetTableState } = useClientDataTable({
  data: list,
  columns,
  features: TABLE_FEATURES,
  getRowId: (row) => row.id,
  globalFilterFn: formsGlobalFilterFn,
  enableRowSelection: hasSelectColumn,
  initialPageSize: 10,
})

const selectedRows = computed(() => table.getSelectedRowModel().rows)
const hasSelection = computed(() => selectedRows.value.length > 0)
const selectedCount = computed(() => selectedRows.value.length)

/** 選取項全部為可刪除時才可點批次刪除 */
const canBatchDelete = computed(() => {
  if (!uploadPerm.canDelete.value) return false
  if (selectedRows.value.length === 0) return false
  return selectedRows.value.every((r) => deletableIds.value.has(r.original.id))
})

const formsEmptyText = computed(() => {
  const q = globalFilter.value.trim()
  if (list.value.length === 0) {
    return q
      ? '沒有符合條件的資料'
      : '尚無表單樣板。請由後台「表單樣板」新增預設樣板，或在此新增專案樣板。'
  }
  return '沒有符合條件的資料'
})

function clearSelection() {
  table.setRowSelection({})
}

function tryOpenAddDialog() {
  if (!ensureProjectPermission(uploadPerm.canCreate.value, 'create')) return
  addDialogOpen.value = true
}

function onAddFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) addForm.value.file = file
  input.value = ''
}

async function submitAdd() {
  if (!ensureProjectPermission(uploadPerm.canCreate.value, 'create')) return
  if (!addForm.value.file || !projectId.value) {
    addError.value = '請選擇檔案'
    return
  }
  addLoading.value = true
  addError.value = ''
  try {
    await createProjectFormTemplate(projectId.value, {
      file: addForm.value.file,
      name: addForm.value.name.trim() || addForm.value.file.name,
      description: addForm.value.description.trim() || undefined,
    })
    addDialogOpen.value = false
    addForm.value = { name: '', description: '', file: null }
    await fetchList()
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message
        : '新增失敗'
    addError.value = msg ?? '新增失敗'
  } finally {
    addLoading.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleteLoading.value = true
  try {
    await deleteFormTemplate(deleteTarget.value.id)
    deleteDialogOpen.value = false
    await fetchList()
  } finally {
    deleteLoading.value = false
  }
}

const batchDeleteOpen = ref(false)
const batchDeleteLoading = ref(false)

function openBatchDelete() {
  batchDeleteOpen.value = true
}

function closeBatchDelete() {
  if (!batchDeleteLoading.value) batchDeleteOpen.value = false
}

async function confirmBatchDelete() {
  const toDelete = selectedRows.value
    .map((r) => r.original.id)
    .filter((id) => deletableIds.value.has(id))
  if (toDelete.length === 0) return
  batchDeleteLoading.value = true
  try {
    for (const id of toDelete) {
      await deleteFormTemplate(id)
    }
    table.setRowSelection({})
    closeBatchDelete()
    await fetchList()
  } finally {
    batchDeleteLoading.value = false
  }
}

const batchDownloadLoading = ref(false)

async function batchDownload() {
  if (!ensureProjectPermission(uploadPerm.canRead.value, 'read')) return
  const items = selectedRows.value.map((r) => r.original)
  if (!items.length) return
  batchDownloadLoading.value = true
  try {
    for (let i = 0; i < items.length; i++) {
      const row = items[i]
      try {
        const { blob, fileName } = await getFormTemplateBlob(row.id, { fileName: row.fileName })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        URL.revokeObjectURL(url)
      } catch {
        // skip failed
      }
      if (i < items.length - 1) await new Promise((r) => setTimeout(r, 300))
    }
  } finally {
    batchDownloadLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">相關表單</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        預設樣板由後台管理新增；專案也可在此新增樣板。每個樣板皆有名稱、更新時間與描述供辨識。
      </p>
    </div>

    <p v-if="!loading && !projectId" class="text-sm text-destructive">缺少專案 ID</p>
    <template v-else>
      <DataTableFeatureToolbar
        v-if="!loading"
        :table="table"
        :features="TABLE_FEATURES"
        :column-labels="COLUMN_LABELS"
        :has-active-filters="hasActiveFilters"
        :global-filter="globalFilter"
        search-placeholder="搜尋名稱、描述、檔名或類型…"
        @reset="resetTableState"
      >
        <template #actions>
          <div class="flex flex-wrap items-center gap-3">
            <template v-if="hasSelection && (uploadPerm.canRead || uploadPerm.canDelete)">
              <span class="text-sm text-muted-foreground">已選 {{ selectedCount }} 項</span>
              <ButtonGroup>
                <Button variant="outline" size="sm" @click="clearSelection">取消選取</Button>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="batchDownloadLoading"
                  @click="batchDownload"
                >
                  <Loader2 v-if="batchDownloadLoading" class="mr-1.5 size-4 animate-spin" />
                  <Download v-else class="mr-1.5 size-4" />
                  批次下載
                </Button>
                <Button
                  v-if="uploadPerm.canDelete"
                  variant="outline"
                  size="sm"
                  class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  :disabled="!canBatchDelete"
                  @click="openBatchDelete"
                >
                  <Trash2 class="mr-1.5 size-4" />
                  批次刪除
                </Button>
              </ButtonGroup>
            </template>
            <Button
              v-if="uploadPerm.canCreate && !hasSelection"
              size="sm"
              variant="default"
              class="gap-2"
              :disabled="!projectId"
              @click="tryOpenAddDialog"
            >
              <Upload class="size-4" />
              新增專案樣板
            </Button>
          </div>
        </template>
      </DataTableFeatureToolbar>

      <div class="rounded-lg border border-border bg-card">
        <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 class="size-8 animate-spin" />
        </div>
        <DataTableFeatureSection v-else :table="table" :empty-text="formsEmptyText" />
      </div>
      <div v-if="!loading && list.length > 0" class="mt-4">
        <DataTablePagination
          :table="table"
          :hide-selection-info="!hasSelectColumn"
        />
      </div>
    </template>

    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,image/*"
      @change="onAddFileChange"
    />
    <Dialog :open="addDialogOpen" @update:open="(v) => (addDialogOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增專案樣板</DialogTitle>
          <DialogDescription>上傳檔案並填寫名稱與描述，僅本專案可見</DialogDescription>
        </DialogHeader>
        <form class="grid gap-4 py-2" @submit.prevent="submitAdd">
          <div class="grid gap-2">
            <label class="text-sm font-medium text-foreground">檔案</label>
            <Button type="button" variant="outline" class="w-full" @click="fileInputRef?.click()">
              {{ addForm.file ? addForm.file.name : '選擇檔案' }}
            </Button>
          </div>
          <div class="grid gap-2">
            <label class="text-sm font-medium text-foreground">名稱</label>
            <Input v-model="addForm.name" placeholder="例：專案專用表單" class="bg-background" />
          </div>
          <div class="grid gap-2">
            <label class="text-sm font-medium text-foreground">描述</label>
            <Input
              v-model="addForm.description"
              placeholder="簡短說明樣板用途"
              class="bg-background"
            />
          </div>
          <p v-if="addError" class="text-sm text-destructive">{{ addError }}</p>
          <DialogFooter>
            <Button type="button" variant="outline" @click="addDialogOpen = false">取消</Button>
            <Button type="submit" :disabled="addLoading || !addForm.file">
              <Loader2 v-if="addLoading" class="mr-2 size-4 animate-spin" />
              新增
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog :open="deleteDialogOpen" @update:open="(v) => (deleteDialogOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>刪除樣板</DialogTitle>
          <DialogDescription>
            確定要刪除「{{ deleteTarget?.name }}」？此操作無法復原。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="deleteLoading" @click="deleteDialogOpen = false">
            取消
          </Button>
          <Button variant="destructive" :disabled="deleteLoading" @click="confirmDelete">
            <Loader2 v-if="deleteLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="batchDeleteOpen" @update:open="(v) => !v && closeBatchDelete()">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批次刪除樣板</DialogTitle>
          <DialogDescription>
            確定要刪除所選的 {{ selectedCount }} 個樣板？此操作無法復原。（僅專案樣板可刪除）
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="batchDeleteLoading" @click="closeBatchDelete">
            取消
          </Button>
          <Button variant="destructive" :disabled="batchDeleteLoading" @click="confirmBatchDelete">
            <Loader2 v-if="batchDeleteLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
