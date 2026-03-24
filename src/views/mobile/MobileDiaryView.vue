<script setup lang="ts">
import { useRoute } from 'vue-router'
import { BookOpen } from 'lucide-vue-next'

defineOptions({ name: 'MobileDiaryView' })

useRoute()

// 手機版獨立：施工日誌（之後接 API）
</script>

<template>
  <div class="mobile-page px-4 pb-6 pt-4">
    <h2 class="mb-4 text-lg font-semibold text-foreground">施工日誌</h2>

    <div
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center"
    >
      <BookOpen class="mb-3 size-12 text-muted-foreground" aria-hidden />
      <p class="text-sm font-medium text-foreground">今日日誌</p>
      <p class="mt-1 text-sm text-muted-foreground">此功能將提供快速填寫今日施工內容</p>
    </div>
  </div>
</template>
