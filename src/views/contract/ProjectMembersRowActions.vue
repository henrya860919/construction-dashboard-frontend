<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Trash2, PauseCircle, PlayCircle, Loader2, Shield } from 'lucide-vue-next'
import type { ProjectMemberItem } from '@/types'

withDefaults(
  defineProps<{
    row: ProjectMemberItem
    togglingStatusId: string | null
    /** project.members：update — 停用／啟用 */
    canUpdateMembership?: boolean
    /** project.members：delete — 移出專案 */
    canRemoveMember?: boolean
    /** project.members：update — 編輯該成員在本專案的模組覆寫（平台管理員帳號不顯示） */
    canEditPermissions?: boolean
  }>(),
  { canUpdateMembership: false, canRemoveMember: false, canEditPermissions: false }
)

const emit = defineEmits<{
  toggleStatus: [row: ProjectMemberItem]
  remove: [row: ProjectMemberItem]
  editPermissions: [row: ProjectMemberItem]
}>()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="size-8 shrink-0" aria-label="更多">
        <MoreHorizontal class="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-[11rem]">
      <DropdownMenuItem
        v-if="canEditPermissions"
        class="gap-2 cursor-pointer"
        @click="emit('editPermissions', row)"
      >
        <Shield class="size-4" />
        專案權限
      </DropdownMenuItem>
      <DropdownMenuSeparator v-if="canEditPermissions && (canUpdateMembership || canRemoveMember)" />
      <DropdownMenuItem
        v-if="canUpdateMembership && row.status === 'active'"
        class="gap-2 cursor-pointer"
        :disabled="togglingStatusId === row.id"
        @click="emit('toggleStatus', row)"
      >
        <Loader2 v-if="togglingStatusId === row.id" class="size-4 animate-spin" />
        <PauseCircle v-else class="size-4" />
        停用
      </DropdownMenuItem>
      <DropdownMenuItem
        v-else-if="canUpdateMembership"
        class="gap-2 cursor-pointer"
        :disabled="togglingStatusId === row.id"
        @click="emit('toggleStatus', row)"
      >
        <Loader2 v-if="togglingStatusId === row.id" class="size-4 animate-spin" />
        <PlayCircle v-else class="size-4" />
        啟用
      </DropdownMenuItem>
      <DropdownMenuSeparator v-if="canRemoveMember" />
      <DropdownMenuItem
        v-if="canRemoveMember"
        class="gap-2 cursor-pointer text-destructive focus:text-destructive"
        @click="emit('remove', row)"
      >
        <Trash2 class="size-4" />
        移除
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
