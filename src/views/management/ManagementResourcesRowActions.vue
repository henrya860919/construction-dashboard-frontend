<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-vue-next'
import type { ProjectResourceItem } from '@/types/resource'

withDefaults(
  defineProps<{
    row: ProjectResourceItem
    canEdit?: boolean
    canRemove?: boolean
  }>(),
  { canEdit: true, canRemove: true }
)

const emit = defineEmits<{
  edit: [row: ProjectResourceItem]
  remove: [row: ProjectResourceItem]
}>()
</script>

<template>
  <DropdownMenu v-if="canEdit || canRemove">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="size-8 shrink-0" aria-label="更多">
        <MoreHorizontal class="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-[10rem]">
      <DropdownMenuItem v-if="canEdit" class="gap-2 cursor-pointer" @click="emit('edit', row)">
        <Pencil class="size-4" />
        編輯
      </DropdownMenuItem>
      <DropdownMenuSeparator v-if="canRemove && canEdit" />
      <DropdownMenuItem
        v-if="canRemove"
        class="gap-2 cursor-pointer text-destructive focus:text-destructive"
        @click="emit('remove', row)"
      >
        <Trash2 class="size-4" />
        刪除
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  <span v-else class="text-xs text-muted-foreground">—</span>
</template>
