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
import { ref, computed, h, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { valueUpdater } from '@/lib/utils'
import StateCard from '@/components/common/StateCard.vue'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
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
import { Badge } from '@/components/ui/badge'
import DataTableColumnHeader from '@/components/common/data-table/DataTableColumnHeader.vue'
import ScheduleRowActions from '@/views/contract/ScheduleRowActions.vue'
import type { Column } from '@tanstack/vue-table'
import type { ScheduleAdjustmentRow } from '@/types'
import { CalendarRange, Plus, Calendar, Hash, CheckCircle, Loader2 } from 'lucide-vue-next'
import {
  getProject,
  getScheduleAdjustments,
  createScheduleAdjustment,
  updateScheduleAdjustment,
  deleteScheduleAdjustment,
} from '@/api/project'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { ensureProjectPermission } from '@/lib/permission-toast'

const route = useRoute()

function getProjectId(): string {
  return (route.params.projectId as string) ?? ''
}

const projectIdRef = computed(() => getProjectId())
const durationPerm = useProjectModuleActions(projectIdRef, 'project.duration')

/** 類型選項 */
const TYPE_OPTIONS = [
  { value: 'extension', label: '展延' },
  { value: 'suspension', label: '停工' },
  { value: 'other', label: '其他' },
] as const

/** 申請狀態選項 */
const STATUS_OPTIONS = [
  { value: 'pending', label: '待審' },
  { value: 'approved', label: '已核定' },
  { value: 'rejected', label: '駁回' },
] as const

const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')

/** 專案資訊（開工、工期、預定完工=開工+工期、預定竣工=開工+工期+調整天數） */
const projectInfo = ref<{
  startDate: string | null
  plannedDurationDays: number | null
  plannedEndDate: string | null
  revisedEndDate: string | null
} | null>(null)

/** 工期調整列表 */
const list = ref<ScheduleAdjustmentRow[]>([])

/** 上方摘要：預定完工=開工+工期，預定竣工=開工+工期+核定調整天數（API 已計算 revisedEndDate） */
const summary = computed(() => {
  const totalApplyDays = list.value.reduce((s, r) => s + r.applyDays, 0)
  const totalApprovedDays = list.value.reduce((s, r) => s + r.approvedDays, 0)
  const startDate = projectInfo.value?.startDate ? projectInfo.value.startDate.slice(0, 10) : '—'
  const plannedEndDate = projectInfo.value?.revisedEndDate
    ? projectInfo.value.revisedEndDate.slice(0, 10)
    : projectInfo.value?.plannedEndDate
      ? projectInfo.value.plannedEndDate.slice(0, 10)
      : '—'
  return { totalApplyDays, totalApprovedDays, startDate, plannedEndDate }
})

/** 新增 Modal */
const dialogOpen = ref(false)
const form = ref({
  applyDate: '',
  type: 'extension',
  applyDays: 0,
  approvedDays: 0,
  status: 'pending',
})

/** 編輯 Modal */
const editDialogOpen = ref(false)
/** 僅檢視（來自「查看」）；為 false 時可儲存 */
const editDialogReadOnly = ref(false)
const editingId = ref('')
const editForm = ref({
  applyDate: '',
  type: 'extension',
  applyDays: 0,
  approvedDays: 0,
  status: 'pending',
})

/** 刪除確認 */
const deleteDialogOpen = ref(false)
const deletingRow = ref<ScheduleAdjustmentRow | null>(null)

function typeLabel(value: string): string {
  return TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

function statusLabel(value: string): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value
}

/** API 回傳的 applyDate 可能為 ISO，顯示用 YYYY-MM-DD */
function formatApplyDate(applyDate: string): string {
  if (!applyDate) return '—'
  return applyDate.slice(0, 10)
}

async function loadData() {
  const projectId = getProjectId()
  if (!projectId) return
  loading.value = true
  errorMessage.value = ''
  try {
    const [project, adjustments] = await Promise.all([
      getProject(projectId),
      getScheduleAdjustments(projectId),
    ])
    if (project) {
      projectInfo.value = {
        startDate: project.startDate,
        plannedDurationDays: project.plannedDurationDays ?? null,
        plannedEndDate: project.plannedEndDate,
        revisedEndDate: project.revisedEndDate,
      }
    } else {
      projectInfo.value = null
    }
    list.value = adjustments ?? []
  } catch {
    errorMessage.value = '無法載入工期調整資料'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
watch(() => route.params.projectId, loadData)

function closeDialog() {
  dialogOpen.value = false
}

function tryOpenAddDialog() {
  if (!ensureProjectPermission(durationPerm.canCreate.value, 'create')) return
  dialogOpen.value = true
}

async function submitAdd() {
  if (!form.value.applyDate.trim()) return
  const projectId = getProjectId()
  if (!projectId) return
  saving.value = true
  errorMessage.value = ''
  try {
    await createScheduleAdjustment(projectId, {
      applyDate: form.value.applyDate,
      type: form.value.type,
      applyDays: form.value.applyDays,
      approvedDays: form.value.approvedDays,
      status: form.value.status,
    })
    form.value = {
      applyDate: '',
      type: 'extension',
      applyDays: 0,
      approvedDays: 0,
      status: 'pending',
    }
    dialogOpen.value = false
    await loadData()
  } catch {
    errorMessage.value = '新增失敗'
  } finally {
    saving.value = false
  }
}

function fillEditForm(row: ScheduleAdjustmentRow) {
  editingId.value = row.id
  editForm.value = {
    applyDate: formatApplyDate(row.applyDate),
    type: row.type,
    applyDays: row.applyDays,
    approvedDays: row.approvedDays,
    status: row.status,
  }
}

function openForEdit(row: ScheduleAdjustmentRow) {
  editDialogReadOnly.value = false
  fillEditForm(row)
  editDialogOpen.value = true
}

function openForView(row: ScheduleAdjustmentRow) {
  if (!ensureProjectPermission(durationPerm.canRead.value, 'read')) return
  editDialogReadOnly.value = true
  fillEditForm(row)
  editDialogOpen.value = true
}

function closeEditDialog() {
  editDialogOpen.value = false
  editingId.value = ''
  editDialogReadOnly.value = false
}

async function submitEdit() {
  if (editDialogReadOnly.value || !durationPerm.canUpdate.value) return
  const projectId = getProjectId()
  if (!projectId || !editingId.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    await updateScheduleAdjustment(projectId, editingId.value, {
      applyDate: editForm.value.applyDate,
      type: editForm.value.type,
      applyDays: editForm.value.applyDays,
      approvedDays: editForm.value.approvedDays,
      status: editForm.value.status,
    })
    closeEditDialog()
    await loadData()
  } catch {
    errorMessage.value = '更新失敗'
  } finally {
    saving.value = false
  }
}

function openDelete(row: ScheduleAdjustmentRow) {
  if (!durationPerm.canDelete.value) return
  deletingRow.value = row
  deleteDialogOpen.value = true
}

function closeDeleteDialog() {
  deleteDialogOpen.value = false
  deletingRow.value = null
}

async function confirmDelete() {
  if (!durationPerm.canDelete.value) return
  const projectId = getProjectId()
  const row = deletingRow.value
  if (!projectId || !row) return
  saving.value = true
  errorMessage.value = ''
  try {
    await deleteScheduleAdjustment(projectId, row.id)
    closeDeleteDialog()
    await loadData()
  } catch {
    errorMessage.value = '刪除失敗'
  } finally {
    saving.value = false
  }
}

/** 表格：排序與選取 */
const sorting = ref<SortingState>([])
const rowSelection = ref<Record<string, boolean>>({})

/** DataTable 欄位定義（第一欄為勾選，有刪除權時顯示） */
const columns = computed<ColumnDef<ScheduleAdjustmentRow, unknown>[]>(() => {
  const selectColumn: ColumnDef<ScheduleAdjustmentRow, unknown> = {
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
  }

  const cols: ColumnDef<ScheduleAdjustmentRow, unknown>[] = []
  if (durationPerm.canDelete.value) {
    cols.push(selectColumn)
  }

  cols.push(
  {
    accessorKey: 'applyDate',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as Column<unknown, unknown>,
        title: '申請日期',
      }),
    cell: ({ row }) =>
      h(
        'div',
        { class: 'font-medium text-foreground' },
        formatApplyDate(row.getValue('applyDate') as string)
      ),
  },
  {
    accessorKey: 'type',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as Column<unknown, unknown>,
        title: '類型',
      }),
    cell: ({ row }) =>
      h('div', { class: 'text-foreground' }, typeLabel(row.getValue('type') as string)),
  },
  {
    accessorKey: 'applyDays',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as Column<unknown, unknown>,
        title: '申請天數',
      }),
    cell: ({ row }) =>
      h(
        'div',
        { class: 'tabular-nums text-foreground' },
        `${row.getValue('applyDays') as number} 天`
      ),
  },
  {
    accessorKey: 'approvedDays',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as Column<unknown, unknown>,
        title: '核定天數',
      }),
    cell: ({ row }) =>
      h(
        'div',
        { class: 'tabular-nums text-foreground' },
        `${row.getValue('approvedDays') as number} 天`
      ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as Column<unknown, unknown>,
        title: '申請狀態',
      }),
    cell: ({ row }) => {
      const s = row.getValue('status') as string
      const variant = s === 'approved' ? 'default' : s === 'rejected' ? 'destructive' : 'secondary'
      return h(Badge, { variant }, () => statusLabel(s))
    },
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'w-[80px]' }),
    cell: ({ row }) =>
      h('div', { class: 'flex' }, [
        h(ScheduleRowActions, {
          row: row.original,
          canEdit: durationPerm.canUpdate.value,
          canDelete: durationPerm.canDelete.value,
          onEdit: (r) => openForEdit(r),
          onView: (r) => openForView(r),
          onDelete: (r) => openDelete(r),
        }),
      ]),
    enableSorting: false,
  },
  )

  return cols
})

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

