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
import { ref, computed, h, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { valueUpdater } from '@/lib/utils'
import type { SortingState } from '@tanstack/vue-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import ContractFileRowActions from '@/views/contract/ContractFileRowActions.vue'
import type { ContractFileRow } from '@/types/contract'
import {
  FileText,
  FilePlus2,
  FileEdit,
  LayoutList,
  MoreHorizontal,
  Upload,
  Download,
  Trash2,
  Plus,
  FileIcon,
} from 'lucide-vue-next'
import { listProjectFiles, deleteFile, getFileBlob } from '@/api/files'
import { useUploadQueue } from '@/composables/useUploadQueue'

const route = useRoute()
const projectId = computed(() => (route.params.projectId as string) ?? '')
const { enqueueAndUpload } = useUploadQueue()

/** 單一分類項目（key、顯示名稱、圖示） */
interface CategoryItem {
  key: string
  label: string
  icon: typeof FileText
}

/** 固定第一項：全部 */
const FIXED_ALL: CategoryItem = { key: 'all', label: '全部', icon: LayoutList }
/** 固定最後一項：其他 */
const FIXED_OTHER: CategoryItem = { key: 'other', label: '其他', icon: MoreHorizontal }

/** 中間可自訂分類（預設：主契約、補充契約、變更契約）；順序為 全部 + 自訂 + 其他 */
const customCategories = ref<CategoryItem[]>([
  { key: 'main', label: '主契約', icon: FileText },
  { key: 'supplement', label: '補充契約', icon: FilePlus2 },
  { key: 'change', label: '變更契約', icon: FileEdit },
])

/** 完整分類列表：全部 + 自訂 + 其他（最後一定只剩全部與其他） */
const categories = computed<CategoryItem[]>(() => [
  FIXED_ALL,
  ...customCategories.value,
  FIXED_OTHER,
])

const selectedCategory = ref<string>('all')

/** 新增分類 Dialog */
const addCategoryDialogOpen = ref(false)
const newCategoryLabel = ref('')

function submitAddCategory() {
  const label = newCategoryLabel.value.trim()
  if (!label) return
  const key = `custom-${Date.now()}`
  customCategories.value = [
    ...customCategories.value,
    { key, label, icon: FileText },
  ]
  newCategoryLabel.value = ''
  addCategoryDialogOpen.value = false
}

function closeAddCategoryDialog() {
  newCategoryLabel.value = ''
  addCategoryDialogOpen.value = false
}

watch(addCategoryDialogOpen, (open) => {
  if (open) newCategoryLabel.value = ''
})

/** 契約檔案列表（由 API 取得） */
const fileList = ref<ContractFileRow[]>([])
const listLoading = ref(false)
const listError = ref<string | null>(null)

function toContractRow(item: {
  id: string
  fileName: string
  fileSize: number
  createdAt: string
  uploaderName: string | null
  category: string | null
  url?: string
}): ContractFileRow {
  return {
    id: item.id,
    fileName: item.fileName,
    fileSize: item.fileSize,
    uploadDate: item.createdAt.slice(0, 10),
    uploader: item.uploaderName ?? '—',
    category: item.category ?? 'other',
    url: item.url,
  }
}

async function fetchFileList() {
  if (!projectId.value) return
  listLoading.value = true
  listError.value = null
  try {
    const { data } = await listProjectFiles({
      projectId: projectId.value,
      limit: 500,
    })
    fileList.value = data.map(toContractRow)
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : '無法載入檔案列表'
    listError.value = msg
    fileList.value = []
  } finally {
    listLoading.value = false
  }
}

onMounted(() => fetchFileList())
watch(projectId, (id) => {
  if (id) fetchFileList()
})

/** 依選擇分類篩選 */
const filteredList = computed(() => {
  if (selectedCategory.value === 'all') return fileList.value
  return fileList.value.filter((f) => f.category === selectedCategory.value)
})

/** 上傳 Dialog 開關 */
const uploadDialogOpen = ref(false)
const uploadLoading = ref(false)
const uploadError = ref<string | null>(null)

/** 上傳表單（支援多檔） */
const uploadForm = ref({
  category: 'main',
  files: [] as File[],
})

/** 選中的分類（供上傳用，排除「全部」） */
const uploadCategoryOptions = computed(() =>
  categories.value.filter((c) => c.key !== 'all').map((c) => ({ value: c.key, label: c.label }))
)

/** 送出上傳（多檔並行，經由上傳佇列，進度顯示於 Header 上傳進度） */
async function submitUpload() {
  const files = uploadForm.value.files
  if (!files.length || !projectId.value) return
  uploadLoading.value = true
  uploadError.value = null
  const results = await Promise.allSettled(
    files.map((file) =>
      enqueueAndUpload({
        file,
        projectId: projectId.value,
        category: uploadForm.value.category,
        source: 'contract',
      })
    )
  )
  const succeeded = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length
  const firstKey = customCategories.value[0]?.key ?? 'other'
  uploadForm.value = { category: firstKey, files: [] }
  uploadDialogOpen.value = false
  await fetchFileList()
  if (failed > 0) {
    uploadError.value =
      succeeded > 0
        ? `${succeeded} 個成功，${failed} 個失敗，請至「檔案上傳進度」查看詳情`
        : '上傳失敗，請至「檔案上傳進度」查看詳情'
  }
  uploadLoading.value = false
}

function closeUploadDialog() {
  const firstKey = customCategories.value[0]?.key ?? 'other'
  uploadForm.value = { category: firstKey, files: [] }
  uploadError.value = null
  uploadDialogOpen.value = false
}

function removeUploadFile(index: number) {
  uploadForm.value.files = uploadForm.value.files.filter((_, i) => i !== index)
}

/** 表格：排序與選取 */
const sorting = ref<SortingState>([])
const rowSelection = ref<Record<string, boolean>>({})

const columns = computed<ColumnDef<ContractFileRow, unknown>[]>(() => [
  {
    id: 'select',
    header: ({ table }) =>
      h(Checkbox, {
        checked: table.getIsAllPageRowsSelected(),
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
    accessorKey: 'fileName',
    header: '檔案名稱',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2 font-medium text-foreground' }, [
        h(FileIcon, { class: 'size-4 shrink-0 text-muted-foreground' }),
        h('span', { class: 'truncate' }, row.getValue('fileName') as string),
      ]),
  },
  {
    accessorKey: 'fileSize',
    header: '檔案大小',
    cell: ({ row }) => {
      const bytes = row.getValue('fileSize') as number
      const str = bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      return h('div', { class: 'text-muted-foreground text-sm' }, str)
    },
  },
  {
    accessorKey: 'uploadDate',
    header: '上傳日期',
    cell: ({ row }) =>
      h('div', { class: 'text-foreground' }, row.getValue('uploadDate') as string),
  },
  {
    accessorKey: 'uploader',
    header: '上傳者',
    cell: ({ row }) =>
      h('div', { class: 'text-foreground' }, row.getValue('uploader') as string),
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'w-[80px]' }),
    cell: ({ row }) =>
      h('div', { class: 'flex' }, [
        h(ContractFileRowActions, {
          row: row.original,
          onDownload: (r) => handleDownload(r),
          onDelete: (r) => handleDelete(r),
        }),
      ]),
    enableSorting: false,
  },
])

