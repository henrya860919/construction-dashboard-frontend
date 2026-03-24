<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    status: 'pending' | 'in_progress' | 'done'
  }>(),
  {}
)

const label = computed(() => {
  switch (props.status) {
    case 'pending':
      return '待改善'
    case 'in_progress':
      return '改善中'
    case 'done':
      return '完成'
    default:
      return props.status
  }
})

const variantClass = computed(() => {
  switch (props.status) {
    case 'pending':
      return 'bg-destructive/15 text-destructive border-border'
    case 'in_progress':
      return 'bg-accent text-accent-foreground border-border'
    case 'done':
      return 'bg-primary/15 text-primary border-border'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
})
</script>

<template>
  <span
    class="inline-flex min-h-[1.75rem] items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
    :class="variantClass"
  >
    {{ label }}
  </span>
</template>
