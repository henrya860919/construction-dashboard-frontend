<script setup lang="ts">
import { computed, inject } from 'vue'
import type { OrgDeptTreeNode } from '@/api/organization'
import { orgDeptAdminKey } from '@/composables/org-dept-admin-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-vue-next'
import OrgDeptTree from './OrgDeptTree.vue'

defineProps<{
  nodes: OrgDeptTreeNode[]
  depth?: number
}>()

const admin = inject(orgDeptAdminKey, undefined)
const showDeptAdmin = computed(() => !!admin && !admin.disabled.value)

function onEditDept(d: OrgDeptTreeNode) {
  admin?.edit(d)
}
function onDeleteDept(d: OrgDeptTreeNode) {
  admin?.delete(d)
}
</script>

<template>
  <ul
    :class="
      depth
        ? 'ml-3 space-y-3 border-l border-border pl-3 sm:ml-4 sm:pl-4'
        : 'space-y-3'
    "
  >
    <li v-for="d in nodes" :key="d.id" class="space-y-2">
      <div class="rounded-lg border border-border bg-card px-3 py-2 text-sm">
        <div class="flex flex-wrap items-start gap-2">
          <div class="min-w-0 flex-1 space-y-1 px-1 py-0.5 text-left">
            <div class="flex flex-wrap items-center gap-2">
              <span aria-hidden="true">{{ d.icon }}</span>
              <span class="font-medium text-foreground">{{ d.name }}</span>
              <span class="text-muted-foreground tabular-nums">{{ d.memberCount }} 人</span>
              <Badge v-if="d.status === 'archived'" variant="secondary" class="text-xs">
                已封存
              </Badge>
            </div>
          </div>
          <div v-if="showDeptAdmin" class="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8 shrink-0"
                  aria-label="部門操作"
                  @pointerdown.stop
                  @mousedown.stop
                >
                  <MoreHorizontal class="size-4" />
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-40">
              <DropdownMenuItem class="cursor-pointer gap-2" @click="onEditDept(d)">
                <Pencil class="size-4" />
                編輯
              </DropdownMenuItem>
              <DropdownMenuItem
                class="cursor-pointer gap-2 text-destructive focus:text-destructive"
                @click="onDeleteDept(d)"
              >
                <Trash2 class="size-4" />
                刪除
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <ul
          v-if="d.members.length"
          class="mt-2 w-full space-y-1 border-t border-border pt-2 text-left text-muted-foreground"
        >
          <li
            v-for="m in d.members"
            :key="m.userId"
            class="flex flex-wrap items-center gap-x-2 gap-y-1"
          >
            <span class="text-foreground">{{ m.name ?? m.userId }}</span>
            <span>{{ m.positionName }}</span>
            <Badge v-if="m.isManager" variant="outline" class="text-xs">主管</Badge>
          </li>
        </ul>
      </div>
      <OrgDeptTree
        v-if="d.children.length"
        :nodes="d.children"
        :depth="(depth ?? 0) + 1"
      />
    </li>
  </ul>
</template>
