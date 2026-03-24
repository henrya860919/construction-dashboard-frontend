<script setup lang="ts" generic="TData">
import type { Table } from '@tanstack/vue-table'
import { X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import DataTableColumnVisibilityCommand from './DataTableColumnVisibilityCommand.vue'
import DataTableMultiSortPopover from './DataTableMultiSortPopover.vue'

withDefaults(
  defineProps<{
    table: Table<TData>
    /** 傳給「排序」「欄位顯示」的欄位顯示名稱 */
    columnLabels?: Record<string, string>
    /** 為 true 時顯示「重設」按鈕 */
    hasActiveFilters?: boolean
    showMultiSort?: boolean
    showColumnVisibility?: boolean
  }>(),
  {
    columnLabels: () => ({}),
    hasActiveFilters: false,
    showMultiSort: true,
    showColumnVisibility: true,
  },
)

const emit = defineEmits<{
  reset: []
}>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <!-- 左側：搜尋、分面篩選、日期等由各頁自行放入 -->
    <slot
      name="filters"
      :table="table"
    />
    <div class="hidden min-w-[1rem] flex-1 md:block" />
    <Button
      v-if="hasActiveFilters"
      variant="ghost"
      class="h-8 px-2 lg:px-3"
      type="button"
      @click="emit('reset')"
    >
      <X class="mr-1 size-4" />
      重設
    </Button>
    <DataTableMultiSortPopover
      v-if="showMultiSort"
      :table="table"
      :column-labels="columnLabels"
    />
    <DataTableColumnVisibilityCommand
      v-if="showColumnVisibility"
      :table="table"
      :column-labels="columnLabels"
    />
    <!-- 最右側：已選／批次、新增／上傳等主要動作（對齊列表頁工具列規範） -->
    <slot
      name="actions"
      :table="table"
    />
  </div>
</template>
