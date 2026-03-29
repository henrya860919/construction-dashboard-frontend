<script setup lang="ts" generic="TData">
import type { Row, Table } from '@tanstack/vue-table'
import { FlexRender } from '@tanstack/vue-table'
import { computed } from 'vue'
import {
  Table as TableRoot,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const props = withDefaults(
  defineProps<{
    table: Table<TData>
    /** 當前分頁無列時顯示於單列（例如篩選後該頁為空） */
    emptyText?: string
    /** 整列可點擊（略過 checkbox／按鈕／連結） */
    rowClickable?: boolean
  }>(),
  {
    emptyText: '此頁無資料',
    rowClickable: false,
  },
)

const emit = defineEmits<{
  rowClick: [row: TData]
}>()

function onRowClick(e: MouseEvent, row: Row<TData>) {
  const t = e.target as HTMLElement
  if (t.closest('a, button, [role="checkbox"], input, label')) return
  emit('rowClick', row.original)
}

const colspan = computed(
  () => props.table.getVisibleLeafColumns().length || 1,
)
</script>

<template>
  <div class="min-w-0 overflow-x-auto overscroll-x-contain">
    <TableRoot :scroll-container="false">
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
            :class="rowClickable ? 'cursor-pointer' : undefined"
            @click="rowClickable ? onRowClick($event, row) : undefined"
          >
            <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
              <FlexRender
                :render="cell.column.columnDef.cell"
                :props="cell.getContext()"
              />
            </TableCell>
          </TableRow>
        </template>
        <TableRow v-else>
          <TableCell
            :colspan="colspan"
            class="h-24 text-center text-muted-foreground"
          >
            {{ emptyText }}
          </TableCell>
        </TableRow>
      </TableBody>
    </TableRoot>
  </div>
</template>
