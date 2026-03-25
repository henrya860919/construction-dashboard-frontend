<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { getCoreRowModel, useVueTable } from '@tanstack/vue-table'
import { FlexRender } from '@tanstack/vue-table'
import { ref, computed, watch, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { valueUpdater } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, FileText, Clock, CheckCircle, Plus } from 'lucide-vue-next'
import StateCard from '@/components/common/StateCard.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import { listRepairRequests, deleteRepairRequest } from '@/api/repair-requests'
import type { RepairRequestItem, RepairRequestStatus } from '@/types/repair-request'
import { ROUTE_NAME } from '@/constants'
import RepairRecordsRowActions from '@/views/repair/RepairRecordsRowActions.vue'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { ensureProjectPermission } from '@/lib/permission-toast'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)
const repairRecordPerm = useProjectModuleActions(projectId, 'repair.record')

const ALL_STATUS = 'all' as const
const statusFilter = ref<string>(ALL_STATUS)

const list = ref<RepairRequestItem[]>([])
const meta = ref<{ page: number; limit: number; total: number } | null>(null)
const loading = ref(false)
const statsLoading = ref(false)
const errorMessage = ref('')
const stats = ref({ total: 0, inProgress: 0, completed: 0 })

const page = ref(1)
const limit = ref(20)
const rowSelection = ref<Record<string, boolean>>({})

const removeDialogOpen = ref(false)
const removingItem = ref<RepairRequestItem | null>(null)
const removing = ref(false)

const batchDeleteOpen = ref(false)
const batchDeleteLoading = ref(false)

const STATUS_LABELS: Record<RepairRequestStatus, string> = {
  in_progress: '進行中',
  completed: '已完成',
}

const totalPages = computed(() => (meta.value ? Math.ceil(meta.value.total / limit.value) : 0))

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

async function loadStats() {
  const pid = projectId.value
  if (!pid) return
  statsLoading.value = true
  try {
    const [all, prog, done] = await Promise.all([
      listRepairRequests(pid, { page: 1, limit: 1 }),
      listRepairRequests(pid, { page: 1, limit: 1, status: 'in_progress' }),
      listRepairRequests(pid, { page: 1, limit: 1, status: 'completed' }),
    ])
    stats.value = {
      total: all.meta.total,
      inProgress: prog.meta.total,
      completed: done.meta.total,
    }
  } catch {
    stats.value = { total: 0, inProgress: 0, completed: 0 }
  } finally {
    statsLoading.value = false
  }
}

async function loadList() {
  const pid = projectId.value
  if (!pid) return
  loading.value = true
  errorMessage.value = ''
  try {
    const st =
      statusFilter.value === ALL_STATUS ? undefined : (statusFilter.value as RepairRequestStatus)
    const res = await listRepairRequests(pid, {
      page: page.value,
      limit: limit.value,
      status: st,
    })
    list.value = res.data
    meta.value = res.meta
  } catch {
    list.value = []
    meta.value = null
    errorMessage.value = '無法載入報修列表'
  } finally {
    loading.value = false
  }
}

function goView(row: RepairRequestItem) {
  router.push({
    name: ROUTE_NAME.PROJECT_REPAIR_RECORD_DETAIL,
    params: { projectId: projectId.value, repairId: row.id },
  })
}

function goNewRepair() {
  if (!ensureProjectPermission(repairRecordPerm.canCreate.value, 'create')) return
  router.push({
    name: ROUTE_NAME.PROJECT_REPAIR_RECORD_NEW,
    params: { projectId: projectId.value },
  })
}

function openRemoveDialog(row: RepairRequestItem) {
  removingItem.value = row
  removeDialogOpen.value = true
}

function closeRemoveDialog() {
  removeDialogOpen.value = false
  removingItem.value = null
}

async function confirmRemove() {
  const item = removingItem.value
  if (!item || !projectId.value) return
  removing.value = true
  errorMessage.value = ''
  try {
    await deleteRepairRequest(projectId.value, item.id)
    closeRemoveDialog()
    rowSelection.value = {}
    await Promise.all([loadList(), loadStats()])
  } catch {
    errorMessage.value = '刪除失敗'
  } finally {
    removing.value = false
  }
}

