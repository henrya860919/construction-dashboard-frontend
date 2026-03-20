<script setup lang="ts">
import { computed } from 'vue'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  PERMISSION_MODULES,
  PERMISSION_MODULE_LABELS,
  type PermissionModuleId,
} from '@/constants/permission-modules'
import type { ModulePermissionFlags } from '@/types/permissions'

const props = withDefaults(
  defineProps<{
    modelValue: Partial<Record<PermissionModuleId, ModulePermissionFlags>>
    /** 與租戶範本／角色預設不同的模組（專案客製） */
    highlightModuleIds?: PermissionModuleId[]
  }>(),
  { highlightModuleIds: () => [] }
)

const highlightSet = computed(() => new Set(props.highlightModuleIds ?? []))

const emit = defineEmits<{
  'update:modelValue': [v: Partial<Record<PermissionModuleId, ModulePermissionFlags>>]
}>()

const rows = computed(() =>
  PERMISSION_MODULES.map((id) => ({
    id,
    label: PERMISSION_MODULE_LABELS[id],
    flags: props.modelValue[id] ?? {
      canCreate: false,
      canRead: false,
      canUpdate: false,
      canDelete: false,
    },
  }))
)

function boolFromChecked(v: boolean | 'indeterminate'): boolean {
  return v === true
}

function patch(
  module: PermissionModuleId,
  patchFlags: Partial<ModulePermissionFlags>
) {
  const cur = props.modelValue[module] ?? {
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
  }
  emit('update:modelValue', {
    ...props.modelValue,
    [module]: { ...cur, ...patchFlags },
  })
}
</script>

<template>
  <div class="overflow-x-auto rounded-md border border-border">
    <table class="w-full min-w-[640px] text-sm">
      <thead>
        <tr class="border-b border-border bg-muted/40">
          <th class="px-3 py-2 text-left font-medium text-foreground">功能模組</th>
          <th class="w-14 px-1 py-2 text-center font-medium text-muted-foreground">新增</th>
          <th class="w-14 px-1 py-2 text-center font-medium text-muted-foreground">讀取</th>
          <th class="w-14 px-1 py-2 text-center font-medium text-muted-foreground">更新</th>
          <th class="w-14 px-1 py-2 text-center font-medium text-muted-foreground">刪除</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in rows"
          :key="r.id"
          :class="[
            'border-b border-border last:border-0 hover:bg-muted/20',
            highlightSet.has(r.id) && 'bg-accent/25',
          ]"
        >
          <td class="px-3 py-2 align-middle">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium text-foreground">{{ r.label }}</span>
              <Badge
                v-if="highlightSet.has(r.id)"
                variant="secondary"
                class="border border-border text-xs font-normal"
              >
                專案客製
              </Badge>
            </div>
            <div class="text-xs text-muted-foreground">{{ r.id }}</div>
          </td>
          <td class="px-1 py-2 text-center align-middle">
            <div class="flex justify-center">
              <Checkbox
                :checked="r.flags.canCreate"
                class="border-border"
                @update:checked="(v) => patch(r.id, { canCreate: boolFromChecked(v) })"
              />
            </div>
          </td>
          <td class="px-1 py-2 text-center align-middle">
            <div class="flex justify-center">
              <Checkbox
                :checked="r.flags.canRead"
                class="border-border"
                @update:checked="(v) => patch(r.id, { canRead: boolFromChecked(v) })"
              />
            </div>
          </td>
          <td class="px-1 py-2 text-center align-middle">
            <div class="flex justify-center">
              <Checkbox
                :checked="r.flags.canUpdate"
                class="border-border"
                @update:checked="(v) => patch(r.id, { canUpdate: boolFromChecked(v) })"
              />
            </div>
          </td>
          <td class="px-1 py-2 text-center align-middle">
            <div class="flex justify-center">
              <Checkbox
                :checked="r.flags.canDelete"
                class="border-border"
                @update:checked="(v) => patch(r.id, { canDelete: boolFromChecked(v) })"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
