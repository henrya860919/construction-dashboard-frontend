<script setup lang="ts">
import { computed } from 'vue'
import type { GanttTask } from '@/types/gantt'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Link2, X } from 'lucide-vue-next'

const props = defineProps<{
  task: GanttTask
  /** 下拉可選的任務（通常為全部葉節點） */
  allTasks: GanttTask[]
  /**
   * 用 id 解析前置顯示文字（編號）；若未傳則用 allTasks。
   * WBS 清單收合父層時可見列變少，需傳「整棵樹全部節點」才不會變成顯示資料 id。
   */
  lookupTasks?: GanttTask[]
}>()

const emit = defineEmits<{
  'update:dependencies': [predecessorIds: string[]]
}>()

const tasksForLabelLookup = computed(() => props.lookupTasks ?? props.allTasks)

function labelForId(id: string): string {
  const t = tasksForLabelLookup.value.find((x) => x.id === id)
  return t ? (t.wbsCode ?? t.name) : id
}

const currentDeps = computed(() => props.task.dependencies ?? [])

const predecessorLabels = computed(() =>
  currentDeps.value.map((id) => labelForId(id))
)

const displayText = computed(() => predecessorLabels.value.join(', ') || '—')

const candidateTasks = computed(() =>
  props.allTasks.filter((t) => t.id !== props.task.id)
)

const selectedSet = computed(() => new Set(currentDeps.value))

function removePredecessor(id: string) {
  const next = currentDeps.value.filter((x) => x !== id)
  emit('update:dependencies', next)
}

function setPredecessorChecked(id: string, checked: boolean) {
  const next = new Set(currentDeps.value)
  if (checked) next.add(id)
  else next.delete(id)
  emit('update:dependencies', Array.from(next))
}

function clearAllPredecessors() {
  emit('update:dependencies', [])
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        class="h-7 min-w-0 max-w-full justify-start gap-1 px-1.5 text-muted-foreground hover:text-foreground"
      >
        <Link2 class="size-3.5 shrink-0" />
        <span class="truncate text-xs">{{ displayText }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-64" align="start" @click.stop>
      <template v-if="currentDeps.length">
        <DropdownMenuLabel class="text-muted-foreground text-xs">
          目前已設前置
        </DropdownMenuLabel>
        <div class="max-h-32 overflow-y-auto px-1">
          <div
            v-for="id in currentDeps"
            :key="id"
            class="flex items-center gap-0.5 rounded-sm py-0.5 pr-0.5 hover:bg-muted/60"
          >
            <span class="min-w-0 flex-1 truncate px-2 text-sm">{{ labelForId(id) }}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-7 shrink-0 text-muted-foreground hover:text-destructive"
              title="移除此前置"
              @click.stop="removePredecessor(id)"
            >
              <X class="size-3.5" />
            </Button>
          </div>
        </div>
        <div class="px-2 pb-1">
          <Button
            type="button"
            variant="outline"
            class="h-7 w-full text-xs"
            @click.stop="clearAllPredecessors"
          >
            清除全部前置
          </Button>
        </div>
        <DropdownMenuSeparator />
      </template>
      <DropdownMenuLabel class="text-muted-foreground text-xs">
        從葉節點勾選／取消
      </DropdownMenuLabel>
      <div class="max-h-48 overflow-y-auto">
        <DropdownMenuCheckboxItem
          v-for="t in candidateTasks"
          :key="t.id"
          :checked="selectedSet.has(t.id)"
          @select.prevent
          @update:checked="(v: boolean | 'indeterminate') => setPredecessorChecked(t.id, v === true)"
        >
          <span class="truncate">{{ t.wbsCode ?? t.name }}</span>
        </DropdownMenuCheckboxItem>
      </div>
      <p v-if="!candidateTasks.length" class="text-muted-foreground px-2 py-2 text-xs">
        無其他葉節點可選
      </p>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
