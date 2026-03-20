<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Download, Trash2 } from 'lucide-vue-next'
import type { FormTemplateItem } from '@/api/form-templates'

defineProps<{
  row: FormTemplateItem
  canDelete: (row: FormTemplateItem) => boolean
}>()

const emit = defineEmits<{
  download: [row: FormTemplateItem]
  delete: [row: FormTemplateItem]
}>()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="size-8" aria-label="更多">
        <MoreHorizontal class="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-[10rem]">
      <DropdownMenuItem class="gap-2 cursor-pointer" @click="emit('download', row)">
        <Download class="size-4" />
        下載
      </DropdownMenuItem>
      <template v-if="canDelete(row)">
        <DropdownMenuSeparator />
        <DropdownMenuItem
          class="gap-2 cursor-pointer text-destructive focus:text-destructive"
          @click="emit('delete', row)"
        >
          <Trash2 class="size-4" />
          刪除
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
