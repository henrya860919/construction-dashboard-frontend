<script setup lang="ts">
import type { Component } from 'vue'
import { computed, ref } from 'vue'
import { Check, PlusCircle } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
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

export type ServerFacetedOption = {
  label: string
  value: string
  /** 右側筆數（與 DataTableFilterPill／Faceted 一致，完整母體統計時傳入） */
  count?: number
  icon?: Component
}

const props = withDefaults(
  defineProps<{
    title: string
    options: ServerFacetedOption[]
    disabled?: boolean
    searchPlaceholder?: string
  }>(),
  { disabled: false, searchPlaceholder: undefined }
)

const modelValue = defineModel<string[]>({ default: () => [] })

const open = ref(false)

const inputPlaceholder = computed(() => props.searchPlaceholder ?? props.title)

const selectedSet = computed(() => new Set(modelValue.value))

/** 觸發鈕上 Badge 順序與 options 一致 */
const selectedBadgeValues = computed(() =>
  props.options.map((o) => o.value).filter((v) => selectedSet.value.has(v))
)

function showCount(opt: ServerFacetedOption): boolean {
  return typeof opt.count === 'number' && !Number.isNaN(opt.count)
}

function toggle(value: string) {
  const next = new Set(selectedSet.value)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  modelValue.value = [...next]
}

function clear() {
  modelValue.value = []
  open.value = false
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
        <template v-if="selectedBadgeValues.length > 0">
          <Separator orientation="vertical" class="mx-1 h-4" />
          <div class="hidden gap-1 lg:flex">
            <Badge
              v-if="selectedBadgeValues.length > 2"
              variant="secondary"
              class="rounded-sm px-1 font-normal"
            >
              已選 {{ selectedBadgeValues.length }} 項
            </Badge>
            <template v-else>
              <Badge
                v-for="val in selectedBadgeValues"
                :key="val"
                variant="secondary"
                class="rounded-sm px-1 font-normal"
              >
                {{ options.find((o) => o.value === val)?.label ?? val }}
              </Badge>
            </template>
          </div>
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
              @select="
                () => {
                  toggle(opt.value)
                }
              "
            >
              <div
                :class="
                  cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary',
                    selectedSet.has(opt.value)
                      ? 'bg-primary text-primary-foreground'
                      : 'opacity-50 [&_svg]:invisible'
                  )
                "
              >
                <Check class="size-3 text-primary-foreground" />
              </div>
              <component
                :is="opt.icon"
                v-if="opt.icon"
                class="size-4 shrink-0 text-muted-foreground"
              />
              <span class="min-w-0 flex-1 truncate">{{ opt.label }}</span>
              <span
                v-if="showCount(opt)"
                class="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground"
              >
                {{ opt.count }}
              </span>
            </CommandItem>
          </CommandGroup>
          <template v-if="selectedSet.size > 0">
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__clear_server_facet__"
                class="justify-center text-center"
                @select="() => clear()"
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
