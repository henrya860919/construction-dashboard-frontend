<script setup lang="ts">
import { withDefaults } from 'vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, PauseCircle, PlayCircle, Shield } from 'lucide-vue-next'
import type { AdminUserItem } from '@/types'

const props = withDefaults(
  defineProps<{
    row: AdminUserItem
    /** 可編輯「加入專案時複製的權限範本」（不適用於平台管理員帳號） */
    showPermissionTemplate?: boolean
  }>(),
  { showPermissionTemplate: false }
)

const emit = defineEmits<{
  view: [row: AdminUserItem]
  toggleStatus: [row: AdminUserItem]
  permissionTemplate: [row: AdminUserItem]
}>()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="size-8" aria-label="更多">
        <MoreHorizontal class="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-[11rem]">
      <DropdownMenuItem class="gap-2 cursor-pointer" @click="emit('view', row)">
        <Eye class="size-4" />
        檢視
      </DropdownMenuItem>
      <DropdownMenuItem
        v-if="props.showPermissionTemplate"
        class="gap-2 cursor-pointer"
        @click="emit('permissionTemplate', row)"
      >
        <Shield class="size-4" />
        權限範本
      </DropdownMenuItem>
      <DropdownMenuItem
        v-if="(row.status ?? 'active') === 'suspended'"
        class="gap-2 cursor-pointer"
        @click="emit('toggleStatus', row)"
      >
        <PlayCircle class="size-4" />
        啟用
      </DropdownMenuItem>
      <DropdownMenuItem
        v-else
        class="gap-2 cursor-pointer text-destructive focus:text-destructive"
        @click="emit('toggleStatus', row)"
      >
        <PauseCircle class="size-4" />
        停用
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
