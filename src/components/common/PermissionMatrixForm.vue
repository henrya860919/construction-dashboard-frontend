<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { HTMLAttributes } from 'vue'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  PERMISSION_MODULES,
  PERMISSION_MODULE_LABELS,
  PERMISSION_MATRIX_UI_DISABLED,
  PERMISSION_SYSTEM_LAYERS,
  defaultSystemLayerForMatrix,
  permissionModulesForSystemLayer,
  type PermissionMatrixFlagKey,
  type PermissionModuleId,
  type PermissionSystemLayerId,
} from '@/constants/permission-modules'
import type { ModulePermissionFlags } from '@/types/permissions'

const props = withDefaults(
  defineProps<{
    modelValue: Partial<Record<PermissionModuleId, ModulePermissionFlags>>
    /** 與租戶範本／角色預設不同的模組（專案客製） */
    highlightModuleIds?: PermissionModuleId[]
    /** 平台關閉之模組：整列鎖定並標示 */
    platformDisabledModuleIds?: PermissionModuleId[]
    /**
     * flat：單表列出全部模組（專案成員等）
     * systemLayers：左欄系統層、右欄該層 CRUD（租戶成員權限範本）
     */
    variant?: 'flat' | 'systemLayers'
    class?: HTMLAttributes['class']
  }>(),
  {
    highlightModuleIds: () => [],
    platformDisabledModuleIds: () => [],
    variant: 'flat',
  }
)

const highlightSet = computed(() => new Set(props.highlightModuleIds ?? []))
const platformDisabledSet = computed(() => new Set(props.platformDisabledModuleIds ?? []))

const emit = defineEmits<{
  'update:modelValue': [v: Partial<Record<PermissionModuleId, ModulePermissionFlags>>]
}>()

const defaultFlags: ModulePermissionFlags = {
  canCreate: false,
  canRead: false,
  canUpdate: false,
  canDelete: false,
}

const isSystemLayers = computed(() => props.variant === 'systemLayers')
const selectedSystemLayer = ref<PermissionSystemLayerId>(defaultSystemLayerForMatrix())

watch(
  () => props.variant,
  (v) => {
    if (v === 'systemLayers') selectedSystemLayer.value = defaultSystemLayerForMatrix()
  }
)

/** 模板內不可寫 selectedSystemLayer = id（ref 解包後賦值不會更新 ref） */
function selectSystemLayer(id: PermissionSystemLayerId) {
  selectedSystemLayer.value = id
}

const moduleIdsForTable = computed((): PermissionModuleId[] => {
  if (!isSystemLayers.value) return [...PERMISSION_MODULES]
  return permissionModulesForSystemLayer(selectedSystemLayer.value)
})

const rows = computed(() =>
  moduleIdsForTable.value.map((id) => ({
    id,
    label: PERMISSION_MODULE_LABELS[id],
    flags: props.modelValue[id] ?? { ...defaultFlags },
  }))
)

function cellDisabled(module: PermissionModuleId, key: PermissionMatrixFlagKey): boolean {
  if (platformDisabledSet.value.has(module)) return true
  return !!PERMISSION_MATRIX_UI_DISABLED[module]?.[key]
}

function boolFromChecked(v: boolean | 'indeterminate'): boolean {
  return v === true
}

function patch(module: PermissionModuleId, patchFlags: Partial<ModulePermissionFlags>) {
  const cur = props.modelValue[module] ?? { ...defaultFlags }
  emit('update:modelValue', {
    ...props.modelValue,
    [module]: { ...cur, ...patchFlags },
  })
}

function columnHeaderChecked(flag: PermissionMatrixFlagKey): boolean | 'indeterminate' {
  const editable = rows.value.filter((r) => !cellDisabled(r.id, flag))
  if (!editable.length) return false
  const on = editable.filter((r) => r.flags[flag]).length
  if (on === 0) return false
  if (on === editable.length) return true
  return 'indeterminate'
}

function columnHeaderDisabled(flag: PermissionMatrixFlagKey): boolean {
  return !rows.value.some((r) => !cellDisabled(r.id, flag))
}

function toggleColumnAll(flag: PermissionMatrixFlagKey, checked: boolean) {
  const editable = rows.value.filter((r) => !cellDisabled(r.id, flag))
  if (!editable.length) return
  const next: Partial<Record<PermissionModuleId, ModulePermissionFlags>> = {
    ...props.modelValue,
  }
  for (const r of editable) {
    const cur = next[r.id] ?? { ...defaultFlags }
    next[r.id] = { ...cur, [flag]: checked }
  }
  emit('update:modelValue', next)
}

function onHeaderColumnUpdate(flag: PermissionMatrixFlagKey, v: boolean | 'indeterminate') {
  const checked = boolFromChecked(v)
  toggleColumnAll(flag, checked)
}
</script>

