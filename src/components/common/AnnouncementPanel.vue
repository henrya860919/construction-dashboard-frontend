<script setup lang="ts">
import { onMounted } from 'vue'
import { Megaphone, CheckCircle2, CircleDot } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAnnouncementStore } from '@/stores/announcements'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const store = useAnnouncementStore()

onMounted(() => {
  store.fetch()
})

async function markAsRead(id: string) {
  await store.markAsRead(id)
}

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-TW', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="flex max-h-[380px] min-w-[320px] flex-col overflow-hidden rounded-lg">
    <!-- Header -->
    <div class="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
      <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Megaphone class="size-4" />
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="text-sm font-semibold text-foreground">平台公告</h3>
        <p class="text-xs text-muted-foreground">系統與維護通知</p>
      </div>
      <Badge v-if="store.unreadCount > 0" variant="secondary" class="shrink-0 text-xs">
        {{ store.unreadCount }} 則未讀
      </Badge>
    </div>

    <!-- List -->
    <ScrollArea class="flex-1">
      <div class="p-3">
        <div v-if="store.loading" class="flex flex-col items-center justify-center gap-3 py-12">
          <div class="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p class="text-sm text-muted-foreground">載入中…</p>
        </div>
        <div
          v-else-if="!store.list.length"
          class="flex flex-col items-center justify-center gap-3 py-12 text-center"
        >
          <div class="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Megaphone class="size-7" />
          </div>
          <div>
            <p class="text-sm font-medium text-foreground">目前沒有公告</p>
            <p class="mt-1 text-xs text-muted-foreground">有新公告時會在此顯示</p>
          </div>
        </div>
        <ul v-else class="space-y-2">
          <li
            v-for="item in store.list"
            :key="item.id"
            :class="
              cn(
                'rounded-lg border p-3 transition-colors',
                item.readAt
                  ? 'border-border bg-card hover:bg-muted/30'
                  : 'border-primary/30 bg-primary/5 hover:bg-primary/10'
              )
            "
          >
            <div class="flex items-start gap-3">
              <div
                :class="
                  cn(
                    'mt-0.5 shrink-0 rounded-full',
                    item.readAt ? 'text-muted-foreground' : 'text-primary'
                  )
                "
              >
                <CheckCircle2 v-if="item.readAt" class="size-4" />
                <CircleDot v-else class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="font-medium text-foreground">{{ item.title }}</p>
                  <Badge v-if="!item.readAt" variant="default" class="shrink-0 text-[10px] px-1.5 py-0">
                    新
                  </Badge>
                </div>
                <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{{ item.body }}</p>
                <p v-if="item.publishedAt" class="mt-2 text-[11px] text-muted-foreground">
                  {{ formatDate(item.publishedAt) }}
                </p>
                <Button
                  v-if="!item.readAt"
                  variant="secondary"
                  size="sm"
                  class="mt-3 h-8 text-xs"
                  @click="markAsRead(item.id)"
                >
                  標記已讀
                </Button>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </ScrollArea>
  </div>
</template>
