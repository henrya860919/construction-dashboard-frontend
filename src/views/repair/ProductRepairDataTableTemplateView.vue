<script setup lang="ts">
import type { ColumnDef, ColumnFiltersState, SortingState, VisibilityState } from '@tanstack/vue-table'
import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import { FlexRender } from '@tanstack/vue-table'
import { computed, h, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  CircleHelp,
  Timer,
  XCircle,
} from 'lucide-vue-next'
import { valueUpdater } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import DataTableDateRangeFilter from '@/components/common/data-table/DataTableDateRangeFilter.vue'
import DataTableFacetedFilter from '@/components/common/data-table/DataTableFacetedFilter.vue'
import DataTableToolbarShell from '@/components/common/data-table/DataTableToolbarShell.vue'
import {
  generateProductRepairDemoRows,
  type DemoRepairPriority,
  type DemoRepairStatus,
  type ProductRepairDemoRow,
} from '@/views/repair/product-repair-demo-mock'

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const data = ref(generateProductRepairDemoRows(150))

const STATUS_LABEL: Record<DemoRepairStatus, string> = {
  todo: '待處理',
  in_progress: '處理中',
  done: '已完成',
  canceled: '已取消',
}

const PRIORITY_LABEL: Record<DemoRepairPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

const BUCKET_LABEL: Record<ProductRepairDemoRow['estHoursBucket'], string> = {
  '0-2': '0–2 小時',
  '3-5': '3–5 小時',
  '6-8': '6–8 小時',
  '9+': '9 小時以上',
}

const statusOptions = [
  { value: 'todo', label: STATUS_LABEL.todo, icon: CircleHelp },
  { value: 'in_progress', label: STATUS_LABEL.in_progress, icon: Timer },
  { value: 'done', label: STATUS_LABEL.done, icon: CheckCircle2 },
  { value: 'canceled', label: STATUS_LABEL.canceled, icon: XCircle },
]

const priorityOptions = [
  { value: 'low', label: PRIORITY_LABEL.low, icon: ArrowDown },
  { value: 'medium', label: PRIORITY_LABEL.medium, icon: ArrowRight },
  { value: 'high', label: PRIORITY_LABEL.high, icon: ArrowUp },
]

const hoursOptions = (Object.keys(BUCKET_LABEL) as ProductRepairDemoRow['estHoursBucket'][]).map(
  (k) => ({
    value: k,
    label: BUCKET_LABEL[k],
  }),
)

const COLUMN_LABELS: Record<string, string> = {
  title: '主旨',
  status: '狀態',
  priority: '優先級',
  estHoursBucket: '預估工時',
  customerName: '客戶',
  createdAt: '建立時間',
}

function statusBadge(status: DemoRepairStatus) {
  const variant =
    status === 'done'
      ? 'default'
      : status === 'canceled'
        ? 'secondary'
        : status === 'in_progress'
          ? 'outline'
          : 'secondary'
  return h(Badge, { variant, class: 'font-normal' }, () => STATUS_LABEL[status])
}

function formatDateTime(d: Date) {
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const globalFilter = ref('')
const columnFilters = ref<ColumnFiltersState>([])
const sorting = ref<SortingState>([])
const columnVisibility = ref<VisibilityState>({})
const rowSelection = ref<Record<string, boolean>>({})

const columns: ColumnDef<ProductRepairDemoRow, unknown>[] = [
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
    enableHiding: false,
  },
  {
    accessorKey: 'title',
    id: 'title',
    header: '主旨',
    cell: ({ row }) =>
      h('div', { class: 'max-w-[240px] truncate font-medium text-foreground' }, row.original.title),
    enableColumnFilter: false,
  },
  {
    accessorKey: 'status',
    id: 'status',
    header: '狀態',
    filterFn: 'arrIncludesSome',
    cell: ({ row }) => statusBadge(row.original.status),
  },
  {
    accessorKey: 'priority',
    id: 'priority',
    header: '優先級',
    filterFn: 'arrIncludesSome',
    cell: ({ row }) => h('span', { class: 'text-foreground' }, PRIORITY_LABEL[row.original.priority]),
  },
  {
    accessorKey: 'estHoursBucket',
    id: 'estHoursBucket',
    header: '預估工時',
    filterFn: 'arrIncludesSome',
    cell: ({ row }) =>
      h('span', { class: 'tabular-nums text-foreground' }, `${row.original.estHours} 小時`),
  },
  {
    accessorKey: 'customerName',
    id: 'customerName',
    header: '客戶',
  },
  {
    accessorKey: 'createdAt',
    id: 'createdAt',
    header: '建立時間',
    sortingFn: 'datetime',
    filterFn: (row, _columnId, raw) => {
      const v = raw as { from?: string; to?: string } | undefined
      if (!v?.from && !v?.to) return true
      const d = row.getValue('createdAt') as Date
      const t = d.getTime()
      if (v.from) {
        const start = new Date(`${v.from}T00:00:00`)
        if (t < start.getTime()) return false
      }
      if (v.to) {
        const end = new Date(`${v.to}T23:59:59.999`)
        if (t > end.getTime()) return false
      }
      return true
    },
    cell: ({ row }) => h('span', { class: 'text-muted-foreground whitespace-nowrap' }, formatDateTime(row.original.createdAt)),
  },
]

