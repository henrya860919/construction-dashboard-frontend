<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Share2, X } from 'lucide-vue-next'

const showPrompt = ref(false)

onMounted(() => {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  showPrompt.value = isIOS && !isStandalone
})

function dismiss() {
  showPrompt.value = false
}
</script>

<template>
  <div
    v-if="showPrompt"
    class="mb-4 flex items-start gap-3 rounded-xl border border-border bg-muted/50 p-4 text-foreground"
  >
    <Share2 class="size-5 shrink-0 text-muted-foreground" aria-hidden />
    <div class="min-w-0 flex-1 text-sm">
      <p class="font-medium text-foreground">安裝 App</p>
      <p class="mt-0.5 text-muted-foreground">
        點擊瀏覽器底部分享按鈕，選擇「加入主畫面」即可安裝。
      </p>
    </div>
    <button
      type="button"
      class="flex min-h-[2.25rem] min-w-[2.25rem] shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted active:bg-muted"
      aria-label="關閉"
      @click="dismiss"
    >
      <X class="size-5" aria-hidden />
    </button>
  </div>
</template>
