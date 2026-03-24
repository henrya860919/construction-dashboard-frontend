<script setup lang="ts" generic="TData">
import type { ColumnSort, Table } from '@tanstack/vue-table'
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical, Plus, Trash2 } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const props = defineProps<{
  table: Table<TData>
  /** 可排序欄位 id → 顯示名稱 */
  columnLabels: Record<string, string>
}>()

const open = ref(false)

const sortableIds = computed(() =>
  props.table
    .getAllColumns()
    .filter((c) => c.getCanSort() && c.id && c.id !== 'select')
    .map((c) => c.id as string),
)

const sorting = computed(() => props.table.getState().sorting as ColumnSort[])

const sortCount = computed(() => sorting.value.length)

function setSorting(next: ColumnSort[]) {
  props.table.setSorting(next)
}

function addRule() {
  const used = new Set(sorting.value.map((s) => s.id))
  const nextId = sortableIds.value.find((id) => !used.has(id)) ?? sortableIds.value[0]
  if (!nextId) return
  setSorting([...sorting.value, { id: nextId, desc: false }])
}

function removeRule(index: number) {
  const next = sorting.value.filter((_, i) => i !== index)
  setSorting(next)
}

function setRuleColumn(index: number, columnId: string) {
  const next = sorting.value.map((s, i) => (i === index ? { ...s, id: columnId } : s))
  setSorting(next)
}

function setRuleDesc(index: number, desc: boolean) {
  const next = sorting.value.map((s, i) => (i === index ? { ...s, desc } : s))
  setSorting(next)
}

function moveRule(index: number, dir: -1 | 1) {
  const j = index + dir
  if (j < 0 || j >= sorting.value.length) return
  const next = [...sorting.value]
  ;[next[index], next[j]] = [next[j], next[index]]
  setSorting(next)
}

function resetSorting() {
  props.table.setSorting([])
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="h-8"
      >
        <ArrowUpDown class="size-4" />
        排序
        <Badge
          v-if="sortCount > 0"
          variant="secondary"
          class="rounded-sm px-1 font-mono text-[10px]"
        >
          {{ sortCount }}
        </Badge>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[min(100vw-2rem,380px)] p-4" align="end">
      <p class="text-sm font-medium text-foreground">
        排序規則
      </p>
      <p class="text-muted-foreground mt-1 text-xs">
        上方規則優先；可新增多欄排序。
      </p>
      <div class="mt-3 max-h-[280px] space-y-2 overflow-y-auto pr-1">
        <div
          v-for="(rule, index) in sorting"
          :key="`${rule.id}-${index}`"
          class="flex flex-wrap items-center gap-2"
        >
          <div
            class="text-muted-foreground flex size-8 shrink-0 items-center justify-center"
            title="順序（用上／下調整）"
          >
            <GripVertical class="size-4" />
          </div>
          <Select
            :model-value="rule.id"
            @update:model-value="(v) => v && setRuleColumn(index, String(v))"
          >
            <SelectTrigger class="h-8 min-w-[140px] flex-1">
              <SelectValue :placeholder="'選擇欄位'" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="id in sortableIds"
                :key="id"
                :value="id"
              >
                {{ columnLabels[id] ?? id }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select
            :model-value="rule.desc ? 'desc' : 'asc'"
            @update:model-value="(v) => setRuleDesc(index, v === 'desc')"
          >
            <SelectTrigger class="h-8 w-[100px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">
                升序
              </SelectItem>
              <SelectItem value="desc">
                降序
              </SelectItem>
            </SelectContent>
          </Select>
          <div class="flex shrink-0 gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-8"
              :disabled="index === 0"
              @click="moveRule(index, -1)"
            >
              <ArrowUp class="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-8"
              :disabled="index === sorting.length - 1"
              @click="moveRule(index, 1)"
            >
              <ArrowDown class="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-8 text-destructive hover:text-destructive"
              @click="removeRule(index)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>
        <p
          v-if="sorting.length === 0"
          class="text-muted-foreground py-4 text-center text-sm"
        >
          尚未設定排序，請按「新增排序」。
        </p>
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          class="h-8"
          @click="addRule"
        >
          <Plus class="size-4" />
          新增排序
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="h-8"
          :disabled="sorting.length === 0"
          @click="resetSorting"
        >
          重設排序
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
