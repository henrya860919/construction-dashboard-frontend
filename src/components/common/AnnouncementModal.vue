<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Megaphone } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAnnouncementStore } from '@/stores/announcements'
import { useAuthStore } from '@/stores/auth'

const store = useAnnouncementStore()
const authStore = useAuthStore()

const firstUnread = computed(() => store.unreadList[0] ?? null)
const modalOpen = computed({
  get: () => !!firstUnread.value,
  set: () => {},
})

onMounted(() => {
  if (authStore.isAuthenticated) store.fetch()
})

async function dismiss() {
  const item = firstUnread.value
  if (item) await store.markAsRead(item.id)
}

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <Dialog :open="modalOpen" @update:open="(v) => { if (!v) dismiss() }">
    <DialogContent class="max-h-[85vh] max-w-lg flex flex-col gap-0 sm:max-w-lg">
      <DialogHeader class="flex flex-row items-center gap-3 space-y-0 border-b border-border pb-4">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Megaphone class="size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <DialogTitle class="text-lg">{{ firstUnread?.title ?? '平台公告' }}</DialogTitle>
          <p v-if="firstUnread?.publishedAt" class="mt-0.5 text-xs text-muted-foreground">
            {{ formatDate(firstUnread.publishedAt) }} 發佈
          </p>
        </div>
      </DialogHeader>
      <ScrollArea v-if="firstUnread" class="max-h-[50vh] flex-1 px-1 py-4">
        <p class="whitespace-pre-wrap text-sm text-foreground">{{ firstUnread.body }}</p>
      </ScrollArea>
      <DialogFooter class="mt-4 border-t border-border pt-4">
        <Button class="w-full sm:w-auto" @click="dismiss">
          知道了
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
