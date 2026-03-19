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
import { ref, onMounted, computed, h } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
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
import { Label } from '@/components/ui/label'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import AdminSelfInspectionTemplatesRowActions from '@/views/admin/AdminSelfInspectionTemplatesRowActions.vue'
import {
  listSelfInspectionTemplates,
  createSelfInspectionTemplate,
  updateSelfInspectionTemplate,
  deleteSelfInspectionTemplate,
} from '@/api/self-inspection-templates'
import type { SelfInspectionTemplateItem } from '@/api/self-inspection-templates'
import { ROUTE_NAME } from '@/constants/routes'
import { useRouter } from 'vue-router'
import { Loader2, Trash2, Plus, ClipboardCheck } from 'lucide-vue-next'

const authStore = useAuthStore()
const router = useRouter()
const tenantId = computed(() => authStore.user?.tenantId ?? null)

const list = ref<SelfInspectionTemplateItem[]>([])
const loading = ref(true)
const rowSelection = ref<Record<string, boolean>>({})

const addDialogOpen = ref(false)
const addForm = ref({ name: '', description: '' })
const addLoading = ref(false)
const addError = ref('')

const editDialogOpen = ref(false)
const editTarget = ref<SelfInspectionTemplateItem | null>(null)
const editForm = ref({ name: '', description: '', status: 'active' as 'active' | 'archived' })
const editLoading = ref(false)

const deleteDialogOpen = ref(false)
const deleteTarget = ref<SelfInspectionTemplateItem | null>(null)
const deleteLoading = ref(false)

const batchDeleteOpen = ref(false)
const batchDeleteLoading = ref(false)

