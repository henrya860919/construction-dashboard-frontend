<script setup lang="ts">
import { computed } from 'vue'
import { GripVertical } from 'lucide-vue-next'
import ElectronicFormCanvasField from '@/components/electronic-form/ElectronicFormCanvasField.vue'
import type { ElectronicFormFieldItem } from '@/api/electronic-form-definitions'
import { getElectronicFormColumnsCount } from '@/constants/electronic-form-field-contract'
import {
  canDropField,
  moveFieldToContainer,
  type BuilderDropTarget,
  type ElectronicFormLayoutAssignment,
} from '@/lib/electronic-form-builder-layout'
import type { ElectronicFormBuilderPaletteEntry } from '@/constants/electronic-form-builder-palette'
import {
  parseElectronicFormPaletteEntryFromDataTransfer,
  type ElectronicFormBuilderPaletteDropPlacement,
} from '@/lib/electronic-form-builder-palette-drag'

import ElectronicFormBuilderDropGap from '@/components/electronic-form/ElectronicFormBuilderDropGap.vue'
import ElectronicFormBuilderFieldRow from '@/components/electronic-form/ElectronicFormBuilderFieldRow.vue'

const props = defineProps<{
  field: ElectronicFormFieldItem
  allFields: ElectronicFormFieldItem[]
  selectedFieldId: string | null
  isDraft: boolean
  reordering: boolean
  duplicatingFieldId: string | null
  /** 貼上／其他批次操作時一併鎖定複製鈕與拖曳 */
  actionsLocked?: boolean
  /** 畫布上正拖曳欄位或元件庫項目 */
  canvasDragActive: boolean
  reorderDraggingId: string | null
  reorderDragOverKey: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
  duplicate: [field: ElectronicFormFieldItem]
  'delete-request': [field: ElectronicFormFieldItem]
  'drag-start': [event: DragEvent, fieldId: string]
  'drag-end': []
  'drag-over': [key: string | null]
  'sync-layout': [assignments: ElectronicFormLayoutAssignment[]]
  'palette-drop': [entry: ElectronicFormBuilderPaletteEntry, placement: ElectronicFormBuilderPaletteDropPlacement]
}>()

