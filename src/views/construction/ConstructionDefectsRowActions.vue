<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Pencil, Eye, Trash2 } from 'lucide-vue-next'
import type { DefectItem } from '@/types/defect-improvement'

withDefaults(
  defineProps<{
    row: DefectItem
    canEdit?: boolean
    canRemove?: boolean
  }>(),
  { canEdit: true, canRemove: true }
)

const emit = defineEmits<{
  view: [row: DefectItem]
  edit: [row: DefectItem]
  remove: [row: DefectItem]
}>()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="size-8 shrink-0" aria-label="更多">
        <MoreHorizontal class="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-[10rem]">
      <DropdownMenuItem class="gap-2 cursor-pointer" @click="emit('view', row)">
        <Eye class="size-4" />
        檢視
      </DropdownMenuItem>
      <template v-if="canEdit">
        <DropdownMenuSeparator />
        <DropdownMenuItem class="gap-2 cursor-pointer" @click="emit('edit', row)">
          <Pencil class="size-4" />
          編輯
        </DropdownMenuItem>
      </template>
      <template v-if="canRemove">
        <DropdownMenuSeparator />
        <DropdownMenuItem
          class="gap-2 cursor-pointer text-destructive focus:text-destructive"
          @click="emit('remove', row)"
        >
          <Trash2 class="size-4" />
          刪除
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