const columns = computed<ColumnDef<RepairRequestItem, unknown>[]>(() => [
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
    accessorKey: 'customerName',
    id: 'customerName',
    header: () => '客戶',
    cell: ({ row }) =>
      h('div', { class: 'font-medium text-foreground' }, row.original.customerName || '—'),
  },
  {
    accessorKey: 'contactPhone',
    id: 'contactPhone',
    header: () => '聯絡電話',
    cell: ({ row }) =>
      h('div', { class: 'tabular-nums text-foreground' }, row.original.contactPhone || '—'),
  },
  {
    accessorKey: 'problemCategory',
    id: 'problemCategory',
    header: () => '問題類別',
    cell: ({ row }) => h('div', { class: 'text-foreground' }, row.original.problemCategory || '—'),
  },
  {
    id: 'isSecondRepair',
    header: () => '二次',
    cell: ({ row }) =>
      row.original.isSecondRepair
        ? h(Badge, { variant: 'secondary', class: 'font-normal' }, () => '二次報修')
        : h('span', { class: 'text-muted-foreground' }, '—'),
    enableSorting: false,
  },
  {
    accessorKey: 'status',
    id: 'status',
    header: () => '狀態',
    cell: ({ row }) =>
      h(
        'div',
        { class: 'text-foreground' },
        STATUS_LABELS[row.original.status as RepairRequestStatus] ?? row.original.status
      ),
  },
  {
    accessorKey: 'repairContent',
    id: 'repairContent',
    header: () => '報修內容',
    cell: ({ row }) =>
      h(
        'div',
        {
          class: 'max-w-[220px] truncate text-foreground',
          title: row.original.repairContent,
        },
        row.original.repairContent || '—'
      ),
  },
  {
    accessorKey: 'updatedAt',
    id: 'updatedAt',
    header: () => '最後更新',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'tabular-nums text-muted-foreground text-sm' },
        formatDateTime(row.original.updatedAt)
      ),
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'w-[4rem]' }),
    cell: ({ row }) =>
      h(RepairRecordsRowActions, {
        row: row.original,
        canRemove: repairRecordPerm.canDelete.value,
        onView: (r) => {
          if (!ensureProjectPermission(repairRecordPerm.canRead.value, 'read')) return
          goView(r)
        },
        onRemove: openRemoveDialog,
      }),
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
  manualPagination: true,
  get pageCount() {
    return totalPages.value || 1
  },
  onRowSelectionChange: (updater) => valueUpdater(updater, rowSelection),
  state: {
    get pagination() {
      return { pageIndex: page.value - 1, pageSize: limit.value }
    },
    get rowSelection() {
      return rowSelection.value
    },
  },
  onPaginationChange: (updater) => {
    const prev = { pageIndex: page.value - 1, pageSize: limit.value }
    const next = typeof updater === 'function' ? updater(prev) : updater
    if (next) {
      rowSelection.value = {}
      page.value = next.pageIndex + 1
      limit.value = next.pageSize
      loadList()
    }
  },
  getRowId: (row) => row.id,
})

const selectedRows = computed(() => table.getSelectedRowModel().rows)
const hasSelection = computed(() => selectedRows.value.length > 0)

function clearSelection() {
  rowSelection.value = {}
}

function openBatchDelete() {
  batchDeleteOpen.value = true
}

function closeBatchDelete() {
  batchDeleteOpen.value = false
}

async function confirmBatchDelete() {
  const rows = selectedRows.value.map((r) => r.original)
  if (!rows.length || !projectId.value) return
  batchDeleteLoading.value = true
  errorMessage.value = ''
  try {
    for (const item of rows) {
      await deleteRepairRequest(projectId.value, item.id)
    }
    closeBatchDelete()
    rowSelection.value = {}
    await Promise.all([loadList(), loadStats()])
  } catch {
    errorMessage.value = '批次刪除失敗'
  } finally {
    batchDeleteLoading.value = false
  }
}

watch(
  projectId,
  (id) => {
    if (!id) return
    page.value = 1
    rowSelection.value = {}
    loadStats()
    loadList()
  },
  { immediate: true }
)

