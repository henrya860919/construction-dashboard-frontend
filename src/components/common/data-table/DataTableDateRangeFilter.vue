<script setup lang="ts" generic="TData">
import type { Column } from '@tanstack/vue-table'
import { computed, ref, watch } from 'vue'
import { CalendarIcon, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'

export type DateRangeFilterValue = { from?: string; to?: string }

const props = defineProps<{
  column?: Column<TData, unknown>
  title?: string
}>()

const open = ref(false)

const fromStr = ref('')
const toStr = ref('')

const filterVal = computed(() => props.column?.getFilterValue() as DateRangeFilterValue | undefined)

watch(
  filterVal,
  (v) => {
    fromStr.value = v?.from ?? ''
    toStr.value = v?.to ?? ''
  },
  { immediate: true },
)

const summary = computed(() => {
  const v = filterVal.value
  if (!v?.from && !v?.to) return null
  if (v.from && v.to) return `${v.from} ~ ${v.to}`
  if (v.from) return `${v.from} 起`
  return `至 ${v.to}`
})

function apply() {
  const from = fromStr.value.trim() || undefined
  const to = toStr.value.trim() || undefined
  if (!from && !to) {
    props.column?.setFilterValue(undefined)
  }
  else {
    props.column?.setFilterValue({ from, to })
  }
  open.value = false
}

function clear() {
  fromStr.value = ''
  toStr.value = ''
  props.column?.setFilterValue(undefined)
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="h-8 gap-1.5 border-dashed bg-background"
      >
        <CalendarIcon class="size-4 shrink-0" />
        {{ title ?? '建立日期' }}
        <template v-if="summary">
          <Separator
            orientation="vertical"
            class="mx-2 h-4"
          />
          <span class="text-muted-foreground max-w-[140px] truncate font-normal">{{ summary }}</span>
        </template>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-4" align="start">
      <div class="grid gap-3">
        <div class="grid gap-2">
          <Label for="demo-date-from" class="text-xs">起始日</Label>
          <Input
            id="demo-date-from"
            v-model="fromStr"
            type="date"
            class="h-8"
          />
        </div>
        <div class="grid gap-2">
          <Label for="demo-date-to" class="text-xs">結束日</Label>
          <Input
            id="demo-date-to"
            v-model="toStr"
            type="date"
            class="h-8"
          />
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="h-8"
            @click="clear"
          >
            <X class="mr-1 size-3.5" />
            清除
          </Button>
          <Button
            type="button"
            size="sm"
            class="h-8"
            @click="apply"
          >
            套用
          </Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
