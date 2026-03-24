import type {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  SortingState,
  VisibilityState,
} from '@tanstack/vue-table'
import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import type { Table } from '@tanstack/vue-table'
import { computed, ref, unref, type ComputedRef, type MaybeRef, type Ref } from 'vue'
import { valueUpdater } from '@/lib/utils'
import type { TableListFeatures } from '@/types/data-table'

export function useClientDataTable<TData>(options: {
  data: Ref<TData[]>
  columns: Ref<ColumnDef<TData, unknown>[]>
  features: MaybeRef<TableListFeatures>
  getRowId: (row: TData) => string
  initialPageSize?: number
  /** search 開啟時建議必填；未傳則不篩列（全通過） */
  globalFilterFn?: FilterFn<TData>
  enableRowSelection?: MaybeRef<boolean>
}): {
  table: Table<TData>
  globalFilter: Ref<string>
  hasActiveFilters: ComputedRef<boolean>
  resetTableState: () => void
} {
  const featuresRef = computed(() => unref(options.features))

  const globalFilter = ref('')
  const columnFilters = ref<ColumnFiltersState>([])
  const sorting = ref<SortingState>([])
  const columnVisibility = ref<VisibilityState>({})
  const rowSelection = ref<Record<string, boolean>>({})

  const defaultGlobalFilterFn: FilterFn<TData> = () => true

  const table = useVueTable({
    get data() {
      return options.data.value
    },
    get columns() {
      return options.columns.value
    },
    get enableRowSelection() {
      return unref(options.enableRowSelection) ?? true
    },
    get enableSorting() {
      return featuresRef.value.filtersAndSort
    },
    get enableMultiSort() {
      return featuresRef.value.filtersAndSort
    },
    get enableColumnFilters() {
      return featuresRef.value.filtersAndSort
    },
    get enableHiding() {
      return featuresRef.value.columnVisibility
    },
    get enableGlobalFilter() {
      return featuresRef.value.search
    },
    globalFilterFn: options.globalFilterFn ?? defaultGlobalFilterFn,
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
    onGlobalFilterChange: (updater) => valueUpdater(updater, globalFilter),
    onColumnFiltersChange: (updater) => valueUpdater(updater, columnFilters),
    onSortingChange: (updater) => valueUpdater(updater, sorting),
    onColumnVisibilityChange: (updater) => valueUpdater(updater, columnVisibility),
    onRowSelectionChange: (updater) => valueUpdater(updater, rowSelection),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: options.getRowId,
    initialState: {
      pagination: { pageSize: options.initialPageSize ?? 10, pageIndex: 0 },
    },
  })

  /** 僅搜尋／欄位篩選／排序；不含列勾選（重設為篩選用，與批次選取分開） */
  const hasActiveFilters = computed(() => {
    if (featuresRef.value.search && globalFilter.value.trim()) return true
    if (featuresRef.value.filtersAndSort && columnFilters.value.length > 0) return true
    if (featuresRef.value.filtersAndSort && sorting.value.length > 0) return true
    return false
  })

  function resetTableState() {
    globalFilter.value = ''
    columnFilters.value = []
    sorting.value = []
    rowSelection.value = {}
    for (const col of table.getAllColumns()) {
      if (col.columnDef.meta?.filter?.type === 'dateRange') {
        col.setFilterValue(undefined)
      }
    }
  }

  return {
    table,
    globalFilter,
    hasActiveFilters,
    resetTableState,
  }
}
