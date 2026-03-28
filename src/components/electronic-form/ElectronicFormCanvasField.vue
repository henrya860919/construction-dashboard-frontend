<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import ElectronicFormFieldBuilderPreview from '@/components/electronic-form/ElectronicFormFieldBuilderPreview.vue'
import type { ElectronicFormFieldItem } from '@/api/electronic-form-definitions'
import {
  ELECTRONIC_FORM_FIELD_TYPE_LABELS,
  isElectronicFormFieldType,
} from '@/constants/electronic-form-field-contract'
import { cn } from '@/lib/utils'
import { Copy, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  field: ElectronicFormFieldItem
  selected: boolean
  isDraft: boolean
  /** 複製 API 進行中時避免重複點擊 */
  duplicateBusy?: boolean
  /** 區塊／多欄列：預覽僅顯示標題／說明，子欄位由 #nested 包在同一卡片內 */
  previewBuilderShell?: boolean
}>()

const emit = defineEmits<{
  select: []
  /** 帶上欄位本體，避免父層 v-for 閉包或重排後誤用錯列 */
  duplicate: [field: ElectronicFormFieldItem]
  'delete-request': [field: ElectronicFormFieldItem]
}>()

function onCardClick() {
  emit('select')
}

const DATA_FIELD_TYPES: ReadonlySet<string> = new Set([
  'text',
  'textarea',
  'number',
  'currency',
  'date',
  'select',
  'radio',
  'checkbox_group',
])

const canvasTypeBadgeLabel = computed(() => {
  const f = props.field
  return isElectronicFormFieldType(f.fieldType)
    ? ELECTRONIC_FORM_FIELD_TYPE_LABELS[f.fieldType]
    : f.fieldType
})

const isDataFieldWithLeadingLabel = computed(() => DATA_FIELD_TYPES.has(props.field.fieldType))

const isSectionField = computed(() => props.field.fieldType === 'section')

const canvasDisplayTitle = computed(() => {
  const f = props.field
  const t = f.fieldType
  if (isElectronicFormFieldType(t)) {
    return f.label?.trim() || ELECTRONIC_FORM_FIELD_TYPE_LABELS[t]
  }
  return f.label?.trim() || t
})
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    :class="
      cn(
        'border-border',
        selected ? 'bg-muted/50 shadow-sm' : 'bg-card hover:bg-muted/30',
        isDraft && 'cursor-inherit',
      )
    "
    @click="onCardClick"
    @keydown.enter.prevent="onCardClick"
    @keydown.space.prevent="onCardClick"
  >
    <div class="min-w-0 space-y-2">
      <template v-if="isDataFieldWithLeadingLabel">
        <div class="flex min-w-0 flex-row flex-wrap items-center justify-between gap-2">
          <div class="flex min-w-0 flex-row flex-wrap items-center gap-2">
            <Badge variant="default" class="pointer-events-none shrink-0 font-medium">
              {{ canvasTypeBadgeLabel }}
            </Badge>
            <span class="min-w-0 text-sm font-medium leading-snug text-foreground whitespace-pre-wrap break-words">
              {{ canvasDisplayTitle }}<span v-if="field.required" class="text-destructive">*</span>
            </span>
          </div>
          <div
            v-if="selected && isDraft"
            draggable="false"
            class="pointer-events-auto flex shrink-0 flex-row items-center gap-1.5"
            @click.stop
          >
            <Button
              type="button"
              variant="secondary"
              size="icon"
              class="size-8 shadow-sm"
              title="複製欄位"
              aria-label="複製欄位"
              :disabled="duplicateBusy"
              @click="emit('duplicate', props.field)"
            >
              <Copy class="size-4" />
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              class="size-8 shadow-sm"
              title="刪除欄位"
              aria-label="刪除欄位"
              @click="emit('delete-request', props.field)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>
        <ElectronicFormFieldBuilderPreview
          :field="field"
          :builder-shell="previewBuilderShell === true"
          :omit-leading-field-label="true"
        />
      </template>

      <template v-else-if="isSectionField">
        <div class="flex min-w-0 flex-row flex-wrap items-center justify-between gap-2">
          <div class="flex min-w-0 flex-row flex-wrap items-center gap-2">
            <Badge variant="default" class="pointer-events-none shrink-0 font-medium">
              {{ canvasTypeBadgeLabel }}
            </Badge>
            <span class="min-w-0 text-base font-semibold leading-snug text-foreground whitespace-pre-wrap break-words">
              {{ canvasDisplayTitle }}
            </span>
          </div>
          <div
            v-if="selected && isDraft"
            draggable="false"
            class="pointer-events-auto flex shrink-0 flex-row items-center gap-1.5"
            @click.stop
          >
            <Button
              type="button"
              variant="secondary"
              size="icon"
              class="size-8 shadow-sm"
              title="複製欄位"
              aria-label="複製欄位"
              :disabled="duplicateBusy"
              @click="emit('duplicate', props.field)"
            >
              <Copy class="size-4" />
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              class="size-8 shadow-sm"
              title="刪除欄位"
              aria-label="刪除欄位"
              @click="emit('delete-request', props.field)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>
        <ElectronicFormFieldBuilderPreview
          :field="field"
          :builder-shell="previewBuilderShell === true"
          :omit-section-title="true"
        />
        <div v-if="$slots.nested" class="min-w-0" @click.stop>
          <slot name="nested" />
        </div>
      </template>

      <template v-else>
        <div class="flex min-w-0 flex-row items-start justify-between gap-2">
          <div class="flex min-w-0 min-h-0 flex-1 items-start gap-2">
            <Badge variant="default" class="pointer-events-none mt-0.5 shrink-0 font-medium">
              {{ canvasTypeBadgeLabel }}
            </Badge>
            <div class="min-w-0 min-h-0 flex-1 space-y-2">
              <ElectronicFormFieldBuilderPreview
                :field="field"
                :builder-shell="previewBuilderShell === true"
              />
              <div v-if="$slots.nested" class="min-w-0" @click.stop>
                <slot name="nested" />
              </div>
            </div>
          </div>
          <div
            v-if="selected && isDraft"
            draggable="false"
            class="pointer-events-auto mt-0.5 flex shrink-0 flex-row items-center gap-1.5"
            @click.stop
          >
            <Button
              type="button"
              variant="secondary"
              size="icon"
              class="size-8 shadow-sm"
              title="複製欄位"
              aria-label="複製欄位"
              :disabled="duplicateBusy"
              @click="emit('duplicate', props.field)"
            >
              <Copy class="size-4" />
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              class="size-8 shadow-sm"
              title="刪除欄位"
              aria-label="刪除欄位"
              @click="emit('delete-request', props.field)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
