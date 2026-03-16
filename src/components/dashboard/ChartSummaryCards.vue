<script setup lang="ts">
import StateCard from '@/components/common/StateCard.vue'
import type { MonitoringChartSummary } from '@/types/dashboard'

defineProps<{
  summary: MonitoringChartSummary | null
}>()
</script>

<template>
  <div
    v-if="summary"
    class="grid grid-cols-2 gap-3 sm:grid-cols-4"
  >
    <StateCard title="當前數值">
      <p class="text-3xl font-bold tabular-nums text-foreground">
        {{ summary.current }} {{ summary.unit }}
      </p>
      <p class="mt-1 text-xs text-muted-foreground">即時</p>
    </StateCard>
    <StateCard title="平均值">
      <p class="text-3xl font-bold tabular-nums text-foreground">
        {{ summary.average }} {{ summary.unit }}
      </p>
      <p class="mt-1 text-xs text-muted-foreground">區間平均</p>
    </StateCard>
    <StateCard title="最高值">
      <p class="text-3xl font-bold tabular-nums text-foreground">
        {{ summary.max }} {{ summary.unit }}
      </p>
      <p class="mt-1 text-xs text-muted-foreground">區間最大</p>
    </StateCard>
    <StateCard title="最低值">
      <p class="text-3xl font-bold tabular-nums text-foreground">
        {{ summary.min }} {{ summary.unit }}
      </p>
      <p class="mt-1 text-xs text-muted-foreground">區間最小</p>
    </StateCard>
  </div>
</template>
