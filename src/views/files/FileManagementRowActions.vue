<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Download, Trash2 } from 'lucide-vue-next'
import type { AttachmentItem } from '@/api/files'

withDefaults(
  defineProps<{
    row: AttachmentItem
    canDownload?: boolean
    canDelete?: boolean
  }>(),
  { canDownload: true, canDelete: true }
)

const emit = defineEmits<{
  download: [row: AttachmentItem]
  delete: [row: AttachmentItem]
}>()

function onDownload(row: AttachmentItem) {
  emit('download', row)
}

function onDelete(row: AttachmentItem) {
  emit('delete', row)
}
</script>

<template>
  <span v-if="!canDownload && !canDelete" class="text-xs text-muted-foreground">—</span>
  <DropdownMenu v-else>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="size-8" aria-label="更多">
        <MoreHorizontal class="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-[10rem]">
      <DropdownMenuItem
        v-if="canDownload"
        class="gap-2 cursor-pointer"
        @click="onDownload(row)"
      >
        <Download class="size-4" />
        下載
      </DropdownMenuItem>
      <DropdownMenuItem
        v-if="canDelete"
        class="gap-2 cursor-pointer text-destructive focus:text-destructive"
        @click="onDelete(row)"
      >
        <Trash2 class="size-4" />
        刪除
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
