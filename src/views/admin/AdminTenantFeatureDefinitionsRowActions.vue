<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-vue-next'
import type { TenantFeatureDefinitionAdminRow } from '@/api/tenant-feature-definitions'

const props = defineProps<{
  row: TenantFeatureDefinitionAdminRow
}>()

const emit = defineEmits<{
  edit: [row: TenantFeatureDefinitionAdminRow]
  delete: [row: TenantFeatureDefinitionAdminRow]
}>()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="size-8" aria-label="更多操作">
        <MoreHorizontal class="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-40">
      <DropdownMenuItem class="cursor-pointer gap-2" @click="emit('edit', props.row)">
        <Pencil class="size-4" />
        編輯
      </DropdownMenuItem>
      <DropdownMenuItem
        class="cursor-pointer gap-2 text-destructive focus:text-destructive"
        @click="emit('delete', props.row)"
      >
        <Trash2 class="size-4" />
        刪除
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
