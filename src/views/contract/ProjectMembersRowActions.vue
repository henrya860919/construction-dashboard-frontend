<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Trash2, PauseCircle, PlayCircle, Loader2 } from 'lucide-vue-next'
import type { ProjectMemberItem } from '@/types'

defineProps<{
  row: ProjectMemberItem
  togglingStatusId: string | null
}>()

const emit = defineEmits<{
  toggleStatus: [row: ProjectMemberItem]
  remove: [row: ProjectMemberItem]
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
      <DropdownMenuItem
        v-if="row.status === 'active'"
        class="gap-2 cursor-pointer"
        :disabled="togglingStatusId === row.id"
        @click="emit('toggleStatus', row)"
      >
        <Loader2 v-if="togglingStatusId === row.id" class="size-4 animate-spin" />
        <PauseCircle v-else class="size-4" />
        停用
      </DropdownMenuItem>
      <DropdownMenuItem
        v-else
        class="gap-2 cursor-pointer"
        :disabled="togglingStatusId === row.id"
        @click="emit('toggleStatus', row)"
      >
        <Loader2 v-if="togglingStatusId === row.id" class="size-4 animate-spin" />
        <PlayCircle v-else class="size-4" />
        啟用
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        class="gap-2 cursor-pointer text-destructive focus:text-destructive"
        @click="emit('remove', row)"
      >
        <Trash2 class="size-4" />
        移除
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
