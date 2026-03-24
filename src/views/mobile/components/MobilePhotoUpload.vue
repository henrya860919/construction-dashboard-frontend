<script setup lang="ts">
import { ref } from 'vue'
import { Camera } from 'lucide-vue-next'

const emit = defineEmits<{
  change: [files: FileList | null]
}>()

const inputRef = ref<HTMLInputElement | null>(null)

function trigger() {
  inputRef.value?.click()
}

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  emit('change', target.files ?? null)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <input
      ref="inputRef"
      type="file"
      accept="image/*"
      capture="environment"
      class="sr-only"
      aria-label="拍照或選擇圖片"
      @input="onInput"
    />
    <button
      type="button"
      class="flex min-h-[3rem] min-w-[3rem] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors active:bg-muted/50 touch-manipulation"
      @click="trigger"
    >
      <Camera class="size-6" aria-hidden />
      <span class="text-xs">拍照／選圖</span>
    </button>
  </div>
</template>