function clearSelection() {
  rowSelection.value = {}
}

/** 批次刪除 */
const batchDeleteOpen = ref(false)
const batchDeleteLoading = ref(false)

function openBatchDelete() {
  batchDeleteOpen.value = true
}

function closeBatchDelete() {
  batchDeleteOpen.value = false
}

async function confirmBatchDelete() {
  if (!durationPerm.canDelete.value) return
  const projectId = getProjectId()
  if (!projectId) return
  const ids = selectedRows.value.map((r) => r.original.id)
  if (!ids.length) return
  batchDeleteLoading.value = true
  errorMessage.value = ''
  try {
    for (const id of ids) {
      await deleteScheduleAdjustment(projectId, id)
    }
    closeBatchDelete()
    rowSelection.value = {}
    await loadData()
  } catch {
    errorMessage.value = '批次刪除失敗'
  } finally {
    batchDeleteLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">工期調整</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        展延／停工申請與核定紀錄，預計竣工日期依核定展延天數計算
      </p>
    </div>

    <!-- 上方摘要：申請天數、核定天數、開工時間、預計竣工日期（與儀表板 StateCard 同規範） -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StateCard title="申請天數">
        <template #icon>
          <Hash class="size-6 text-muted-foreground" />
        </template>
        <p class="text-3xl font-bold tabular-nums text-foreground">
          {{ summary.totalApplyDays }} 天
        </p>
        <p class="mt-1 text-xs text-muted-foreground">展延／停工申請合計</p>
      </StateCard>
      <StateCard title="核定天數">
        <template #icon>
          <CheckCircle class="size-6 text-muted-foreground" />
        </template>
        <p class="text-3xl font-bold tabular-nums text-foreground">
          {{ summary.totalApprovedDays }} 天
        </p>
        <p class="mt-1 text-xs text-muted-foreground">已核定調整天數</p>
      </StateCard>
      <StateCard title="開工時間">
        <template #icon>
          <Calendar class="size-6 text-muted-foreground" />
        </template>
        <p class="text-3xl font-bold tabular-nums text-foreground">
          {{ summary.startDate }}
        </p>
        <p class="mt-1 text-xs text-muted-foreground">專案開工日</p>
      </StateCard>
      <StateCard title="預定竣工日期">
        <template #icon>
          <CalendarRange class="size-6 text-muted-foreground" />
        </template>
        <p class="text-3xl font-bold tabular-nums text-foreground">
          {{ summary.plannedEndDate }}
        </p>
        <p class="mt-1 text-xs text-muted-foreground">開工 + 工期 + 核定調整天數</p>
      </StateCard>
    </div>

    <!-- 工具列：已選 + ButtonGroup + 新增在右 -->
    <div class="flex flex-wrap items-center justify-end gap-3">
      <template v-if="hasSelection && durationPerm.canDelete">
        <span class="text-sm text-muted-foreground">已選 {{ selectedRows.length }} 項</span>
        <ButtonGroup>
          <Button variant="outline" @click="clearSelection"> 取消選取 </Button>
          <Button
            variant="outline"
            class="text-destructive hover:text-destructive"
            @click="openBatchDelete"
          >
            批次刪除
          </Button>
        </ButtonGroup>
      </template>
      <Button class="gap-2" @click="tryOpenAddDialog">
        <Plus class="size-4" />
        新增
      </Button>
      <Dialog v-model:open="dialogOpen">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增工期調整</DialogTitle>
            <DialogDescription>
              填寫申請日期、類型、申請天數與核定天數，申請狀態可選待審／已核定／駁回。
            </DialogDescription>
          </DialogHeader>
          <div class="grid gap-4 py-4">
            <div class="grid gap-2">
              <label class="text-sm font-medium text-foreground">申請日期</label>
              <Input v-model="form.applyDate" type="date" placeholder="請選擇日期" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-foreground">類型</label>
              <Select v-model="form.type">
                <SelectTrigger>
                  <SelectValue placeholder="請選擇類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt in TYPE_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="grid gap-2">
                <label class="text-sm font-medium text-foreground">申請天數</label>
                <Input v-model.number="form.applyDays" type="number" min="0" placeholder="0" />
              </div>
              <div class="grid gap-2">
                <label class="text-sm font-medium text-foreground">核定天數</label>
                <Input v-model.number="form.approvedDays" type="number" min="0" placeholder="0" />
              </div>
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-foreground">申請狀態</label>
              <Select v-model="form.status">
                <SelectTrigger>
                  <SelectValue placeholder="請選擇狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="closeDialog"> 取消 </Button>
            <Button :disabled="saving" @click="submitAdd">
              <Loader2 v-if="saving" class="mr-2 size-4 animate-spin" />
              送出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- 編輯工期調整 -->
      <Dialog v-model:open="editDialogOpen">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{{ editDialogReadOnly ? '查看工期調整' : '編輯工期調整' }}</DialogTitle>
            <DialogDescription>
              {{ editDialogReadOnly ? '檢視申請內容。' : '修改申請日期、類型、天數與狀態。' }}
            </DialogDescription>
          </DialogHeader>
          <div class="grid gap-4 py-4">
            <div class="grid gap-2">
              <label class="text-sm font-medium text-foreground">申請日期</label>
              <Input v-model="editForm.applyDate" type="date" :disabled="editDialogReadOnly" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-foreground">類型</label>
              <Select v-model="editForm.type" :disabled="editDialogReadOnly">
                <SelectTrigger :disabled="editDialogReadOnly">
                  <SelectValue placeholder="請選擇類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt in TYPE_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="grid gap-2">
                <label class="text-sm font-medium text-foreground">申請天數</label>
                <Input
                  v-model.number="editForm.applyDays"
                  type="number"
                  min="0"
                  :disabled="editDialogReadOnly"
                />
              </div>
              <div class="grid gap-2">
                <label class="text-sm font-medium text-foreground">核定天數</label>
                <Input
                  v-model.number="editForm.approvedDays"
                  type="number"
                  min="0"
                  :disabled="editDialogReadOnly"
                />
              </div>
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-foreground">申請狀態</label>
              <Select v-model="editForm.status" :disabled="editDialogReadOnly">
                <SelectTrigger :disabled="editDialogReadOnly">
                  <SelectValue placeholder="請選擇狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="closeEditDialog"> 取消 </Button>
            <Button v-if="!editDialogReadOnly" :disabled="saving" @click="submitEdit">
              <Loader2 v-if="saving" class="mr-2 size-4 animate-spin" />
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- 刪除確認 -->
      <Dialog v-model:open="deleteDialogOpen">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription> 確定要刪除此筆工期調整紀錄？此操作無法復原。 </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="closeDeleteDialog">取消</Button>
            <Button variant="destructive" :disabled="saving" @click="confirmDelete">
              <Loader2 v-if="saving" class="mr-2 size-4 animate-spin" />
              {{ saving ? '刪除中…' : '刪除' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- 批次刪除確認 -->
      <Dialog v-model:open="batchDeleteOpen">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>批次刪除</DialogTitle>
            <DialogDescription>
              確定要刪除所選的 {{ selectedRows.length }} 筆工期調整紀錄？此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="closeBatchDelete">取消</Button>
            <Button
              variant="destructive"
              :disabled="batchDeleteLoading"
              @click="confirmBatchDelete"
            >
              <Loader2 v-if="batchDeleteLoading" class="mr-2 size-4 animate-spin" />
              {{ batchDeleteLoading ? '刪除中…' : '確認刪除' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

    <!-- 表格區塊（無 Card 包覆） -->
    <div class="rounded-lg border border-border bg-card p-4">
      <p v-if="errorMessage" class="p-4 text-sm text-destructive">{{ errorMessage }}</p>
      <div v-else-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
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
                  尚無工期調整紀錄
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
        <DataTablePagination :table="table" />
      </template>
    </div>
  </div>
</template>