<template>
  <div
    :class="
      cn(
        'flex min-h-0 overflow-hidden rounded-md border border-border',
        isSystemLayers ? 'h-full min-h-0 flex-1 flex-col md:flex-row' : 'flex-1 flex-col',
        props.class
      )
    "
  >
    <!-- 左欄：系統層（僅租戶權限範本等） -->
    <aside
      v-if="isSystemLayers"
      class="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-border bg-muted/30 p-2 md:w-52 md:flex-col md:gap-0.5 md:border-b-0 md:border-r md:border-border"
      aria-label="系統層"
    >
      <Button
        v-for="layer in PERMISSION_SYSTEM_LAYERS"
        :key="layer.id"
        type="button"
        size="sm"
        variant="ghost"
        class="h-9 shrink-0 justify-start px-3 md:w-full"
        :class="
          selectedSystemLayer === layer.id && 'bg-accent font-medium text-accent-foreground'
        "
        :aria-pressed="selectedSystemLayer === layer.id"
        @click="selectSystemLayer(layer.id)"
      >
        {{ layer.label }}
      </Button>
    </aside>

    <!-- 右欄：功能模組 × CRUD（min-h-0 + overflow-auto 才能出現垂直捲軸） -->
    <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div
        v-if="isSystemLayers && rows.length === 0"
        class="flex flex-1 items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground"
      >
        此系統層尚無可設定的功能模組。採購管理等將於後續模組上線後顯示於此。
      </div>
      <div v-else class="min-h-0 flex-1 overflow-auto">
        <table class="w-full min-w-[640px] text-sm">
          <thead>
            <tr class="sticky top-0 z-[1] border-b border-border bg-muted/95 backdrop-blur-sm">
              <th class="px-3 py-2 text-left font-medium text-foreground">功能模組</th>
              <th class="w-14 px-1 py-2 text-center font-medium text-muted-foreground">
                <div class="flex flex-col items-center gap-1">
                  <span>新增</span>
                  <div class="flex justify-center">
                    <Checkbox
                      :checked="columnHeaderChecked('canCreate')"
                      :disabled="columnHeaderDisabled('canCreate')"
                      class="border-border"
                      @update:checked="(v) => onHeaderColumnUpdate('canCreate', v)"
                    />
                  </div>
                </div>
              </th>
              <th class="w-14 px-1 py-2 text-center font-medium text-muted-foreground">
                <div class="flex flex-col items-center gap-1">
                  <span>讀取</span>
                  <div class="flex justify-center">
                    <Checkbox
                      :checked="columnHeaderChecked('canRead')"
                      :disabled="columnHeaderDisabled('canRead')"
                      class="border-border"
                      @update:checked="(v) => onHeaderColumnUpdate('canRead', v)"
                    />
                  </div>
                </div>
              </th>
              <th class="w-14 px-1 py-2 text-center font-medium text-muted-foreground">
                <div class="flex flex-col items-center gap-1">
                  <span>更新</span>
                  <div class="flex justify-center">
                    <Checkbox
                      :checked="columnHeaderChecked('canUpdate')"
                      :disabled="columnHeaderDisabled('canUpdate')"
                      class="border-border"
                      @update:checked="(v) => onHeaderColumnUpdate('canUpdate', v)"
                    />
                  </div>
                </div>
              </th>
              <th class="w-14 px-1 py-2 text-center font-medium text-muted-foreground">
                <div class="flex flex-col items-center gap-1">
                  <span>刪除</span>
                  <div class="flex justify-center">
                    <Checkbox
                      :checked="columnHeaderChecked('canDelete')"
                      :disabled="columnHeaderDisabled('canDelete')"
                      class="border-border"
                      @update:checked="(v) => onHeaderColumnUpdate('canDelete', v)"
                    />
                  </div>
                </div>
              </th>
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
                    v-if="platformDisabledSet.has(r.id)"
                    variant="outline"
                    class="border-border text-xs font-normal text-muted-foreground"
                  >
                    平台未開通
                  </Badge>
                  <Badge
                    v-else-if="highlightSet.has(r.id)"
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
                    :disabled="cellDisabled(r.id, 'canCreate')"
                    class="border-border"
                    @update:checked="(v) => patch(r.id, { canCreate: boolFromChecked(v) })"
                  />
                </div>
              </td>
              <td class="px-1 py-2 text-center align-middle">
                <div class="flex justify-center">
                  <Checkbox
                    :checked="r.flags.canRead"
                    :disabled="cellDisabled(r.id, 'canRead')"
                    class="border-border"
                    @update:checked="(v) => patch(r.id, { canRead: boolFromChecked(v) })"
                  />
                </div>
              </td>
              <td class="px-1 py-2 text-center align-middle">
                <div class="flex justify-center">
                  <Checkbox
                    :checked="r.flags.canUpdate"
                    :disabled="cellDisabled(r.id, 'canUpdate')"
                    class="border-border"
                    @update:checked="(v) => patch(r.id, { canUpdate: boolFromChecked(v) })"
                  />
                </div>
              </td>
              <td class="px-1 py-2 text-center align-middle">
                <div class="flex justify-center">
                  <Checkbox
                    :checked="r.flags.canDelete"
                    :disabled="cellDisabled(r.id, 'canDelete')"
                    class="border-border"
                    @update:checked="(v) => patch(r.id, { canDelete: boolFromChecked(v) })"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
