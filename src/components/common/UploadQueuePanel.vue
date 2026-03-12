<script setup lang="ts">
import { computed } from 'vue'
import { Upload, CheckCircle2, AlertCircle, FileIcon, X } from 'lucide-vue-next'
import { useUploadQueueStore } from '@/stores/uploadQueue'
import type { UploadQueueItem } from '@/types/upload'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const store = useUploadQueueStore()

const hasCompletedItems = computed(() =>
  store.items.some((i) => i.status === 'success' || i.status === 'error')
)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusIcon(item: UploadQueueItem) {
  switch (item.status) {
    case 'uploading':
      return Upload
    case 'success':
      return CheckCircle2
    case 'error':
      return AlertCircle
    default:
      return FileIcon
  }
}

function statusColor(item: UploadQueueItem): string {
  switch (item.status) {
    case 'uploading':
      return 'text-primary'
    case 'success':
      return 'text-green-600 dark:text-green-400'
    case 'error':
      return 'text-destructive'
    default:
      return 'text-muted-foreground'
  }
}
</script>

<template>
  <div class="flex flex-col min-w-[320px] max-w-[360px]">
    <div class="border-b border-border px-3 py-2.5">
      <h3 class="text-sm font-semibold text-foreground">
        檔案上傳
      </h3>
      <p class="mt-0.5 text-xs text-muted-foreground">
        上傳中的檔案與最近完成項目
      </p>
    </div>

    <ScrollArea class="max-h-[min(70vh,400px)]">
      <ul class="p-2 space-y-1">
        <template v-if="store.itemsByNewest.length">
          <li
            v-for="item in store.itemsByNewest"
            :key="item.id"
            class="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2.5 text-left transition-colors hover:bg-muted/50"
          >
            <div class="flex items-start gap-2">
              <component
                :is="statusIcon(item)"
                :class="cn('size-4 shrink-0 mt-0.5', statusColor(item))"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-foreground" :title="item.fileName">
                  {{ item.fileName }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ formatSize(item.fileSize) }}
                  <template v-if="item.source">
                    · {{ item.source === 'contract' ? '契約' : item.source === 'monitoring' ? '監測' : item.source }}
                  </template>
                  <template v-else-if="item.category">
                    · {{ item.category }}
                  </template>
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                class="size-7 shrink-0"
                aria-label="從清單移除"
                @click="store.remove(item.id)"
              >
                <X class="size-3.5" />
              </Button>
            </div>

            <!-- 上傳中：進度條 -->
            <div v-if="item.status === 'uploading'" class="mt-0.5">
              <Progress :model-value="item.progress" class="h-1.5" />
              <p class="mt-1 text-xs text-muted-foreground">
                {{ item.progress }}%
              </p>
            </div>

            <!-- 成功 -->
            <p
              v-else-if="item.status === 'success'"
              class="text-xs text-green-600 dark:text-green-400"
            >
              上傳完成
            </p>

            <!-- 失敗 -->
            <p
              v-else-if="item.status === 'error' && item.errorMessage"
              class="text-xs text-destructive"
            >
              {{ item.errorMessage }}
            </p>
          </li>
        </template>
        <li
          v-else
          class="rounded-md border border-dashed border-border bg-muted/20 py-8 text-center"
        >
          <FileIcon class="mx-auto size-10 text-muted-foreground/50" />
          <p class="mt-2 text-sm text-muted-foreground">
            尚無上傳項目
          </p>
          <p class="mt-0.5 text-xs text-muted-foreground/80">
            從契約管理或監測上傳等頁面選擇檔案後，會在此顯示進度
          </p>
        </li>
      </ul>
    </ScrollArea>

    <div
      v-if="hasCompletedItems"
      class="border-t border-border px-2 py-2"
    >
      <Button
        variant="ghost"
        size="sm"
        class="w-full text-muted-foreground"
        :disabled="store.hasActiveUploads"
        @click="store.clearCompleted()"
      >
        清除已完成
      </Button>
    </div>
  </div>
</template>
