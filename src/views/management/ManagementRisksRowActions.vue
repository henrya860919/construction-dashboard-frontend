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
import type { IssueRiskItem } from '@/types/issue-risk'

defineProps<{
  row: IssueRiskItem
  updatingId: string | null
}>()

const emit = defineEmits<{
  edit: [row: IssueRiskItem]
  remove: [row: IssueRiskItem]
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
      <DropdownMenuItem class="gap-2 cursor-pointer" @click="emit('edit', row)">
        <Pencil class="size-4" />
        編輯
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        class="gap-2 cursor-pointer text-destructive focus:text-destructive"
        @click="emit('remove', row)"
      >
        <Trash2 class="size-4" />
        刪除
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
