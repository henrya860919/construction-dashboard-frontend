<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AlertLevel } from '@/types/dashboard'

const props = withDefaults(
  defineProps<{
    /** 警報等級：警報(紅) / 注意(黃) / 正常(綠) */
    level: AlertLevel
    /** 標題，如「熱危害」「空污」「水位」 */
    title: string
    /** 主要數值顯示，如「高溫 32.5°C」「PM2.5: 45」 */
    value: string
    /** 顯示「已過 X 分鐘」，30 分鐘後卡片會從列表移除 */
    timeAgo?: string
    class?: string
  }>(),
  {}
)

const levelConfig = {
  alarm: {
    tag: '警報',
    subtitle: '風險警示',
    description: '建議加強防護措施',
    bgClass: 'bg-[var(--alert-alarm-bg)] border-[var(--alert-alarm-fg)]/20',
    titleClass: 'text-[var(--alert-alarm-fg)]',
    valueClass: 'text-[var(--alert-alarm-fg)]',
    badgeClass: 'bg-[var(--alert-alarm-fg)] text-white border-0',
  },
  attention: {
    tag: '注意',
    subtitle: '空氣品質指標',
    description: '敏感族群注意防護',
    bgClass: 'bg-[var(--alert-attention-bg)] border-[var(--alert-attention-fg)]/20',
    titleClass: 'text-[var(--alert-attention-fg)]',
    valueClass: 'text-[var(--alert-attention-fg)]',
    badgeClass: 'bg-[var(--alert-attention-fg)] text-white border-0',
  },
  normal: {
    tag: '正常',
    subtitle: '狀態正常',
    description: '持續監測中',
    bgClass: 'bg-[var(--alert-normal-bg)] border-[var(--alert-normal-fg)]/20',
    titleClass: 'text-[var(--alert-normal-fg)]',
    valueClass: 'text-[var(--alert-normal-fg)]',
    badgeClass: 'bg-[var(--alert-normal-fg)] text-white border-0',
  },
} as const

const config = computed(() => levelConfig[props.level])
</script>

<template>
  <div
    :class="
      cn(
        'rounded-xl border px-4 py-4 shadow-sm',
        config.bgClass,
        props.class,
      )
    "
  >
    <div class="flex items-center gap-2">
      <span :class="config.titleClass" class="shrink-0">
        <slot name="icon" />
      </span>
      <h3 :class="cn('text-sm font-semibold', config.titleClass)">
        {{ props.title }}
      </h3>
      <Badge :class="config.badgeClass" class="text-xs">
        {{ config.tag }}
      </Badge>
    </div>
    <p :class="cn('mt-3 text-xl font-bold tabular-nums', config.valueClass)">
      {{ props.value }}
    </p>
    <p class="mt-1 text-sm text-muted-foreground">
      {{ config.subtitle }}
    </p>
    <p class="mt-0.5 text-xs text-muted-foreground">
      {{ config.description }}
    </p>
    <p v-if="props.timeAgo" class="mt-1 text-xs text-muted-foreground">
      {{ props.timeAgo }}
    </p>
  </div>
</template>
