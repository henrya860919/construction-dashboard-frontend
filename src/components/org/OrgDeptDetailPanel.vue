<script setup lang="ts">
import { computed } from 'vue'
import type { OrgDeptTreeNode } from '@/api/organization'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    department: OrgDeptTreeNode
    parentName: string | null
    /** 是否顯示右上角關閉（並排於圖表時使用；Sheet 內建關閉則可關閉） */
    showClose?: boolean
    /** 較緊湊排版（並排窄欄） */
    compact?: boolean
  }>(),
  {
    showClose: true,
    compact: false,
  }
)

const emit = defineEmits<{
  close: []
}>()

const managers = computed(() => props.department.members.filter((m) => m.isManager))

const membersSorted = computed(() => {
  const list = props.department.members
  return [...list].sort((a, b) => {
    const an = a.name ?? a.userId
    const bn = b.name ?? b.userId
    return an.localeCompare(bn, 'zh-Hant')
  })
})

const pad = computed(() =>
  props.compact ? 'px-4 pb-4 pt-3' : 'px-4 pb-5 pt-4'
)
const headClass = computed(() => {
  const base = props.compact ? 'px-4 pt-4 pb-3' : 'px-4 pt-4 pb-4'
  const right = props.showClose ? ' pr-12' : ' pr-4'
  return base + right
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background text-sm">
    <div :class="['relative shrink-0 space-y-1.5 border-b border-border text-left', headClass]">
      <button
        v-if="showClose"
        type="button"
        class="absolute right-3 top-3 z-10 inline-flex size-8 items-center justify-center rounded-md p-0 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-offset-0 focus-visible:ring-offset-background"
        aria-label="關閉"
        @click="emit('close')"
      >
        <X class="size-4 shrink-0" aria-hidden="true" />
      </button>
      <div class="flex items-start gap-2">
        <span class="text-2xl leading-none" aria-hidden="true">{{ department.icon }}</span>
        <div class="min-w-0 flex-1 space-y-1">
          <h2 class="text-base font-semibold leading-tight text-foreground">
            {{ department.name }}
          </h2>
          <p class="text-xs text-muted-foreground">部門詳細與成員</p>
          <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
            <Badge v-if="department.status === 'archived'" variant="secondary" class="text-[10px]">
              已封存
            </Badge>
            <Badge v-else variant="outline" class="text-[10px]">啟用</Badge>
            <span v-if="parentName" class="text-[11px] text-muted-foreground">
              上層：{{ parentName }}
            </span>
            <span v-else class="text-[11px] text-muted-foreground">頂層</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <div class="rounded-md border border-border bg-card px-3 py-2.5">
          <p class="text-[10px] text-muted-foreground">指派人數</p>
          <p class="text-lg font-semibold tabular-nums text-foreground">
            {{ department.memberCount }}
          </p>
        </div>
        <div class="rounded-md border border-border bg-card px-3 py-2.5">
          <p class="text-[10px] text-muted-foreground">主管</p>
          <p class="text-lg font-semibold tabular-nums text-foreground">
            {{ managers.length }}
          </p>
        </div>
      </div>
    </div>

    <div :class="['min-h-0 flex-1 overflow-y-auto', pad]">
      <section class="space-y-1.5">
        <h3 class="text-xs font-semibold text-foreground">部門主管</h3>
        <ul
          v-if="managers.length"
          class="space-y-1.5 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs"
        >
          <li
            v-for="m in managers"
            :key="m.userId"
            class="border-b border-border/60 pb-1.5 last:border-0 last:pb-0"
          >
            <div class="font-medium text-foreground">{{ m.name ?? m.userId }}</div>
            <div class="text-[11px] text-muted-foreground">
              {{ m.positionName }}
              <span class="tabular-nums text-foreground">
                · Lv.{{ m.positionLevel != null ? m.positionLevel : '—' }}
              </span>
            </div>
          </li>
        </ul>
        <p v-else class="text-xs text-muted-foreground">無標示主管。</p>
      </section>

      <Separator class="my-3" />

      <section class="space-y-2">
        <h3 class="text-xs font-semibold text-foreground">成員與職位</h3>
        <p class="text-[10px] leading-snug text-muted-foreground">
          內部成員之進行中指派；職等為職位層級（外部成員不列入）。
        </p>
        <div v-if="membersSorted.length" class="overflow-hidden rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow class="border-border hover:bg-transparent">
                <TableHead class="h-9 px-3 text-[10px] text-foreground">姓名</TableHead>
                <TableHead class="h-9 px-3 text-[10px] text-foreground">職位</TableHead>
                <TableHead class="h-9 w-11 px-2 text-[10px] text-foreground">等</TableHead>
                <TableHead class="h-9 w-10 px-2 text-[10px] text-foreground">註</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="m in membersSorted" :key="m.userId" class="border-border">
                <TableCell class="max-w-[5.5rem] truncate px-3 py-2 text-xs font-medium">
                  {{ m.name ?? m.userId }}
                </TableCell>
                <TableCell
                  class="max-w-[4.5rem] truncate px-3 py-2 text-[11px] text-muted-foreground"
                >
                  {{ m.positionName }}
                </TableCell>
                <TableCell class="px-2 py-2 text-[11px] tabular-nums">
                  {{ m.positionLevel != null ? m.positionLevel : '—' }}
                </TableCell>
                <TableCell class="px-2 py-2">
                  <Badge v-if="m.isManager" variant="secondary" class="px-1 py-0 text-[9px]">
                    主
                  </Badge>
                  <span v-else class="text-muted-foreground">—</span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <p v-else class="text-xs text-muted-foreground">尚無指派。</p>
      </section>
    </div>
  </div>
</template>
