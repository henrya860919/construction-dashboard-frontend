<script setup lang="ts" generic="TData">
import type { Table } from '@tanstack/vue-table'
import { Search } from 'lucide-vue-next'
import { computed } from 'vue'
import { Input } from '@/components/ui/input'
import type { TableListFeatures } from '@/types/data-table'
import DataTableDateRangeFilter from './DataTableDateRangeFilter.vue'
import DataTableFacetedFilter from './DataTableFacetedFilter.vue'
import DataTableToolbarShell from './DataTableToolbarShell.vue'

const props = withDefaults(
  defineProps<{
    table: Table<TData>
    features: TableListFeatures
    columnLabels: Record<string, string>
    hasActiveFilters: boolean
    globalFilter: string
    searchPlaceholder?: string
    /** 載入中時隱藏搜尋框（篩選下拉與操作列仍可顯示） */
    searchDisabled?: boolean
    /**
     * 有勾選列時隱藏搜尋／篩選／多欄排序／欄位顯示，且不出現「重設」（與 #actions 批次區擇一呈現）
     */
    collapseWhenRowSelection?: boolean
  }>(),
  { collapseWhenRowSelection: true, searchDisabled: false },
)

const emit = defineEmits<{
  reset: []
}>()

const facetedColumns = computed(() =>
  props.table
    .getAllColumns()
    .filter(
      (c) => c.getIsVisible() && c.columnDef.meta?.filter?.type === 'faceted',
    ),
)

const dateColumns = computed(() =>
  props.table
    .getAllColumns()
    .filter(
      (c) => c.getIsVisible() && c.columnDef.meta?.filter?.type === 'dateRange',
    ),
)

const hasRowSelection = computed(
  () => Object.keys(props.table.getState().rowSelection).length > 0,
)

const hideFeatureChrome = computed(
  () => props.collapseWhenRowSelection && hasRowSelection.value,
)

const showFilterAndSortChrome = computed(
  () => !hideFeatureChrome.value,
)

const effectiveHasActiveFilters = computed(
  () => props.hasActiveFilters && !hideFeatureChrome.value,
)
</script>

<template>
  <DataTableToolbarShell
    :table="table"
    :column-labels="columnLabels"
    :has-active-filters="effectiveHasActiveFilters"
    :show-multi-sort="features.filtersAndSort && showFilterAndSortChrome"
    :show-column-visibility="features.columnVisibility && showFilterAndSortChrome"
    @reset="emit('reset')"
  >
    <template #filters>
      <template v-if="showFilterAndSortChrome">
        <div
          v-if="features.search && !searchDisabled"
          class="relative min-w-0 max-w-sm shrink-0 sm:min-w-[240px]"
        >
          <Search
            class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            :model-value="globalFilter"
            type="search"
            class="h-8 w-full bg-background pl-9"
            :placeholder="searchPlaceholder ?? '搜尋…'"
            autocomplete="off"
            @update:model-value="(v) => table.setGlobalFilter(String(v ?? ''))"
          />
        </div>
      </template>
      <slot name="prepend-filters" />
      <template v-if="showFilterAndSortChrome">
        <template v-for="col in facetedColumns" :key="col.id">
          <DataTableFacetedFilter
            v-if="col.columnDef.meta?.filter?.type === 'faceted'"
            :column="col"
            :title="col.columnDef.meta.filter.title"
            :options="col.columnDef.meta.filter.options"
          />
        </template>
        <template v-for="col in dateColumns" :key="`d-${col.id}`">
          <DataTableDateRangeFilter
            v-if="col.columnDef.meta?.filter?.type === 'dateRange'"
            :column="col"
            :title="col.columnDef.meta.filter.title"
          />
        </template>
      </template>
    </template>
    <template #actions>
      <slot name="actions" />
    </template>
  </DataTableToolbarShell>
</template>
