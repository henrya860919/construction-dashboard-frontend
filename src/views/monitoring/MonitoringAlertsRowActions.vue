<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye } from 'lucide-vue-next'
import type { AlertHistoryItem } from '@/api/alerts'

defineProps<{
  row: AlertHistoryItem
}>()

const emit = defineEmits<{
  view: [row: AlertHistoryItem]
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
        查看
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
