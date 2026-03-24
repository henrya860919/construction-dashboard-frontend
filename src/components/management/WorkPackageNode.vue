<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { WbsNode } from '@/types/wbs'

export interface WorkPackageData {
  node: WbsNode
  isCritical?: boolean
  slack?: number
}

defineProps<{
  data: WorkPackageData
}>()
</script>

<template>
  <div
    class="min-w-[180px] rounded-lg border-2 px-3 py-2 shadow-md transition-shadow hover:shadow-lg"
    :class="
      data.isCritical
        ? 'border-destructive bg-destructive/10 ring-1 ring-destructive/30'
        : 'border-border bg-card'
   "
  >
    <Handle type="target" :position="Position.Left" class="!-left-1 !top-1/2 !h-2 !w-2 !border-2 !border-primary !bg-background" />
    <div class="space-y-1 text-xs">
      <div class="flex items-center justify-between gap-2 border-b border-border pb-1">
        <span class="font-mono font-semibold tabular-nums text-foreground">{{ data.node.code }}</span>
        <span
          v-if="data.isCritical"
          class="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] font-medium text-destructive"
        >
          要徑
        </span>
      </div>
      <div class="font-medium leading-tight text-foreground line-clamp-2" :title="data.node.name">
        {{ data.node.name }}
      </div>
      <div class="text-muted-foreground grid grid-cols-2 gap-x-2 gap-y-0.5">
        <span>工期</span>
        <span class="tabular-nums">{{ data.node.durationDays ?? '—' }} 天</span>
        <span>開始</span>
        <span class="truncate tabular-nums">{{ data.node.startDate ?? '—' }}</span>
        <span>結束</span>
        <span class="truncate tabular-nums">{{ data.node.endDate ?? '—' }}</span>
        <span v-if="data.slack != null">浮時</span>
        <span v-if="data.slack != null" class="tabular-nums">{{ data.slack }} 天</span>
        <span v-if="data.node.resources?.length">負責</span>
        <span v-if="data.node.resources?.length" class="truncate">
          {{ data.node.resources?.map((r) => r.name).join('、') ?? '—' }}
        </span>
      </div>
    </div>
    <Handle type="source" :position="Position.Right" class="!-right-1 !top-1/2 !h-2 !w-2 !border-2 !border-primary !bg-background" />
  </div>
</template>
