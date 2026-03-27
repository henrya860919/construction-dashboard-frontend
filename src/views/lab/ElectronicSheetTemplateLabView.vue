<script setup lang="ts">
/**
 * 獨立測試頁（與後台「電子表單樣板」／admin form-templates 無關）
 * 路由：/lab/electronic-sheet-template
 */
</script>

<template>
  <div class="space-y-4 p-1">
    <div class="flex flex-col gap-1">
      <h1 class="text-xl font-semibold tracking-tight text-foreground">電子俵單樣板</h1>
      <p class="text-sm text-muted-foreground">
        此頁僅供本機或暫時實驗 UI／元件；可直接在此修改內容做測試。
      </p>
    </div>
    <div class="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
      在這裡貼上或撰寫你要測試的內容。
    </div>
  </div>
</template>
