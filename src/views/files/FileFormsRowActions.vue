<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Download, Trash2 } from 'lucide-vue-next'
import type { FormTemplateItem } from '@/api/form-templates'

withDefaults(
  defineProps<{
    row: FormTemplateItem
    canDelete: (row: FormTemplateItem) => boolean
    canDownload?: boolean
  }>(),
  { canDownload: true }
)

const emit = defineEmits<{
  download: [row: FormTemplateItem]
  delete: [row: FormTemplateItem]
}>()

function onDownload(row: FormTemplateItem) {
  emit('download', row)
}

function onDelete(row: FormTemplateItem) {
  emit('delete', row)
}
</script>

<template>
  <span
    v-if="!canDownload && !canDelete(row)"
    class="text-xs text-muted-foreground"
  >—</span>
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
        v-if="canDelete(row)"
        class="gap-2 cursor-pointer text-destructive focus:text-destructive"
        @click="onDelete(row)"
      >
        <Trash2 class="size-4" />
        刪除
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
