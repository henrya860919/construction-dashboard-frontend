<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { usePhotoViewerStore } from '@/stores/photoViewer'

const router = useRouter()
const store = usePhotoViewerStore()

const urls = computed(() => store.photoUrls)
const currentIndex = computed(() => store.photoIndex)
const currentUrl = computed(() => urls.value[currentIndex.value] ?? '')
const hasMultiple = computed(() => urls.value.length > 1)
const canGoPrev = computed(() => currentIndex.value > 0)
const canGoNext = computed(() => currentIndex.value < urls.value.length - 1)

function prev() {
  if (canGoPrev.value) store.setIndex(currentIndex.value - 1)
}

function next() {
  if (canGoNext.value) store.setIndex(currentIndex.value + 1)
}

function goBack() {
  store.clear()
  router.back()
}

/** 觸控滑動：簡單水平滑動切換 */
let touchStartX = 0
function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX
}
function onTouchEnd(e: TouchEvent) {
  const delta = e.changedTouches[0].clientX - touchStartX
  const threshold = 50
  if (delta > threshold) prev()
  else if (delta < -threshold) next()
}

onBeforeUnmount(() => {
  store.clear()
})
</script>

<template>
  <div class="photo-viewer flex h-full min-h-0 flex-col bg-black">
    <template v-if="!urls.length">
      <div class="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-white">
        <p class="text-center text-sm opacity-80">尚無照片可檢視</p>
        <button
          type="button"
          class="rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm"
          @click="goBack"
        >
          返回
        </button>
      </div>
    </template>

    <template v-else>
      <div
        class="relative flex flex-1 min-h-0 items-center justify-center overflow-hidden"
        @touchstart="onTouchStart"
        @touchend="onTouchEnd"
      >
        <img
          :key="currentUrl"
          :src="currentUrl"
          :alt="`照片 ${currentIndex + 1}`"
          class="max-h-full max-w-full object-contain"
          loading="eager"
        />

        <!-- 上一張 -->
        <button
          v-if="hasMultiple && canGoPrev"
          type="button"
          class="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white touch-manipulation"
          aria-label="上一張"
          @click="prev"
        >
          <ChevronLeft class="size-6" />
        </button>
        <!-- 下一張 -->
        <button
          v-if="hasMultiple && canGoNext"
          type="button"
          class="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white touch-manipulation"
          aria-label="下一張"
          @click="next"
        >
          <ChevronRight class="size-6" />
        </button>
      </div>

      <!-- 計數 -->
      <div
        v-if="hasMultiple"
        class="shrink-0 py-2 text-center text-sm text-white/80"
      >
        {{ currentIndex + 1 }} / {{ urls.length }}
      </div>
    </template>
  </div>
</template>

<style scoped>
.photo-viewer {
  min-height: 100%;
}
</style>