watch(statusFilter, () => {
  page.value = 1
  rowSelection.value = {}
  loadList()
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">報修紀錄表</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        檢視專案報修單與處理狀態；點「新增報修」於此頁面建立單據。現場亦可使用手機版報修（獨立介面）。
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StateCard title="總筆數">
        <template #icon>
          <FileText class="size-6 text-muted-foreground" />
        </template>
        <div v-if="statsLoading" class="flex items-center gap-2 text-muted-foreground">
          <Loader2 class="size-6 animate-spin" />
        </div>
        <template v-else>
          <p class="text-3xl font-bold tabular-nums text-foreground">
            {{ stats.total }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">本專案報修單總數</p>
        </template>
      </StateCard>
      <StateCard title="進行中">
        <template #icon>
          <Clock class="size-6 text-muted-foreground" />
        </template>
        <div v-if="statsLoading" class="flex items-center gap-2 text-muted-foreground">
          <Loader2 class="size-6 animate-spin" />
        </div>
        <template v-else>
          <p class="text-3xl font-bold tabular-nums text-foreground">
            {{ stats.inProgress }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">狀態為進行中</p>
        </template>
      </StateCard>
      <StateCard title="已完成">
        <template #icon>
          <CheckCircle class="size-6 text-muted-foreground" />
        </template>
        <div v-if="statsLoading" class="flex items-center gap-2 text-muted-foreground">
          <Loader2 class="size-6 animate-spin" />
        </div>
        <template v-else>
          <p class="text-3xl font-bold tabular-nums text-foreground">
            {{ stats.completed }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">狀態為已完成</p>
        </template>
      </StateCard>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <Select v-model="statusFilter">
          <SelectTrigger class="w-[140px] bg-background">
            <SelectValue placeholder="狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_STATUS">全部狀態</SelectItem>
            <SelectItem value="in_progress">進行中</SelectItem>
            <SelectItem value="completed">已完成</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-3">
        <template v-if="hasSelection">
          <span class="text-sm text-muted-foreground">已選 {{ selectedRows.length }} 項</span>
          <ButtonGroup>
            <Button variant="outline" size="sm" @click="clearSelection">取消選取</Button>
            <Button
              v-if="repairRecordPerm.canDelete"
              variant="outline"
              size="sm"
              class="text-destructive hover:text-destructive"
              @click="openBatchDelete"
            >
              批次刪除
            </Button>
          </ButtonGroup>
        </template>
        <Button class="gap-2" @click="goNewRepair">
          <Plus class="size-4" />
          新增報修
        </Button>
      </div>
    </div>

    <div class="rounded-lg border border-border bg-card">
      <p v-if="errorMessage" class="mb-3 px-4 pt-4 text-sm text-destructive">{{ errorMessage }}</p>
      <div v-else-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 class="size-8 animate-spin" />
      </div>
      <template v-else>
        <div class="overflow-x-auto">
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
              <template v-if="list.length === 0">
                <TableRow>
                  <TableCell :colspan="9" class="h-24 text-center text-muted-foreground">
                    尚無報修紀錄。可點上方「新增報修」建立單據，或使用手機版於現場填報。
                  </TableCell>
                </TableRow>
              </template>
              <template v-else-if="table.getRowModel().rows?.length">
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
                  <TableCell :colspan="9" class="h-24 text-center text-muted-foreground">
                    此頁無資料
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
        </div>
      </template>
    </div>
    <div v-if="!loading && !errorMessage && list.length > 0" class="mt-4">
      <DataTablePagination :table="table" />
    </div>

    <Dialog
      v-model:open="removeDialogOpen"
      @update:open="(v: boolean) => !v && closeRemoveDialog()"
    >
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>刪除報修單</DialogTitle>
          <DialogDescription>
            確定要刪除此報修單嗎？客戶「{{
              removingItem?.customerName
            }}」的報修資料與執行紀錄將一併刪除且無法復原。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="closeRemoveDialog">取消</Button>
          <Button variant="destructive" :disabled="removing" @click="confirmRemove">
            <Loader2 v-if="removing" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="batchDeleteOpen" @update:open="(v: boolean) => !v && closeBatchDelete()">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批次刪除</DialogTitle>
          <DialogDescription>
            確定要刪除所選的 {{ selectedRows.length }} 筆報修單嗎？此操作無法復原。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="closeBatchDelete">取消</Button>
          <Button variant="destructive" :disabled="batchDeleteLoading" @click="confirmBatchDelete">
            <Loader2 v-if="batchDeleteLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
