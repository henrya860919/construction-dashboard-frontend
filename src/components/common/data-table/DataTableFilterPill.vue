<script setup lang="ts">
import { computed, ref } from 'vue'
import { PlusCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

/** 單選篩選選項；`count` 為可選右側筆數（僅在資料可代表完整母體時傳入）。 */
export type DataTableFilterPillOption = {
  label: string
  value: string
  count?: number
}

const props = withDefaults(
  defineProps<{
    title: string
    modelValue: string
    options: DataTableFilterPillOption[]
    /** 未篩選時的 modelValue；觸發鈕僅顯示標題不顯示選中摘要 */
    allValue?: string
    disabled?: boolean
    /** 下拉內搜尋框 placeholder，預設與 `title` 相同 */
    searchPlaceholder?: string
  }>(),
  { allValue: '__all__', disabled: false, searchPlaceholder: undefined },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const open = ref(false)

const inputPlaceholder = computed(() => props.searchPlaceholder ?? props.title)

const displayLabel = computed(() => {
  if (props.modelValue === props.allValue) return null
  return props.options.find((o) => o.value === props.modelValue)?.label ?? props.modelValue
})

function select(value: string) {
  emit('update:modelValue', value)
  open.value = false
}

function clearToAll() {
  emit('update:modelValue', props.allValue)
  open.value = false
}

function showCount(opt: DataTableFilterPillOption): boolean {
  return typeof opt.count === 'number' && !Number.isNaN(opt.count)
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="h-8 shrink-0 gap-1.5 border-dashed bg-background"
        :disabled="disabled"
      >
        <PlusCircle class="size-4 shrink-0" />
        {{ title }}
        <template v-if="displayLabel">
          <Separator orientation="vertical" class="mx-1 h-4" />
          <span class="text-muted-foreground max-w-[140px] truncate font-normal">{{
            displayLabel
          }}</span>
        </template>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[260px] p-0" align="start">
      <Command>
        <CommandInput :placeholder="inputPlaceholder" />
        <CommandSeparator />
        <CommandList>
          <CommandEmpty>找不到選項</CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-for="opt in options"
              :key="opt.value"
              :value="opt.value"
              @select="() => select(opt.value)"
            >
              <div
                class="flex size-4 shrink-0 items-center justify-center rounded-full border"
                :class="
                  cn(
                    modelValue === opt.value
                      ? 'border-primary'
                      : 'border-muted-foreground/40',
                  )
                "
                aria-hidden="true"
              >
                <div
                  v-if="modelValue === opt.value"
                  class="size-2 shrink-0 rounded-full bg-primary"
                />
              </div>
              <span class="min-w-0 flex-1 truncate">{{ opt.label }}</span>
              <span
                v-if="showCount(opt)"
                class="text-muted-foreground ml-auto shrink-0 font-mono text-xs tabular-nums"
              >
                {{ opt.count }}
              </span>
            </CommandItem>
          </CommandGroup>
          <template v-if="modelValue !== allValue">
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__clear_pill__"
                class="justify-center text-center"
                @select="() => clearToAll()"
              >
                清除此篩選
              </CommandItem>
            </CommandGroup>
          </template>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
