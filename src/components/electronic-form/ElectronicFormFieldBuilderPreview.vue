<script setup lang="ts">
import { computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  ELECTRONIC_FORM_FIELD_TYPE_LABELS,
  getElectronicFormColumnsCount,
  isElectronicFormFieldType,
} from '@/constants/electronic-form-field-contract'
import type { ElectronicFormFieldItem } from '@/api/electronic-form-definitions'
import { ChevronsUpDown, Minus, Plus } from 'lucide-vue-next'

const props = defineProps<{
  field: ElectronicFormFieldItem
  /** Builder 畫布：容器內嵌子欄位時不畫假欄槽，改由外層巢狀區塊呈現 */
  builderShell?: boolean
  /** 畫布卡片上已由外層與類型 Badge 並排顯示標題時，隱藏內建 Label 列 */
  omitLeadingFieldLabel?: boolean
  /** 畫布上已並排顯示區塊標題時，隱藏區塊頂部標題列 */
  omitSectionTitle?: boolean
}>()

const displayLabel = computed(() => {
  const t = props.field.fieldType
  if (isElectronicFormFieldType(t)) {
    return props.field.label?.trim() || ELECTRONIC_FORM_FIELD_TYPE_LABELS[t]
  }
  return props.field.label?.trim() || props.field.fieldType
})

const placeholderText = computed(() => props.field.placeholder?.trim() || '請輸入')

const configRows = computed(() => {
  const r = props.field.config?.rows
  return typeof r === 'number' && r > 0 ? r : 4
})

const currencyCode = computed(() => {
  const c = props.field.config?.currencyCode
  return typeof c === 'string' && c ? c : 'TWD'
})

type OptionRow = { value: string; label: string }

const choiceOptions = computed<OptionRow[]>(() => {
  const raw = props.field.config?.options
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object')
    .map((x) => ({
      value: String(x.value ?? ''),
      label: String(x.label ?? x.value ?? ''),
    }))
})

const staticContent = computed(() => {
  const c = props.field.config?.content
  return typeof c === 'string' ? c : '說明文字'
})

const columnsCount = computed(() =>
  getElectronicFormColumnsCount(props.field.config as Record<string, unknown>)
)

const columnsGridClass = computed(() =>
  columnsCount.value === 3 ? 'grid-cols-3' : 'grid-cols-2'
)

const columnsGapClass = computed(() => {
  const g = props.field.config?.gap
  if (g === 'sm') return 'gap-2'
  if (g === 'lg') return 'gap-4'
  return 'gap-3'
})

const inputShellClass =
  'pointer-events-none cursor-inherit select-none bg-background text-muted-foreground'
</script>

