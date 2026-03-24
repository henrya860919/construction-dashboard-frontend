<script setup lang="ts" generic="TData, TValue">
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from '@tanstack/vue-table'
import { ref } from 'vue'
import {
  FlexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import { valueUpdater } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import DataTablePagination from './DataTablePagination.vue'
import DataTableToolbar from './DataTableToolbar.vue'

const props = withDefaults(
  defineProps<{
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    /** 要顯示篩選的欄位 id，設定後顯示搜尋框 */
    filterColumnId?: string
    filterPlaceholder?: string
    /** 是否顯示欄位顯示/隱藏開關按鈕 */
    showViewOptions?: boolean
    /** 預設每頁筆數 */
    pageSize?: number
  }>(),
  {
    filterPlaceholder: '搜尋...',
    showViewOptions: true,
    pageSize: 10,
  },
)

const sorting = ref<SortingState>([])
const columnFilters = ref<ColumnFiltersState>([])
const columnVisibility = ref<VisibilityState>({})
const rowSelection = ref<Record<string, boolean>>({})

const table = useVueTable({
  get data() {
    return props.data
  },
  get columns() {
    return props.columns
  },
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  onSortingChange: (updater) => valueUpdater(updater, sorting),
  onColumnFiltersChange: (updater) => valueUpdater(updater, columnFilters),
  onColumnVisibilityChange: (updater) => valueUpdater(updater, columnVisibility),
  onRowSelectionChange: (updater) => valueUpdater(updater, rowSelection),
  state: {
    get sorting() {
      return sorting.value
    },
    get columnFilters() {
      return columnFilters.value
    },
    get columnVisibility() {
      return columnVisibility.value
    },
    get rowSelection() {
      return rowSelection.value
    },
  },
  initialState: {
    pagination: {
      pageSize: props.pageSize,
    },
  },
})
</script>

<template>
  <div class="min-w-0 space-y-4">
    <!-- Toolbar: 搜尋（可選）+ 欄位切換（可選） -->
    <DataTableToolbar
      v-if="filterColumnId || showViewOptions"
      :table="table"
      :filter-column-id="filterColumnId"
      :filter-placeholder="filterPlaceholder"
      :show-view-options="showViewOptions"
    />

    <!-- 表格：外層橫向捲動，避免撐開版面主區 -->
    <div class="min-w-0 overflow-x-auto overscroll-x-contain rounded-md border">
      <Table :scroll-container="false">
        <TableHeader>
          <TableRow
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
          >
            <TableHead
              v-for="header in headerGroup.headers"
              :key="header.id"
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
          <template v-if="table.getRowModel().rows?.length">
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
          <template v-else>
            <TableRow>
              <TableCell
                :colspan="props.columns.length"
                class="h-24 text-center"
              >
                無資料
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <!-- 分頁（已在橫向捲動容器外；父層 space-y-4 與表格區隔） -->
    <DataTablePagination :table="table" />
  </div>
</template>