const table = useVueTable({
  get data() {
    return data.value
  },
  columns,
  state: {
    get globalFilter() {
      return globalFilter.value
    },
    get columnFilters() {
      return columnFilters.value
    },
    get sorting() {
      return sorting.value
    },
    get columnVisibility() {
      return columnVisibility.value
    },
    get rowSelection() {
      return rowSelection.value
    },
  },
  enableRowSelection: true,
  enableMultiSort: true,
  getRowId: (row) => row.id,
  onGlobalFilterChange: (u) => valueUpdater(u, globalFilter),
  onColumnFiltersChange: (u) => valueUpdater(u, columnFilters),
  onSortingChange: (u) => valueUpdater(u, sorting),
  onColumnVisibilityChange: (u) => valueUpdater(u, columnVisibility),
  onRowSelectionChange: (u) => valueUpdater(u, rowSelection),
  globalFilterFn: (row, _columnId, filterValue) => {
    const q = String(filterValue ?? '').trim().toLowerCase()
    if (!q) return true
    return row.original.title.toLowerCase().includes(q)
  },
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getFacetedRowModel: getFacetedRowModel(),
  getFacetedUniqueValues: getFacetedUniqueValues(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  initialState: {
    pagination: { pageSize: 10, pageIndex: 0 },
  },
})

const hasActiveFilters = computed(() => {
  if (globalFilter.value.trim()) return true
  if (columnFilters.value.length > 0) return true
  if (sorting.value.length > 0) return true
  if (Object.keys(rowSelection.value).length > 0) return true
  return false
})

function resetTableState() {
  globalFilter.value = ''
  columnFilters.value = []
  sorting.value = []
  rowSelection.value = {}
  table.getColumn('createdAt')?.setFilterValue(undefined)
}

const statusColumn = computed(() => table.getColumn('status'))
const priorityColumn = computed(() => table.getColumn('priority'))
const hoursColumn = computed(() => table.getColumn('estHoursBucket'))
const createdAtColumn = computed(() => table.getColumn('createdAt'))
</script>

<template>
  <div class="flex flex-col gap-6 p-4 md:p-6">
    <div>
      <h1 class="text-xl font-semibold text-foreground">
        商品報修表（資料表範本）
      </h1>
      <p class="text-muted-foreground mt-1 text-sm">
        專案 {{ projectId }} · 前端示範：150 筆假資料、分面篩選、日期區間、多欄排序、欄位顯示、全文搜尋主旨。
      </p>
    </div>

    <div class="flex flex-col gap-4">
      <DataTableToolbarShell
        :table="table"
        :column-labels="COLUMN_LABELS"
        :has-active-filters="hasActiveFilters"
        @reset="resetTableState"
      >
        <template #filters>
          <Input
            :model-value="globalFilter"
            class="h-8 max-w-sm"
            placeholder="搜尋主旨…"
            @update:model-value="(v) => table.setGlobalFilter(String(v))"
          />
          <DataTableFacetedFilter
            v-if="statusColumn"
            :column="statusColumn"
            title="狀態"
            :options="statusOptions"
          />
          <DataTableFacetedFilter
            v-if="priorityColumn"
            :column="priorityColumn"
            title="優先級"
            :options="priorityOptions"
          />
          <DataTableFacetedFilter
            v-if="hoursColumn"
            :column="hoursColumn"
            title="預估工時"
            :options="hoursOptions"
          />
          <DataTableDateRangeFilter
            v-if="createdAtColumn"
            :column="createdAtColumn"
            title="建立日期"
          />
        </template>
      </DataTableToolbarShell>

      <div class="rounded-lg border border-border bg-card">
        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow
                v-for="headerGroup in table.getHeaderGroups()"
                :key="headerGroup.id"
                class="hover:bg-transparent"
              >
                <TableHead
                  v-for="header in headerGroup.headers"
                  :key="header.id"
                  class="text-foreground"
                >
                  <FlexRender
                    v-if="!header.isPlaceholder"
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-if="table.getRowModel().rows.length">
                <TableRow
                  v-for="row in table.getRowModel().rows"
                  :key="row.id"
                  :data-state="row.getIsSelected() ? 'selected' : undefined"
                >
                  <TableCell
                    v-for="cell in row.getVisibleCells()"
                    :key="cell.id"
                  >
                    <FlexRender
                      :render="cell.column.columnDef.cell"
                      :props="cell.getContext()"
                    />
                  </TableCell>
                </TableRow>
              </template>
              <TableRow v-else>
                <TableCell
                  :colspan="columns.length"
                  class="h-24 text-center text-muted-foreground"
                >
                  此頁無資料
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
      <div v-if="data.length > 0" class="mt-4">
        <DataTablePagination :table="table" />
      </div>
    </div>
  </div>
</template>
