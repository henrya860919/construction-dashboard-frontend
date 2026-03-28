<script setup lang="ts">
import { computed } from 'vue'
import type { ElectronicFormFieldItem } from '@/api/electronic-form-definitions'
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

const props = defineProps<{
  beforeField: ElectronicFormFieldItem
  allFields: ElectronicFormFieldItem[]
  isDraft: boolean
  reordering: boolean
  reorderDragOverKey: string | null
  /** 畫布上正拖曳欄位或元件庫項目時為 true */
  canvasDragActive: boolean
}>()

const gapKey = computed(() => `gap-before:${props.beforeField.id}`)

const isHot = computed(
  () => props.canvasDragActive && props.reorderDragOverKey === gapKey.value
)

const emit = defineEmits<{
  'drag-over': [key: string | null]
  'drag-end': []
  'sync-layout': [assignments: ElectronicFormLayoutAssignment[]]
  'palette-drop': [entry: ElectronicFormBuilderPaletteEntry, placement: ElectronicFormBuilderPaletteDropPlacement]
}>()

function onDragOver(e: DragEvent) {
  if (!props.isDraft || props.reordering || !props.canvasDragActive) return
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) {
    // 一律用 move，避免部分瀏覽器對 copy 顯示綠色 +
    e.dataTransfer.dropEffect = 'move'
  }
  emit('drag-over', gapKey.value)
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (!props.isDraft) return

  const paletteEntry = parseElectronicFormPaletteEntryFromDataTransfer(e.dataTransfer)
  if (paletteEntry) {
    emit('palette-drop', paletteEntry, { kind: 'before-field', beforeField: props.beforeField })
    emit('drag-end')
    return
  }

  const dragId = e.dataTransfer?.getData('text/plain') || ''
  if (!dragId || dragId === props.beforeField.id) {
    emit('drag-end')
    return
  }

  const target: BuilderDropTarget = { type: 'before', targetField: props.beforeField }
  if (!canDropField(props.allFields, dragId, target)) {
    emit('drag-end')
    return
  }

  const assignments = moveFieldToContainer(
    props.allFields,
    dragId,
    props.beforeField.parentFieldId ?? null,
    props.beforeField.slotIndex ?? null,
    props.beforeField.id
  )
  emit('sync-layout', assignments)
}

</script>

<template>
  <div
    v-if="isDraft && !reordering"
    class="relative shrink-0 transition-[min-height,padding] duration-150 ease-out"
    :class="isHot ? 'min-h-[3.25rem] py-1.5' : 'min-h-2 py-1'"
    @dragover.prevent.stop="onDragOver"
    @drop.prevent.stop="onDrop"
  >
    <div
      class="mx-auto flex max-w-full items-center justify-center overflow-hidden rounded-lg border text-center transition-all duration-150"
      :class="
        isHot
          ? 'border-primary/45 bg-card px-3 py-2.5 shadow-sm ring-1 ring-ring/25'
          : 'border-transparent bg-transparent'
      "
    >
      <span v-if="isHot" class="text-xs font-medium text-muted-foreground">放開以插入於此</span>
    </div>
  </div>
</template>
