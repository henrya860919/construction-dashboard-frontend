<script setup lang="ts">
import type { OrgDepartmentDto } from '@/api/organization'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'

defineOptions({ name: 'OrgDeptPickerTree' })

export interface OrgDeptPickerNode {
  dept: OrgDepartmentDto
  children: OrgDeptPickerNode[]
}

const props = withDefaults(
  defineProps<{
    nodes: OrgDeptPickerNode[]
    selectedId: string
    collapsedIds: ReadonlySet<string>
    depth?: number
  }>(),
  { depth: 0 }
)

const emit = defineEmits<{
  select: [id: string]
  'toggle-collapse': [id: string]
}>()

function isCollapsed(id: string) {
  return props.collapsedIds.has(id)
}
</script>

<template>
  <ul
    role="tree"
    :class="depth > 0 ? 'mt-0.5 space-y-0.5 border-l border-border pl-2' : 'space-y-0.5'"
  >
    <li
      v-for="node in nodes"
      :key="node.dept.id"
      role="treeitem"
      :aria-expanded="node.children.length ? !isCollapsed(node.dept.id) : undefined"
    >
      <div class="flex min-w-0 items-center gap-0.5">
        <button
          v-if="node.children.length"
          type="button"
          class="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          :aria-label="isCollapsed(node.dept.id) ? '展開子部門' : '收合子部門'"
          @click.stop="emit('toggle-collapse', node.dept.id)"
        >
          <ChevronDown v-if="!isCollapsed(node.dept.id)" class="size-4" aria-hidden="true" />
          <ChevronRight v-else class="size-4" aria-hidden="true" />
        </button>
        <span v-else class="size-8 shrink-0" aria-hidden="true" />
        <button
          type="button"
          class="min-w-0 flex-1 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/60"
          :class="
            selectedId === node.dept.id
              ? 'bg-muted font-medium text-foreground'
              : 'text-muted-foreground'
          "
          @click="emit('select', node.dept.id)"
        >
          <span class="flex min-w-0 items-center gap-1.5">
            <span class="shrink-0 text-base leading-none" aria-hidden="true">{{
              node.dept.icon
            }}</span>
            <span class="line-clamp-2">{{ node.dept.name }}</span>
          </span>
        </button>
      </div>
      <OrgDeptPickerTree
        v-if="node.children.length && !isCollapsed(node.dept.id)"
        :nodes="node.children"
        :selected-id="selectedId"
        :collapsed-ids="collapsedIds"
        :depth="depth + 1"
        @select="emit('select', $event)"
        @toggle-collapse="emit('toggle-collapse', $event)"
      />
    </li>
  </ul>
</template>
