<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-vue-next'

const props = defineProps<{
  onOpenRecords: () => void
  canRemove: boolean
  onRemove: () => void
}>()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" class="size-8 p-0" aria-label="更多操作">
        <MoreHorizontal class="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-52">
      <DropdownMenuItem class="cursor-pointer" @select="props.onOpenRecords">
        查驗紀錄
      </DropdownMenuItem>
      <DropdownMenuItem v-if="props.canRemove" class="cursor-pointer" @select="props.onRemove">
        移除匯入
      </DropdownMenuItem>
      <DropdownMenuItem v-else disabled class="text-muted-foreground">
        移除匯入（已有查驗紀錄）
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
