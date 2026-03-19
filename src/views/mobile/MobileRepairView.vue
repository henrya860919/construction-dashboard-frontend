<script setup lang="ts">
import { useRoute } from 'vue-router'
import { Wrench } from 'lucide-vue-next'

defineOptions({ name: 'MobileRepairView' })

useRoute()

// 手機版獨立：報修列表（之後接 API）
</script>

<template>
  <div class="mobile-page px-4 pb-6 pt-4">
    <h2 class="mb-4 text-lg font-semibold text-foreground">報修</h2>

    <div
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center"
    >
      <Wrench class="mb-3 size-12 text-muted-foreground" aria-hidden />
      <p class="text-sm font-medium text-foreground">報修紀錄</p>
      <p class="mt-1 text-sm text-muted-foreground">新增報修單與查看處理進度</p>
    </div>
  </div>
</template>
