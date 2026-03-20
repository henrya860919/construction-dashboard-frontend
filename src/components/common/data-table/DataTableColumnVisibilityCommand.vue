<script setup lang="ts" generic="TData">
import type { Table } from '@tanstack/vue-table'
import { computed, ref } from 'vue'
import { Check, Settings2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const props = defineProps<{
  table: Table<TData>
  /** 欄位 id → 顯示名稱（未提供則用 id） */
  columnLabels?: Record<string, string>
}>()

const open = ref(false)

const hideable = computed(() =>
  props.table
    .getAllColumns()
    .filter((c) => typeof c.accessorFn !== 'undefined' && c.getCanHide()),
)

function labelFor(id: string) {
  return props.columnLabels?.[id] ?? id
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="ml-auto hidden h-8 lg:flex"
      >
        <Settings2 class="size-4" />
        欄位顯示
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[220px] p-0" align="end">
      <Command>
        <CommandInput placeholder="搜尋欄位…" />
        <CommandList>
          <CommandEmpty>找不到欄位</CommandEmpty>
          <CommandGroup heading="欄位">
            <CommandItem
              v-for="column in hideable"
              :key="column.id"
              :value="labelFor(column.id)"
              @select="
                () => {
                  column.toggleVisibility(!column.getIsVisible())
                }
              "
            >
              <div
                :class="
                  cn(
                    'border-primary mr-2 flex size-4 items-center justify-center rounded-sm border',
                    column.getIsVisible()
                      ? 'bg-primary text-primary-foreground'
                      : 'opacity-50 [&_svg]:invisible',
                  )
                "
              >
                <Check class="size-3" />
              </div>
              <span class="truncate">{{ labelFor(column.id) }}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
