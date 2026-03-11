<script setup lang="ts" generic="TData">
import type { Table } from '@tanstack/vue-table'
import { Input } from '@/components/ui/input'
import DataTableViewOptions from './DataTableViewOptions.vue'

interface Props {
  table: Table<TData>
  /** 要綁定篩選的欄位 id（如 'name', 'email'） */
  filterColumnId?: string
  /** 搜尋框 placeholder */
  filterPlaceholder?: string
  /** 是否顯示欄位顯示/隱藏開關按鈕 */
  showViewOptions?: boolean
}

withDefaults(defineProps<Props>(), {
  filterPlaceholder: '搜尋...',
  showViewOptions: true,
})
</script>

<template>
  <div class="flex items-center gap-4 py-4">
    <Input
      v-if="filterColumnId"
      :model-value="(table.getColumn(filterColumnId)?.getFilterValue() as string) ?? ''"
      :placeholder="filterPlaceholder"
      class="max-w-sm"
      @update:model-value="table.getColumn(filterColumnId)?.setFilterValue($event)"
    />
    <DataTableViewOptions v-if="showViewOptions" :table="table" />
  </div>
</template>