function sortedChildren(parentId: string, slot: number | null): ElectronicFormFieldItem[] {
  return props.allFields
    .filter(
      (f) =>
        (f.parentFieldId ?? null) === parentId && (f.slotIndex ?? null) === slot
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

const sectionChildren = computed(() => sortedChildren(props.field.id, null))

const columnsSlotCount = computed(() =>
  props.field.fieldType === 'columns'
    ? getElectronicFormColumnsCount(props.field.config as Record<string, unknown>)
    : 0
)

const columnSlots = computed(() =>
  Array.from({ length: columnsSlotCount.value }, (_, i) => i)
)

function childRows(slot: number) {
  return sortedChildren(props.field.id, slot)
}

function dragIdFromEvent(e: DragEvent): string {
  return e.dataTransfer?.getData('text/plain') || ''
}

function handleDropSlotEnd(e: DragEvent, slotIndex: number) {
  e.preventDefault()
  e.stopPropagation()
  const paletteEntry = parseElectronicFormPaletteEntryFromDataTransfer(e.dataTransfer)
  if (paletteEntry) {
    emit('palette-drop', paletteEntry, {
      kind: 'columns-slot',
      columnsId: props.field.id,
      slotIndex,
    })
    emit('drag-end')
    return
  }
  const dragId = dragIdFromEvent(e)
  if (!dragId) {
    emit('drag-end')
    return
  }
  const target: BuilderDropTarget = {
    type: 'append-slot',
    parentColumnsId: props.field.id,
    slotIndex,
  }
  if (!canDropField(props.allFields, dragId, target)) {
    emit('drag-end')
    return
  }
  const assignments = moveFieldToContainer(
    props.allFields,
    dragId,
    props.field.id,
    slotIndex,
    null
  )
  emit('sync-layout', assignments)
}

function handleDropSectionAppend(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (props.field.fieldType !== 'section') return
  const paletteEntry = parseElectronicFormPaletteEntryFromDataTransfer(e.dataTransfer)
  if (paletteEntry) {
    emit('palette-drop', paletteEntry, { kind: 'section-append', sectionId: props.field.id })
    emit('drag-end')
    return
  }
  const dragId = dragIdFromEvent(e)
  if (!dragId) {
    emit('drag-end')
    return
  }
  const target: BuilderDropTarget = { type: 'append-section', sectionId: props.field.id }
  if (!canDropField(props.allFields, dragId, target)) {
    emit('drag-end')
    return
  }
  const assignments = moveFieldToContainer(props.allFields, dragId, props.field.id, null, null)
  emit('sync-layout', assignments)
}

function onSlotContainerDragOver(e: DragEvent, slotIndex: number) {
  if (!props.canvasDragActive) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  emit('drag-over', `slotend:${props.field.id}:${slotIndex}`)
}

function onSectionAppendDragOver(e: DragEvent) {
  if (!props.canvasDragActive) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  emit('drag-over', `sectionend:${props.field.id}`)
}

function slotHighlighted(slotIndex: number) {
  return props.reorderDragOverKey === `slotend:${props.field.id}:${slotIndex}`
}

function sectionAppendHighlighted() {
  return props.reorderDragOverKey === `sectionend:${props.field.id}`
}

const isContainerField = computed(
  () => props.field.fieldType === 'section' || props.field.fieldType === 'columns'
)

/** 多欄列內層 grid 間距（與預覽 columns gap 一致） */
const columnsInnerGapClass = computed(() => {
  const g = props.field.config?.gap
  if (g === 'sm') return 'gap-2'
  if (g === 'lg') return 'gap-4'
  return 'gap-3'
})
</script>

<template>
  <div class="space-y-2">
    <div
      class="flex min-w-0 gap-2 rounded-lg transition-[opacity,box-shadow]"
      :class="[
        'col-span-12',
        isDraft && !reordering && !actionsLocked
          ? 'cursor-grab touch-none select-none active:cursor-grabbing'
          : '',
        reordering && isDraft ? 'pointer-events-none opacity-40' : '',
        reorderDraggingId === field.id ? 'opacity-75' : '',
      ]"
      :draggable="isDraft && !reordering && !actionsLocked"
      @dragstart="emit('drag-start', $event, field.id)"
      @dragend="emit('drag-end')"
    >
      <span
        v-if="isDraft"
        class="flex w-7 shrink-0 select-none flex-col justify-center text-muted-foreground"
        aria-hidden="true"
        title="拖曳排序"
      >
        <GripVertical class="mx-auto size-4" />
      </span>
      <ElectronicFormCanvasField
        class="min-h-0 min-w-0 flex-1"
        :field="field"
        :selected="selectedFieldId === field.id"
        :is-draft="isDraft"
        :duplicate-busy="duplicatingFieldId !== null || !!actionsLocked"
        :preview-builder-shell="isContainerField"
        @select="emit('select', field.id)"
        @duplicate="emit('duplicate', $event)"
        @delete-request="emit('delete-request', $event)"
      >
        <template v-if="isContainerField" #nested>
          <div
            v-if="field.fieldType === 'section'"
            class="min-w-0 space-y-2 rounded-md border border-dashed border-border/70 bg-muted/15 p-2"
          >
            <template v-for="c in sectionChildren" :key="c.id">
              <ElectronicFormBuilderDropGap
                :before-field="c"
                :all-fields="allFields"
                :is-draft="isDraft"
                :reordering="reordering"
                :reorder-drag-over-key="reorderDragOverKey"
                :canvas-drag-active="canvasDragActive"
                @drag-over="emit('drag-over', $event)"
                @drag-end="emit('drag-end')"
                @sync-layout="emit('sync-layout', $event)"
                @palette-drop="(entry, p) => emit('palette-drop', entry, p)"
              />
              <ElectronicFormBuilderFieldRow
                :field="c"
                :all-fields="allFields"
                :selected-field-id="selectedFieldId"
                :is-draft="isDraft"
                :reordering="reordering"
                :duplicating-field-id="duplicatingFieldId"
                :actions-locked="actionsLocked"
                :canvas-drag-active="canvasDragActive"
                :reorder-dragging-id="reorderDraggingId"
                :reorder-drag-over-key="reorderDragOverKey"
                @select="emit('select', $event)"
                @duplicate="emit('duplicate', $event)"
                @delete-request="emit('delete-request', $event)"
                @drag-start="(e, id) => emit('drag-start', e, id)"
                @drag-end="emit('drag-end')"
                @drag-over="emit('drag-over', $event)"
                @sync-layout="emit('sync-layout', $event)"
                @palette-drop="(entry, p) => emit('palette-drop', entry, p)"
              />
            </template>
            <div
              v-if="isDraft && !reordering"
              class="flex min-h-[3.25rem] flex-col items-center justify-center rounded-lg border border-dashed px-3 py-2 text-center text-xs transition-all duration-150"
              :class="
                sectionAppendHighlighted()
                  ? 'border-primary/45 bg-card text-muted-foreground shadow-sm ring-1 ring-ring/25'
                  : 'border-border/60 text-muted-foreground hover:border-border hover:bg-muted/20'
              "
              @dragover.prevent.stop="onSectionAppendDragOver($event)"
              @drop.prevent.stop="handleDropSectionAppend"
            >
              <span v-if="sectionAppendHighlighted()">放開以置於區塊底部</span>
              <span v-else>拖曳至此或從元件庫拖入（區塊底部）</span>
            </div>
          </div>
          <div
            v-else-if="field.fieldType === 'columns'"
            class="min-w-0 rounded-md border border-dashed border-border/80 bg-muted/20 p-2"
          >
            <div
              class="grid min-w-0"
              :class="columnsInnerGapClass"
              :style="{
                gridTemplateColumns: `repeat(${columnsSlotCount}, minmax(0, 1fr))`,
              }"
            >
              <div
                v-for="si in columnSlots"
                :key="si"
                class="min-w-0 space-y-2 rounded-md border p-2 transition-all duration-150"
                :class="
                  slotHighlighted(si)
                    ? 'border-primary/45 bg-card ring-1 ring-ring/25'
                    : 'border-border/60 bg-background/60'
                "
                @dragover.prevent.stop="onSlotContainerDragOver($event, si)"
                @drop.prevent.stop="handleDropSlotEnd($event, si)"
              >
                <p
                  class="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  第 {{ si + 1 }} 欄
                </p>
                <template v-for="c in childRows(si)" :key="c.id">
                  <ElectronicFormBuilderDropGap
                    :before-field="c"
                    :all-fields="allFields"
                    :is-draft="isDraft"
                    :reordering="reordering"
                    :reorder-drag-over-key="reorderDragOverKey"
                    :canvas-drag-active="canvasDragActive"
                    @drag-over="emit('drag-over', $event)"
                    @drag-end="emit('drag-end')"
                    @sync-layout="emit('sync-layout', $event)"
                    @palette-drop="(entry, p) => emit('palette-drop', entry, p)"
                  />
                  <ElectronicFormBuilderFieldRow
                    :field="c"
                    :all-fields="allFields"
                    :selected-field-id="selectedFieldId"
                    :is-draft="isDraft"
                    :reordering="reordering"
                    :duplicating-field-id="duplicatingFieldId"
                    :actions-locked="actionsLocked"
                    :canvas-drag-active="canvasDragActive"
                    :reorder-dragging-id="reorderDraggingId"
                    :reorder-drag-over-key="reorderDragOverKey"
                    @select="emit('select', $event)"
                    @duplicate="emit('duplicate', $event)"
                    @delete-request="emit('delete-request', $event)"
                    @drag-start="(e, id) => emit('drag-start', e, id)"
                    @drag-end="emit('drag-end')"
                    @drag-over="emit('drag-over', $event)"
                    @sync-layout="emit('sync-layout', $event)"
                    @palette-drop="(entry, p) => emit('palette-drop', entry, p)"
                  />
                </template>
                <p
                  v-if="childRows(si).length === 0 && isDraft && !reordering"
                  class="py-4 text-center text-[11px] text-muted-foreground"
                >
                  拖入欄位或元件庫項目
                </p>
              </div>
            </div>
          </div>
        </template>
      </ElectronicFormCanvasField>
    </div>
  </div>
</template>
