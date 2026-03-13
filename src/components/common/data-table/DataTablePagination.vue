
<script setup lang="ts" generic="TData">
import type { Table } from '@tanstack/vue-table'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  table: Table<TData>
  /** 無勾選列時隱藏「列已選」區塊（如登入紀錄、稽核日誌） */
  hideSelectionInfo?: boolean
}

withDefaults(defineProps<Props>(), { hideSelectionInfo: false })
</script>

<template>
  <div class="flex items-center justify-between px-2">
    <div v-if="!hideSelectionInfo" class="flex-1 text-sm text-muted-foreground">
      {{ table.getFilteredSelectedRowModel().rows.length }} /
      {{ table.getFilteredRowModel().rows.length }} 列已選
    </div>
    <div v-else class="flex-1" />
    <div class="flex items-center gap-6 lg:gap-8">
      <div class="flex items-center gap-2">
        <p class="text-sm font-medium">每頁筆數</p>
        <Select
          :model-value="`${table.getState().pagination.pageSize}`"
          @update:model-value="(v) => table.setPageSize(Number(v))"
        >
          <SelectTrigger class="h-8 w-[70px]">
            <SelectValue :placeholder="`${table.getState().pagination.pageSize}`" />
          </SelectTrigger>
          <SelectContent side="top">
            <SelectItem
              v-for="pageSize in [10, 20, 30, 40, 50]"
              :key="pageSize"
              :value="`${pageSize}`"
            >
              {{ pageSize }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex w-[120px] items-center justify-center text-sm font-medium">
        第 {{ table.getState().pagination.pageIndex + 1 }} / {{ table.getPageCount() }} 頁
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          class="hidden size-8 lg:flex"
          :disabled="!table.getCanPreviousPage()"
          @click="table.setPageIndex(0)"
        >
          <span class="sr-only">第一頁</span>
          <ChevronsLeft class="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          class="size-8"
          :disabled="!table.getCanPreviousPage()"
          @click="table.previousPage()"
        >
          <span class="sr-only">上一頁</span>
          <ChevronLeft class="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          class="size-8"
          :disabled="!table.getCanNextPage()"
          @click="table.nextPage()"
        >
          <span class="sr-only">下一頁</span>
          <ChevronRight class="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          class="hidden size-8 lg:flex"
          :disabled="!table.getCanNextPage()"
          @click="table.setPageIndex(table.getPageCount() - 1)"
        >
          <span class="sr-only">最後一頁</span>
          <ChevronsRight class="size-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
