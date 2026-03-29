<script setup lang="ts">
import { inject } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Badge } from '@/components/ui/badge'
import { orgDeptDetailKey } from '@/composables/org-dept-detail-context'
import type { OrgDeptTreeNode } from '@/api/organization'

const props = withDefaults(
  defineProps<{
    data: { node: OrgDeptTreeNode }
    /** 是否在節點內列出成員與職稱 */
    showMembers?: boolean
  }>(),
  { showMembers: true }
)

const detail = inject(orgDeptDetailKey, undefined)

function onOpenDetail() {
  detail?.openDetail(props.data.node)
}
</script>

<template>
  <div
    class="nodrag min-w-[220px] max-w-[300px] cursor-pointer rounded-lg border-2 border-border bg-card px-3 py-2.5 shadow-md transition-shadow hover:shadow-lg"
    @click="onOpenDetail"
  >
    <Handle
      type="target"
      :position="Position.Top"
      class="!-top-1 !left-1/2 !h-2 !w-2 !-translate-x-1/2 !border-2 !border-primary !bg-background"
    />
    <div class="text-sm">
      <div class="flex items-start gap-2">
        <span aria-hidden="true" class="shrink-0 text-lg leading-none">{{ data.node.icon }}</span>
        <div class="flex min-w-0 flex-1 items-baseline justify-between gap-2">
          <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <span
              class="line-clamp-2 text-base font-semibold leading-tight text-foreground"
              :title="data.node.name"
            >
              {{ data.node.name }}
            </span>
            <Badge v-if="data.node.status === 'archived'" variant="secondary" class="text-xs">
              已封存
            </Badge>
          </div>
          <span class="shrink-0 tabular-nums text-sm text-muted-foreground">
            {{ data.node.memberCount }} 人
          </span>
        </div>
      </div>
      <ul
        v-if="showMembers && data.node.members.length"
        class="mt-2 max-h-[6rem] space-y-1 overflow-y-auto pt-0.5 text-sm text-muted-foreground"
      >
        <li
          v-for="m in data.node.members.slice(0, 4)"
          :key="m.userId"
          class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5"
        >
          <span class="font-medium text-foreground">{{ m.name ?? m.userId }}</span>
          <span>{{ m.positionName }}</span>
          <Badge v-if="m.isManager" variant="outline" class="px-1.5 py-0 text-xs">主管</Badge>
        </li>
        <li v-if="data.node.members.length > 4" class="text-xs italic">
          …共 {{ data.node.members.length }} 人
        </li>
      </ul>
    </div>
    <Handle
      type="source"
      :position="Position.Bottom"
      class="!-bottom-1 !left-1/2 !h-2 !w-2 !-translate-x-1/2 !border-2 !border-primary !bg-background"
    />
  </div>
</template>
