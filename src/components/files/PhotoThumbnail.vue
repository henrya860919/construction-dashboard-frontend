<script setup lang="ts">
import { toRef } from 'vue'
import { useAuthImageUrl } from '@/composables/useAuthImageUrl'
import { ImageIcon, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  fileId: string
}>()

const fileIdRef = toRef(props, 'fileId')
const { objectUrl, loading, error } = useAuthImageUrl(fileIdRef)
</script>

<template>
  <div
    class="relative size-full overflow-hidden rounded-lg bg-muted transition-transform hover:scale-[1.02]"
  >
    <img
      v-if="objectUrl && !error"
      :src="objectUrl"
      alt=""
      class="size-full object-cover"
      loading="lazy"
    />
    <div
      v-else-if="loading"
      class="flex size-full items-center justify-center text-muted-foreground"
    >
      <Loader2 class="size-8 animate-spin" />
    </div>
    <div
      v-else
      class="flex size-full items-center justify-center text-muted-foreground"
    >
      <ImageIcon class="size-10 opacity-50" />
    </div>
  </div>
</template>