async function fetchList() {
  loading.value = true
  try {
    list.value = await listSelfInspectionTemplates(tenantId.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => fetchList())

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function openAdd() {
  addForm.value = { name: '', description: '' }
  addError.value = ''
  addDialogOpen.value = true
}

async function submitAdd() {
  if (!addForm.value.name.trim()) {
    addError.value = '請填寫樣板名稱'
    return
  }
  addLoading.value = true
  addError.value = ''
  try {
    await createSelfInspectionTemplate(
      {
        name: addForm.value.name.trim(),
        description: addForm.value.description.trim() || null,
      },
      tenantId.value
    )
    addDialogOpen.value = false
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

function openEdit(row: SelfInspectionTemplateItem) {
  editTarget.value = row
  editForm.value = {
    name: row.name,
    description: row.description ?? '',
    status: row.status === 'archived' ? 'archived' : 'active',
  }
  editDialogOpen.value = true
}

async function submitEdit() {
  if (!editTarget.value) return
  editLoading.value = true
  try {
    await updateSelfInspectionTemplate(
      editTarget.value.id,
      {
        name: editForm.value.name.trim() || undefined,
        description: editForm.value.description.trim() || null,
        status: editForm.value.status,
      },
      tenantId.value
    )
    editDialogOpen.value = false
    await fetchList()
  } finally {
    editLoading.value = false
  }
}

function openDelete(row: SelfInspectionTemplateItem) {
  deleteTarget.value = row
  deleteDialogOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleteLoading.value = true
  try {
    await deleteSelfInspectionTemplate(deleteTarget.value.id, tenantId.value)
    deleteDialogOpen.value = false
    await fetchList()
  } finally {
    deleteLoading.value = false
  }
}

function goOpen(row: SelfInspectionTemplateItem) {
  router.push({
    name: ROUTE_NAME.ADMIN_SELF_INSPECTION_TEMPLATE_DETAIL,
    params: { templateId: row.id },
  })
}

const sorting = ref<SortingState>([])
const columns = computed<ColumnDef<SelfInspectionTemplateItem, unknown>[]>(() => [
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
      h(
        RouterLink,
        {
          to: {
            name: ROUTE_NAME.ADMIN_SELF_INSPECTION_TEMPLATE_DETAIL,
            params: { templateId: row.original.id },
          },
          class:
            'font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
        },
        () => row.original.name
      ),
  },
  {
    accessorKey: 'description',
    header: '說明',
    cell: ({ row }) =>
      h(
        'div',
        {
          class: 'text-muted-foreground max-w-[220px] truncate',
          title: row.original.description ?? '',
        },
        row.original.description || '—'
      ),
  },
  {
    accessorKey: 'blockCount',
    header: '區塊數',
    cell: ({ row }) =>
      h('div', { class: 'tabular-nums text-muted-foreground text-sm' }, row.original.blockCount),
  },
  {
    accessorKey: 'status',
    header: '狀態',
    cell: ({ row }) =>
      row.original.status === 'archived'
        ? h(Badge, { variant: 'secondary' }, () => '已封存')
        : h(Badge, { variant: 'outline' }, () => '使用中'),
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
        h(AdminSelfInspectionTemplatesRowActions, {
          row: row.original,
          onOpen: goOpen,
          onEdit: openEdit,
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

function clearSelection() {
  rowSelection.value = {}
}

function openBatchDelete() {
  batchDeleteOpen.value = true
}
function closeBatchDelete() {
  if (!batchDeleteLoading.value) batchDeleteOpen.value = false
}

async function confirmBatchDelete() {
  const ids = selectedRows.value.map((r) => r.original.id)
  if (ids.length === 0) return
  batchDeleteLoading.value = true
  try {
    for (const id of ids) {
      await deleteSelfInspectionTemplate(id, tenantId.value)
    }
    closeBatchDelete()
    rowSelection.value = {}
    await fetchList()
  } finally {
    batchDeleteLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-foreground">自主檢查樣板</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        管理租戶內所有查驗表單樣板；建立後可於樣板內新增區塊，供現場自主檢查或專案引用（後續串接）。
      </p>
    </div>

    <div class="flex flex-wrap items-center justify-end gap-3">
      <template v-if="hasSelection">
        <span class="text-sm text-muted-foreground">已選 {{ selectedCount }} 項</span>
        <ButtonGroup>
          <Button variant="outline" @click="clearSelection">
            取消選取
          </Button>
          <Button
            variant="outline"
            class="text-destructive hover:text-destructive"
            @click="openBatchDelete"
          >
            <Trash2 class="size-4" />
            批次刪除
          </Button>
        </ButtonGroup>
      </template>
      <Button @click="openAdd">
        <Plus class="mr-2 size-4" />
        新增樣板
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
                  <div class="flex flex-col items-center gap-2">
                    <ClipboardCheck class="size-10 opacity-50" />
                    尚無樣板，點擊「新增樣板」開始建立
                  </div>
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
        <DataTablePagination :table="table" hide-selection-info />
      </template>
    </div>

    <Dialog :open="addDialogOpen" @update:open="(v) => (addDialogOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增自主檢查樣板</DialogTitle>
          <DialogDescription>建立後請進入樣板內新增查驗區塊</DialogDescription>
        </DialogHeader>
        <form class="grid gap-4 py-2" @submit.prevent="submitAdd">
          <div class="grid gap-2">
            <Label for="sit-name">名稱</Label>
            <Input
              id="sit-name"
              v-model="addForm.name"
              placeholder="例：每週安全自主檢查"
              class="bg-background"
            />
          </div>
          <div class="grid gap-2">
            <Label for="sit-desc">說明（選填）</Label>
            <Input
              id="sit-desc"
              v-model="addForm.description"
              placeholder="用途簡述"
              class="bg-background"
            />
          </div>
          <p v-if="addError" class="text-sm text-destructive">{{ addError }}</p>
          <DialogFooter>
            <Button type="button" variant="outline" @click="addDialogOpen = false">取消</Button>
            <Button type="submit" :disabled="addLoading">
              <Loader2 v-if="addLoading" class="mr-2 size-4 animate-spin" />
              建立
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog :open="editDialogOpen" @update:open="(v) => (editDialogOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>編輯樣板</DialogTitle>
          <DialogDescription>更新名稱、說明與狀態</DialogDescription>
        </DialogHeader>
        <form class="grid gap-4 py-2" @submit.prevent="submitEdit">
          <div class="grid gap-2">
            <Label for="sit-edit-name">名稱</Label>
            <Input id="sit-edit-name" v-model="editForm.name" class="bg-background" />
          </div>
          <div class="grid gap-2">
            <Label for="sit-edit-desc">說明</Label>
            <Input id="sit-edit-desc" v-model="editForm.description" class="bg-background" />
          </div>
          <div class="grid gap-2">
            <Label for="sit-edit-status">狀態</Label>
            <select
              id="sit-edit-status"
              v-model="editForm.status"
              class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="active">使用中</option>
              <option value="archived">已封存</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" @click="editDialogOpen = false">取消</Button>
            <Button type="submit" :disabled="editLoading">
              <Loader2 v-if="editLoading" class="mr-2 size-4 animate-spin" />
              儲存
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
            確定要刪除「{{ deleteTarget?.name }}」？底下所有區塊一併刪除，且無法復原。
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
            確定要刪除所選的 {{ selectedCount }} 個樣板？此操作無法復原。
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