async function handleDownload(row: ContractFileRow) {
  try {
    const { blob, fileName } = await getFileBlob(row.id, { download: true, fileName: row.fileName })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    // 可選：toast 錯誤
  }
}

async function handleDelete(row: ContractFileRow) {
  try {
    await deleteFile(row.id)
    fileList.value = fileList.value.filter((x) => x.id !== row.id)
  } catch {
    // 可選：toast 錯誤
  }
}

const table = useVueTable({
  get data() {
    return filteredList.value
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

/** 已選列數，用於顯示工具列 */
const selectedRows = computed(() => table.getSelectedRowModel().rows)
const hasSelection = computed(() => selectedRows.value.length > 0)

/** 批次下載（假，之後接 API） */
function batchDownload() {
  console.log('批次下載', selectedRows.value.map((r) => r.original))
}

/** 批次刪除 */
async function batchDelete() {
  const rows = selectedRows.value.map((r) => r.original)
  for (const row of rows) {
    try {
      await deleteFile(row.id)
      fileList.value = fileList.value.filter((x) => x.id !== row.id)
    } catch {
      // 單筆失敗可略過或 toast
    }
  }
  rowSelection.value = {}
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const newFiles = input.files ? Array.from(input.files) : []
  uploadForm.value.files = [...uploadForm.value.files, ...newFiles]
  input.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">契約管理</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        依分類管理契約文件，可上傳、下載與刪除
      </p>
    </div>

    <!-- 上方：選擇分類 -->
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-sm font-medium text-foreground">選擇分類：</span>
        <Button
          v-for="c in categories"
          :key="c.key"
          :variant="selectedCategory === c.key ? 'secondary' : 'outline'"
          size="sm"
          class="gap-2"
          @click="selectedCategory = c.key"
        >
          <component :is="c.icon" class="size-4 shrink-0" />
          {{ c.label }}
        </Button>
        <Dialog v-model:open="addCategoryDialogOpen">
          <DialogTrigger as-child>
            <Button variant="outline" size="sm" class="gap-2" aria-label="新增分類">
              <Plus class="size-4" />
              新增分類
            </Button>
          </DialogTrigger>
          <DialogContent class="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>新增分類</DialogTitle>
              <DialogDescription>
                輸入新分類名稱，將顯示在「全部」與「其他」之間
              </DialogDescription>
            </DialogHeader>
            <div class="grid gap-4 py-4">
              <div class="grid gap-2">
                <label class="text-sm font-medium text-foreground">分類名稱</label>
                <Input
                  v-model="newCategoryLabel"
                  placeholder="例如：保險契約"
                  @keydown.enter.prevent="submitAddCategory"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="closeAddCategoryDialog">
                取消
              </Button>
              <Button :disabled="!newCategoryLabel.trim()" @click="submitAddCategory">
                新增
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>

    <!-- 下方：列表 + 工具列 -->
    <p class="text-sm text-muted-foreground">依上方分類篩選，可多選後批次下載或刪除</p>
    <div class="rounded-lg border border-border bg-card">
      <div class="flex flex-row flex-wrap items-center justify-between gap-4 p-4 pb-0">
        <div class="flex flex-wrap items-center gap-2">
          <!-- 有勾選時顯示：批次下載、批次刪除 -->
          <template v-if="hasSelection">
            <Button variant="outline" size="sm" class="gap-2" @click="batchDownload">
              <Download class="size-4" />
              批次下載
            </Button>
            <Button variant="outline" size="sm" class="gap-2 text-destructive hover:text-destructive" @click="batchDelete">
              <Trash2 class="size-4" />
              批次刪除
            </Button>
          </template>
          <!-- 上傳檔案 -->
          <Dialog v-model:open="uploadDialogOpen">
            <DialogTrigger as-child>
              <Button class="gap-2">
                <Upload class="size-4" />
                上傳檔案
              </Button>
            </DialogTrigger>
            <DialogContent class="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>上傳契約檔案</DialogTitle>
                <DialogDescription>
                  選擇分類並選擇要上傳的檔案
                </DialogDescription>
              </DialogHeader>
              <div class="grid gap-4 py-4">
                <div class="grid gap-2">
                  <label class="text-sm font-medium text-foreground">分類</label>
                  <Select v-model="uploadForm.category">
                    <SelectTrigger>
                      <SelectValue placeholder="請選擇分類" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="opt in uploadCategoryOptions"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="grid gap-2">
                  <label class="text-sm font-medium text-foreground">檔案（可多選）</label>
                  <div class="flex items-center gap-2">
                    <Input
                      type="file"
                      class="flex-1"
                      accept=".pdf,.doc,.docx"
                      multiple
                      @change="onFileSelect"
                    />
                  </div>
                  <ul v-if="uploadForm.files.length" class="mt-1 space-y-1 rounded-md border border-border bg-muted/30 p-2 max-h-32 overflow-y-auto">
                    <li
                      v-for="(f, idx) in uploadForm.files"
                      :key="idx"
                      class="flex items-center justify-between gap-2 text-xs text-foreground"
                    >
                      <span class="truncate">{{ f.name }}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="size-6 shrink-0"
                        aria-label="移除"
                        @click="removeUploadFile(idx)"
                      >
                        <Trash2 class="size-3.5" />
                      </Button>
                    </li>
                  </ul>
                  <p v-if="uploadForm.files.length" class="text-xs text-muted-foreground">
                    已選 {{ uploadForm.files.length }} 個檔案
                  </p>
                </div>
              </div>
              <p v-if="uploadError" class="text-sm text-destructive">
                {{ uploadError }}
              </p>
              <DialogFooter>
                <Button variant="outline" @click="closeUploadDialog">
                  取消
                </Button>
                <Button
                  :disabled="!uploadForm.files.length || uploadLoading"
                  @click="submitUpload"
                >
                  {{ uploadLoading ? '上傳中…' : uploadForm.files.length ? `上傳 ${uploadForm.files.length} 個檔案` : '上傳' }}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div class="space-y-4 p-4">
        <p v-if="listError" class="text-sm text-destructive">
          {{ listError }}
        </p>
        <p v-if="listLoading" class="text-sm text-muted-foreground">
          載入中…
        </p>
        <div v-else>
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
                      <FlexRender
                        :render="cell.column.columnDef.cell"
                        :props="cell.getContext()"
                      />
                    </TableCell>
                  </TableRow>
                </template>
                <template v-else>
                  <TableRow>
                    <TableCell :colspan="6" class="h-24 text-center text-muted-foreground">
                      尚無資料，請選擇分類或上傳檔案
                    </TableCell>
                  </TableRow>
                </template>
              </TableBody>
            </Table>
          </div>
          <DataTablePagination :table="table" />
        </div>
    </div>
  </div>
</template>
