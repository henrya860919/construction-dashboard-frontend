<script setup lang="ts">
import type { Column } from '@tanstack/vue-table'
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Props {
  /** 各列表列型別不同，表頭元件僅呼叫排序／隱藏 API */
  column: Column<any, unknown>
  title: string
  class?: string
}

defineProps<Props>()
</script>

<template>
  <div
    v-if="column.getCanSort()"
    :class="cn('flex items-center gap-2', $props.class)"
  >
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="-ml-3 h-8 data-[state=open]:bg-accent"
        >
          <span>{{ title }}</span>
          <ArrowDown
            v-if="column.getIsSorted() === 'desc'"
            class="ml-2 size-4"
          />
          <ArrowUp
            v-else-if="column.getIsSorted() === 'asc'"
            class="ml-2 size-4"
          />
          <ChevronsUpDown
            v-else
            class="ml-2 size-4"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem @click="column.toggleSorting(false)">
          <ArrowUp class="mr-2 size-3.5 text-muted-foreground/70" />
          升序
        </DropdownMenuItem>
        <DropdownMenuItem @click="column.toggleSorting(true)">
          <ArrowDown class="mr-2 size-3.5 text-muted-foreground/70" />
          降序
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @click="column.toggleVisibility(false)">
          <EyeOff class="mr-2 size-3.5 text-muted-foreground/70" />
          隱藏欄位
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
  <div v-else :class="$props.class">
    {{ title }}
  </div>
</template>
