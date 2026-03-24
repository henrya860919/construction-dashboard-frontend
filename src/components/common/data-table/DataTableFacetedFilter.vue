<script setup lang="ts" generic="TData">
import type { Column } from '@tanstack/vue-table'
import type { Component } from 'vue'
import { computed } from 'vue'
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

export interface FacetedOption {
  label: string
  value: string
  icon?: Component
}

const props = defineProps<{
  column?: Column<TData, unknown>
  title: string
  options: FacetedOption[]
}>()

const open = defineModel<boolean>('open', { default: false })

const selectedValues = computed(() => new Set((props.column?.getFilterValue() as string[] | undefined) ?? []))

const facets = computed(() => props.column?.getFacetedUniqueValues() ?? new Map<string, number>())

function toggle(value: string) {
  const col = props.column
  if (!col) return
  const next = new Set(selectedValues.value)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  const arr = [...next]
  col.setFilterValue(arr.length ? arr : undefined)
}

function clear() {
  props.column?.setFilterValue(undefined)
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
        <PlusCircle class="size-4 shrink-0" />
        {{ title }}
        <template v-if="selectedValues.size > 0">
          <Separator
            orientation="vertical"
            class="mx-2 h-4"
          />
          <div class="hidden gap-1 lg:flex">
            <Badge
              v-if="selectedValues.size > 2"
              variant="secondary"
              class="rounded-sm px-1 font-normal"
            >
              已選 {{ selectedValues.size }} 項
            </Badge>
            <template v-else>
              <Badge
                v-for="val in selectedValues"
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
    <PopoverContent class="w-[220px] p-0" align="start">
      <Command>
        <CommandInput :placeholder="title" />
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
                    'border-primary flex size-4 items-center justify-center rounded-sm border',
                    selectedValues.has(opt.value)
                      ? 'bg-primary text-primary-foreground'
                      : 'opacity-50 [&_svg]:invisible',
                  )
                "
              >
                <Check class="size-3 text-primary-foreground" />
              </div>
              <component
                :is="opt.icon"
                v-if="opt.icon"
                class="text-muted-foreground size-4"
              />
              <span>{{ opt.label }}</span>
              <span
                v-if="facets.has(opt.value)"
                class="text-muted-foreground ml-auto flex size-4 items-center justify-center font-mono text-xs"
              >
                {{ facets.get(opt.value) }}
              </span>
            </CommandItem>
          </CommandGroup>
          <template v-if="selectedValues.size > 0">
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__clear"
                class="justify-center text-center"
                @select="
                  () => {
                    clear()
                    open = false
                  }
                "
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
