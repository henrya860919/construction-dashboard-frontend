<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
  /**
   * true（預設）：表格外層負責**水平**捲動（overflow-x-auto），垂直交給頁面主區，避免整頁橫向捲動。
   * false：不外層捲動，由父容器統一捲（如甘特圖左欄須與右側圖表同步垂直捲動）。
   */
  scrollContainer?: boolean
}>()
</script>

<template>
  <div
    data-slot="table-container"
    :class="[
      'relative min-w-0 max-w-full w-full pb-4',
      props.scrollContainer === false
        ? 'overflow-visible'
        : 'overflow-x-auto overflow-y-visible overscroll-x-contain',
    ]"
  >
    <table data-slot="table" :class="cn('w-full caption-bottom text-sm', props.class)">
      <slot />
    </table>
  </div>
</template>