<template>
  <div class="min-w-0 space-y-1.5">
    <!-- 區塊 -->
    <template v-if="field.fieldType === 'section'">
      <div
        v-if="!props.omitSectionTitle"
        class="border-b border-border pb-2 text-base font-semibold text-foreground whitespace-pre-wrap break-words"
      >
        {{ displayLabel }}
      </div>
    </template>

    <!-- 多欄列（欄數由 config.columns 決定） -->
    <template v-else-if="field.fieldType === 'columns'">
      <template v-if="props.builderShell">
        <p class="text-xs text-muted-foreground">
          將欄位拖入下方各欄槽（與此列同一區塊內）。
        </p>
      </template>
      <template v-else>
        <div
          class="grid rounded-md border border-dashed border-border bg-muted/20 p-3"
          :class="[columnsGapClass, columnsGridClass]"
        >
          <div
            v-for="n in columnsCount"
            :key="n"
            class="flex min-h-14 items-center justify-center rounded-md border border-border/70 bg-background/80 text-xs text-muted-foreground"
          >
            第 {{ n }} 欄
          </div>
        </div>
        <p class="text-xs text-muted-foreground">將欄位拖入各欄槽以排版（僅限此列底下的子欄位）。</p>
      </template>
    </template>

    <!-- 分隔線 -->
    <template v-else-if="field.fieldType === 'divider'">
      <div class="py-1">
        <div class="border-t border-border" role="separator" />
      </div>
    </template>

    <!-- 說明文字 -->
    <template v-else-if="field.fieldType === 'static_text'">
      <p class="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
        {{ staticContent }}
      </p>
    </template>

    <!-- 單行文字 -->
    <template v-else-if="field.fieldType === 'text'">
      <Label v-if="!props.omitLeadingFieldLabel" class="text-foreground whitespace-pre-wrap break-words">
        {{ displayLabel }}
        <span v-if="field.required" class="text-destructive">*</span>
      </Label>
      <Input
        :model-value="''"
        :placeholder="placeholderText"
        :readonly="true"
        tabindex="-1"
        class="h-9"
        :class="inputShellClass"
      />
    </template>

    <!-- 多行 -->
    <template v-else-if="field.fieldType === 'textarea'">
      <Label v-if="!props.omitLeadingFieldLabel" class="text-foreground whitespace-pre-wrap break-words">
        {{ displayLabel }}
        <span v-if="field.required" class="text-destructive">*</span>
      </Label>
      <textarea
        :value="''"
        :placeholder="placeholderText"
        :rows="configRows"
        readonly
        tabindex="-1"
        class="border-input bg-background flex min-h-[4rem] w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground"
        :class="inputShellClass"
      />
    </template>

    <!-- 數字（含假 stepper） -->
    <template v-else-if="field.fieldType === 'number'">
      <Label v-if="!props.omitLeadingFieldLabel" class="text-foreground">
        {{ displayLabel }}
        <span v-if="field.required" class="text-destructive">*</span>
      </Label>
      <div class="flex items-stretch gap-1">
        <Input
          :model-value="''"
          :placeholder="placeholderText"
          :readonly="true"
          tabindex="-1"
          class="h-9 min-w-0 flex-1 tabular-nums"
          :class="inputShellClass"
        />
        <div class="flex shrink-0 flex-col gap-0.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            class="size-8"
            disabled
            aria-hidden="true"
            tabindex="-1"
          >
            <Plus class="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            class="size-8"
            disabled
            aria-hidden="true"
            tabindex="-1"
          >
            <Minus class="size-3.5" />
          </Button>
        </div>
      </div>
    </template>

    <!-- 金額 -->
    <template v-else-if="field.fieldType === 'currency'">
      <Label v-if="!props.omitLeadingFieldLabel" class="text-foreground">
        {{ displayLabel }}
        <span v-if="field.required" class="text-destructive">*</span>
      </Label>
      <div class="flex items-stretch gap-1">
        <span
          class="inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-muted/40 px-2 text-xs text-muted-foreground"
        >
          {{ currencyCode }}
        </span>
        <Input
          :model-value="''"
          :placeholder="placeholderText"
          :readonly="true"
          tabindex="-1"
          class="h-9 min-w-0 flex-1 tabular-nums"
          :class="inputShellClass"
        />
        <div class="flex shrink-0 flex-col gap-0.5">
          <Button type="button" variant="outline" size="icon" class="size-8" disabled tabindex="-1">
            <Plus class="size-3.5" />
          </Button>
          <Button type="button" variant="outline" size="icon" class="size-8" disabled tabindex="-1">
            <Minus class="size-3.5" />
          </Button>
        </div>
      </div>
    </template>

    <!-- 日期 -->
    <template v-else-if="field.fieldType === 'date'">
      <Label v-if="!props.omitLeadingFieldLabel" class="text-foreground">
        {{ displayLabel }}
        <span v-if="field.required" class="text-destructive">*</span>
      </Label>
      <Input
        :model-value="''"
        placeholder="年 / 月 / 日"
        :readonly="true"
        tabindex="-1"
        class="h-9"
        :class="inputShellClass"
      />
    </template>

    <!-- 下拉（畫布預覽維持簡化；pointer-events-none 讓拖曳由外層列接手） -->
    <template v-else-if="field.fieldType === 'select'">
      <Label v-if="!props.omitLeadingFieldLabel" class="text-foreground">
        {{ displayLabel }}
        <span v-if="field.required" class="text-destructive">*</span>
      </Label>
      <div
        class="pointer-events-none flex h-9 w-full cursor-inherit select-none items-center justify-between rounded-md border border-input bg-background px-3 text-sm text-muted-foreground shadow-xs"
      >
        <span class="truncate">{{ choiceOptions[0]?.label ?? '請選擇' }}</span>
        <ChevronsUpDown class="size-4 shrink-0 opacity-50" aria-hidden="true" />
      </div>
    </template>

    <!-- 單選 -->
    <template v-else-if="field.fieldType === 'radio'">
      <Label v-if="!props.omitLeadingFieldLabel" class="text-foreground">
        {{ displayLabel }}
        <span v-if="field.required" class="text-destructive">*</span>
      </Label>
      <div class="space-y-2">
        <label
          v-for="opt in choiceOptions.length ? choiceOptions : [{ value: 'x', label: '選項' }]"
          :key="opt.value"
          class="flex cursor-inherit items-center gap-2 text-sm text-foreground"
        >
          <span
            class="size-4 shrink-0 rounded-full border border-border bg-background ring-offset-background"
            aria-hidden="true"
          />
          {{ opt.label }}
        </label>
      </div>
    </template>

    <!-- 多選 -->
    <template v-else-if="field.fieldType === 'checkbox_group'">
      <Label v-if="!props.omitLeadingFieldLabel" class="text-foreground">
        {{ displayLabel }}
        <span v-if="field.required" class="text-destructive">*</span>
      </Label>
      <div class="space-y-2">
        <label
          v-for="opt in choiceOptions.length ? choiceOptions : [{ value: 'x', label: '選項' }]"
          :key="opt.value"
          class="flex cursor-inherit items-center gap-2 text-sm text-foreground"
        >
          <span
            class="size-4 shrink-0 rounded border border-border bg-background"
            aria-hidden="true"
          />
          {{ opt.label }}
        </label>
      </div>
    </template>

    <!-- 未知類型 -->
    <template v-else>
      <p class="text-sm text-muted-foreground">
        不支援預覽的欄位類型：<span class="font-mono text-foreground">{{ field.fieldType }}</span>
      </p>
    </template>

  </div>
</template>
