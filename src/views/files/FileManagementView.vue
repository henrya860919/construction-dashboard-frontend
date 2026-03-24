<script setup lang="ts">
import type { ColumnDef, FilterFn } from '@tanstack/vue-table'
import { ref, computed, watch, onMounted, h } from 'vue'
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { listProjectFiles, deleteFile, getFileBlob } from '@/api/files'
import type { AttachmentItem } from '@/api/files'
import { useUploadQueue } from '@/composables/useUploadQueue'
import FileManagementRowActions from '@/views/files/FileManagementRowActions.vue'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { ensureProjectPermission } from '@/lib/permission-toast'
import { Upload, Loader2, Trash2, Download, FileIcon } from 'lucide-vue-next'
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTableFeatureToolbar from '@/components/common/data-table/DataTableFeatureToolbar.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import { useClientDataTable } from '@/composables/useClientDataTable'
import type { TableListFeatures } from '@/types/data-table'

/** 檔案管理專用 category，與契約分開 */
const FILE_MANAGEMENT_CATEGORY = 'general'

const route = useRoute()
const projectId = computed(() => (route.params.projectId as string) ?? '')
const { enqueueAndUpload } = useUploadQueue()
const uploadPerm = useProjectModuleActions(projectId, 'construction.upload')

const fileList = ref<AttachmentItem[]>([])
const loading = ref(true)

const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadInProgress = ref(false)
const deleteDialogOpen = ref(false)
const fileToDelete = ref<AttachmentItem | null>(null)
const deleteLoading = ref(false)

/** 僅全文搜尋，無分面／多欄排序／欄位顯示 */
const TABLE_FEATURES: TableListFeatures = {
  search: true,
  filtersAndSort: false,
  columnVisibility: false,
}

const COLUMN_LABELS: Record<string, string> = {
  fileName: '檔名',
  fileSize: '檔案大小',
  uploaderName: '上傳者',
  createdAt: '上傳時間',
}

const filesGlobalFilterFn: FilterFn<AttachmentItem> = (row, _columnId, filterValue) => {
  const q = String(filterValue ?? '')
    .trim()
    .toLowerCase()
  if (!q) return true
  const r = row.original
  const name = (r.fileName ?? '').toLowerCase()
  const uploader = (r.uploaderName ?? '').toLowerCase()
  const mime = (r.mimeType ?? '').toLowerCase()
  return name.includes(q) || uploader.includes(q) || mime.includes(q)
}

