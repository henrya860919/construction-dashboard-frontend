<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import { FlexRender } from '@tanstack/vue-table'
import type { SortingState } from '@tanstack/vue-table'
import { ref, computed, watch, onMounted, h } from 'vue'
import { useRoute } from 'vue-router'
import { valueUpdater } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
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
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import FileFormsRowActions from '@/views/files/FileFormsRowActions.vue'
import {
  listProjectFormTemplates,
  createProjectFormTemplate,
  deleteFormTemplate,
  getFormTemplateBlob,
} from '@/api/form-templates'
import type { FormTemplateItem } from '@/api/form-templates'
import { Upload, Loader2, Trash2, Download, FileText } from 'lucide-vue-next'

const route = useRoute()
const projectId = computed(() => (route.params.projectId as string) ?? '')

const list = ref<FormTemplateItem[]>([])
const loading = ref(true)
const rowSelection = ref<Record<string, boolean>>({})
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
const canDelete = (row: FormTemplateItem) => row.isDefault === false

function openDelete(row: FormTemplateItem) {
  if (!canDelete(row)) return
  deleteTarget.value = row
  deleteDialogOpen.value = true
}

async function handleDownload(row: FormTemplateItem) {
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

/** 僅專案樣板可刪除；用於判斷選取項是否可批次刪除 */
const deletableIds = computed(
  () => new Set(list.value.filter((r) => r.isDefault !== true).map((r) => r.id))
)

const sorting = ref<SortingState>([])
const columns = computed<ColumnDef<FormTemplateItem, unknown>[]>(() => [
  {
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
  },
  {
    accessorKey: 'name',
    header: '名稱',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2 font-medium' }, [
        h(FileText, { class: 'size-4 shrink-0 text-muted-foreground' }),
        h('span', { class: 'truncate', title: row.original.name }, row.original.name),
      ]),
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
  },
  {
    accessorKey: 'fileSize',
    header: '檔案大小',
    cell: ({ row }) =>
      h('div', { class: 'text-muted-foreground text-sm' }, formatSize(row.original.fileSize ?? 0)),
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
  },
  {
    accessorKey: 'updatedAt',
    header: '更新時間',
    cell: ({ row }) =>
      h('div', { class: 'text-muted-foreground text-sm' }, formatDate(row.original.updatedAt)),
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'w-[80px]' }),
    cell: ({ row }) =>
      h('div', { class: 'flex justify-end' }, [
        h(FileFormsRowActions, {
          row: row.original,
          canDelete,
          onDownload: handleDownload,
          onDelete: openDelete,
        }),
      ]),
    enableSorting: false,
  },
])

const table = useVueTable({
  get data() {
    return list.value
  },
  get columns() {
    return columns.value
  },
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  onSortingChange: (updater) => valueUpdater(updater, sorting),
  onRowSelectionChange: (updater) => valueUpdater(updater, rowSelection),
  state: {
    get sorting() {
      return sorting.value
    },
    get rowSelection() {
      return rowSelection.value
    },
  },
  getRowId: (row) => row.id,
  initialState: {
    pagination: { pageSize: 10 },
  },
})

const selectedRows = computed(() => table.getSelectedRowModel().rows)
const hasSelection = computed(() => selectedRows.value.length > 0)
const selectedCount = computed(() => selectedRows.value.length)
/** 選取項全部為可刪除時才可點批次刪除 */
const canBatchDelete = computed(() => {
  if (selectedRows.value.length === 0) return false
  return selectedRows.value.every((r) => deletableIds.value.has(r.original.id))
})

function clearSelection() {
  rowSelection.value = {}
}

function onAddFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) addForm.value.file = file
  input.value = ''
}

async function submitAdd() {
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
    rowSelection.value = {}
    closeBatchDelete()
    await fetchList()
  } finally {
    batchDeleteLoading.value = false
  }
}

const batchDownloadLoading = ref(false)
async function batchDownload() {
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
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-foreground">相關表單</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        預設樣板由後台管理新增；專案也可在此新增樣板。每個樣板皆有名稱、更新時間與描述供辨識。
      </p>
    </div>

    <!-- 工具列：已選 + ButtonGroup + 新增 全部靠右 -->
    <div class="flex flex-wrap items-center justify-end gap-3">
      <template v-if="hasSelection">
        <span class="text-sm text-muted-foreground">已選 {{ selectedCount }} 項</span>
        <ButtonGroup>
          <Button variant="outline" @click="clearSelection"> 取消選取 </Button>
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
      <Button :disabled="!projectId" @click="addDialogOpen = true">
        <Upload class="mr-2 size-4" />
        新增專案樣板
      </Button>
    </div>

    <div class="rounded-lg border border-border bg-card p-4">
      <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 class="size-8 animate-spin" />
      </div>
      <template v-else>
        <Table>
          <TableHeader>
            <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
              <TableHead v-for="header in headerGroup.headers" :key="header.id">
                <FlexRender
                  v-if="!header.isPlaceholder"
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="table.getRowModel().rows?.length">
              <TableRow
                v-for="row in table.getRowModel().rows"
                :key="row.id"
                :data-state="row.getIsSelected() ? 'selected' : undefined"
              >
                <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </TableCell>
              </TableRow>
            </template>
            <template v-else>
              <TableRow>
                <TableCell :colspan="7" class="h-24 text-center text-muted-foreground">
                  尚無表單樣板。請由後台「表單樣板」新增預設樣板，或在此新增專案樣板。
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
        <DataTablePagination :table="table" />
      </template>
    </div>

    <!-- 新增專案樣板 Dialog -->
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

    <!-- 刪除確認 -->
    <Dialog :open="deleteDialogOpen" @update:open="(v) => (deleteDialogOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>刪除樣板</DialogTitle>
          <DialogDescription>
            確定要刪除「{{ deleteTarget?.name }}」？此操作無法復原。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="deleteLoading" @click="deleteDialogOpen = false"
            >取消</Button
          >
          <Button variant="destructive" :disabled="deleteLoading" @click="confirmDelete">
            <Loader2 v-if="deleteLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 批次刪除確認 -->
    <Dialog :open="batchDeleteOpen" @update:open="(v) => !v && closeBatchDelete()">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批次刪除樣板</DialogTitle>
          <DialogDescription>
            確定要刪除所選的 {{ selectedCount }} 個樣板？此操作無法復原。（僅專案樣板可刪除）
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="batchDeleteLoading" @click="closeBatchDelete"
            >取消</Button
          >
          <Button variant="destructive" :disabled="batchDeleteLoading" @click="confirmBatchDelete">
            <Loader2 v-if="batchDeleteLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
