<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

defineOptions({ name: '時間器' })

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

function tick() {
  now.value = new Date()
}

const dateText = computed(() => {
  const d = now.value
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
})

const timeText = computed(() => {
  const d = now.value
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
})

onMounted(() => {
  timer = setInterval(tick, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="flex flex-col items-end justify-end gap-1 text-right md:flex-row md:items-center md:gap-3">
    <span class="text-xl font-bold tabular-nums text-foreground md:text-2xl">
      {{ timeText }}
    </span>
    <span class="text-xs text-muted-foreground">
      {{ dateText }}
    </span>
  </div>
</template>