async function fetchList() {
  if (!projectId.value) return
  loading.value = true
  try {
    const { data } = await listProjectFiles({
      projectId: projectId.value,
      page: 1,
      limit: 500,
      category: FILE_MANAGEMENT_CATEGORY,
    })
    fileList.value = data
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const hasSelectColumn = computed(() => uploadPerm.canRead.value || uploadPerm.canDelete.value)

async function handleDownload(row: AttachmentItem) {
  if (!ensureProjectPermission(uploadPerm.canRead.value, 'read')) return
  try {
    const { blob, fileName } = await getFileBlob(row.id, { download: true, fileName: row.fileName })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    // 錯誤由 api client 或使用者處理
  }
}

function openDeleteDialog(row: AttachmentItem) {
  fileToDelete.value = row
  deleteDialogOpen.value = true
}

const selectColumn: ColumnDef<AttachmentItem, unknown> = {
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

const columns = computed<ColumnDef<AttachmentItem, unknown>[]>(() => {
  const cols: ColumnDef<AttachmentItem, unknown>[] = []
  if (hasSelectColumn.value) {
    cols.push(selectColumn)
  }
  cols.push(
    {
      accessorKey: 'fileName',
      header: '檔名',
      cell: ({ row }) =>
        h('div', { class: 'flex items-center gap-2 font-medium' }, [
          h(FileIcon, { class: 'size-4 shrink-0 text-muted-foreground' }),
          h('span', { class: 'truncate', title: row.original.fileName }, row.original.fileName),
        ]),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'fileSize',
      header: '檔案大小',
      cell: ({ row }) =>
        h('div', { class: 'text-muted-foreground' }, formatSize(row.original.fileSize)),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'uploaderName',
      header: '上傳者',
      cell: ({ row }) =>
        h('div', { class: 'text-muted-foreground' }, row.original.uploaderName ?? '—'),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'createdAt',
      header: '上傳時間',
      cell: ({ row }) =>
        h('div', { class: 'text-muted-foreground' }, formatDate(row.original.createdAt)),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: 'actions',
      header: () => h('div', { class: 'w-[80px]' }),
      cell: ({ row }) =>
        h('div', { class: 'flex justify-end' }, [
          h(FileManagementRowActions, {
            row: row.original,
            canDelete: uploadPerm.canDelete.value,
            onDownload: handleDownload,
            onDelete: openDeleteDialog,
          }),
        ]),
      enableSorting: false,
      enableHiding: false,
    }
  )
  return cols
})

const { table, globalFilter, hasActiveFilters, resetTableState } = useClientDataTable({
  data: fileList,
  columns,
  features: TABLE_FEATURES,
  getRowId: (row) => row.id,
  globalFilterFn: filesGlobalFilterFn,
  enableRowSelection: hasSelectColumn,
  initialPageSize: 20,
})

const selectedRows = computed(() => table.getSelectedRowModel().rows)
const hasSelection = computed(() => selectedRows.value.length > 0)
const selectedCount = computed(() => selectedRows.value.length)

const filesEmptyText = computed(() => {
  const q = globalFilter.value.trim()
  if (fileList.value.length === 0) {
    return q ? '沒有符合條件的資料' : '尚無檔案，點擊「新增檔案」上傳'
  }
  return '沒有符合條件的資料'
})

function clearSelection() {
  table.setRowSelection({})
}

function triggerAddFile() {
  if (!ensureProjectPermission(uploadPerm.canCreate.value, 'create')) return
  fileInputRef.value?.click()
}

async function onFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  if (!files.length || !projectId.value) return
  uploadInProgress.value = true
  try {
    await Promise.allSettled(
      files.map((file) =>
        enqueueAndUpload({
          file,
          projectId: projectId.value,
          category: FILE_MANAGEMENT_CATEGORY,
          source: 'files',
        })
      )
    )
    await fetchList()
  } finally {
    uploadInProgress.value = false
  }
}

function closeDeleteDialog() {
  deleteDialogOpen.value = false
  fileToDelete.value = null
}

async function confirmDelete() {
  const row = fileToDelete.value
  if (!row) return
  deleteLoading.value = true
  try {
    await deleteFile(row.id)
    closeDeleteDialog()
    await fetchList()
  } finally {
    deleteLoading.value = false
  }
}

async function batchDownload() {
  if (!ensureProjectPermission(uploadPerm.canRead.value, 'read')) return
  const rows = selectedRows.value.map((r) => r.original)
  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i]
      const { blob, fileName } = await getFileBlob(row.id, {
        download: true,
        fileName: row.fileName,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // skip failed
    }
    if (i < rows.length - 1) await new Promise((r) => setTimeout(r, 300))
  }
}

const batchDeleteOpen = ref(false)
const batchDeleteLoading = ref(false)

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
  try {
    for (const row of rows) {
      await deleteFile(row.id)
    }
    closeBatchDelete()
    table.setRowSelection({})
    await fetchList()
  } finally {
    batchDeleteLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">檔案管理</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        此列表僅顯示「檔案管理」上傳的檔案，與契約附件分開管理。上傳狀態會顯示於右上角「檔案上傳」清單。
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
        search-placeholder="搜尋檔名、上傳者或類型…"
        @reset="resetTableState"
      >
        <template #actions>
          <div class="flex flex-wrap items-center gap-3">
            <input
              ref="fileInputRef"
              type="file"
              class="hidden"
              multiple
              @change="onFileInputChange"
            />
            <template v-if="hasSelection && (uploadPerm.canRead || uploadPerm.canDelete)">
              <span class="text-sm text-muted-foreground">已選 {{ selectedCount }} 項</span>
              <ButtonGroup>
                <Button variant="outline" size="sm" @click="clearSelection"> 取消選取 </Button>
                <Button variant="outline" size="sm" @click="batchDownload">
                  <Download class="size-4" />
                  批次下載
                </Button>
                <Button
                  v-if="uploadPerm.canDelete"
                  variant="outline"
                  size="sm"
                  class="text-destructive hover:text-destructive"
                  @click="openBatchDelete"
                >
                  <Trash2 class="size-4" />
                  批次刪除
                </Button>
              </ButtonGroup>
            </template>
            <Button
              v-if="uploadPerm.canCreate && !hasSelection"
              size="sm"
              variant="default"
              class="gap-2"
              :disabled="uploadInProgress || !projectId"
              @click="triggerAddFile"
            >
              <Loader2 v-if="uploadInProgress" class="size-4 animate-spin" />
              <Upload v-else class="size-4" />
              新增檔案
            </Button>
          </div>
        </template>
      </DataTableFeatureToolbar>

      <div class="rounded-lg border border-border bg-card">
        <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 class="size-8 animate-spin" />
        </div>
        <DataTableFeatureSection v-else :table="table" :empty-text="filesEmptyText" />
      </div>
      <div
        v-if="!loading && fileList.length > 0"
        class="mt-4"
      >
        <DataTablePagination
          :table="table"
          :hide-selection-info="!hasSelectColumn"
        />
      </div>
    </template>

    <Dialog :open="deleteDialogOpen" @update:open="(v) => !v && closeDeleteDialog()">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>刪除檔案</DialogTitle>
          <DialogDescription>
            確定要刪除「{{ fileToDelete?.fileName }}」？此操作無法復原。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="deleteLoading" @click="closeDeleteDialog">
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
          <DialogTitle>批次刪除</DialogTitle>
          <DialogDescription>
            確定要刪除所選的 {{ selectedCount }} 個檔案？此操作無法復原。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="batchDeleteLoading" @click="closeBatchDelete">
            取消
          </Button>
          <Button variant="destructive" :disabled="batchDeleteLoading" @click="confirmBatchDelete">
            <Loader2 v-if="batchDeleteLoading" class="mr-2 size-4 animate-spin" />
            {{ batchDeleteLoading ? '刪除中…' : '確認刪除' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
