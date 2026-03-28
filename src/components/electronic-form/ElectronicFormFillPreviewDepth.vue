<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { ElectronicFormFieldItem } from '@/api/electronic-form-definitions'
import {
  ELECTRONIC_FORM_FIELD_TYPE_LABELS,
  getElectronicFormColumnsCount,
  isElectronicFormFieldType,
} from '@/constants/electronic-form-field-contract'
import {
  electronicFormFillPreviewValuesKey,
  isFillPreviewFieldVisible,
  sortedChildrenInFillPreview,
} from '@/lib/electronic-form-fill-preview'
import ElectronicFormFillPreviewDepth from './ElectronicFormFillPreviewDepth.vue'
import {
  flattenSelectOptions,
  getSelectOptionsGrouped,
  isSelectMultipleConfig,
} from '@/lib/electronic-form-select-options'
import { ChevronsUpDown, Minus, Plus } from 'lucide-vue-next'

const props = defineProps<{
  field: ElectronicFormFieldItem
  allFields: ElectronicFormFieldItem[]
}>()

const valuesRef = inject(electronicFormFillPreviewValuesKey)
if (!valuesRef) {
  throw new Error('ElectronicFormFillPreviewDepth: missing provide(values)')
}

const visible = computed(() => isFillPreviewFieldVisible(props.field, valuesRef.value))

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
    .filter((x) => x.value.length > 0)
})

const selectGrouped = computed(() =>
  getSelectOptionsGrouped(props.field.config?.options)
)

const selectIsMultiple = computed(
  () =>
    props.field.fieldType === 'select' &&
    isSelectMultipleConfig(props.field.config as Record<string, unknown>)
)

const selectLabelByValue = computed(() => {
  const m = new Map<string, string>()
  for (const opt of flattenSelectOptions(props.field.config?.options)) {
    m.set(opt.value, opt.label)
  }
  return m
})

const selectMultiPopoverOpen = ref(false)

const selectMultiSummary = computed(() => {
  const v = valuesRef.value[props.field.fieldKey]
  if (!Array.isArray(v) || v.length === 0) return '請選擇'
  const labels = v
    .map((x) => selectLabelByValue.value.get(String(x)) ?? String(x))
    .filter(Boolean)
  return labels.length ? labels.join('、') : '請選擇'
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

const sectionChildren = computed(() => sortedChildrenInFillPreview(props.allFields, props.field.id, null))

const columnSlots = computed(() =>
  Array.from({ length: columnsCount.value }, (_, i) => i)
)

function childRows(slot: number) {
  return sortedChildrenInFillPreview(props.allFields, props.field.id, slot)
}

const valueModel = computed({
  get: () => {
    const v = valuesRef.value[props.field.fieldKey]
    return v == null ? '' : String(v)
  },
  set: (s: string) => {
    valuesRef.value[props.field.fieldKey] = s
  },
})

const selectedCheckboxes = computed({
  get: () => {
    const v = valuesRef.value[props.field.fieldKey]
    if (!Array.isArray(v)) return [] as string[]
    return v.map((x) => String(x))
  },
  set: (arr: string[]) => {
    valuesRef.value[props.field.fieldKey] = arr
  },
})

const selectMultiValues = computed({
  get: () => {
    const v = valuesRef.value[props.field.fieldKey]
    if (!Array.isArray(v)) return [] as string[]
    return v.map((x) => String(x))
  },
  set: (arr: string[]) => {
    valuesRef.value[props.field.fieldKey] = arr
  },
})

function toggleCheckboxOption(optValue: string, checked: boolean) {
  const s = new Set(selectedCheckboxes.value)
  if (checked) s.add(optValue)
  else s.delete(optValue)
  selectedCheckboxes.value = [...s]
}

function toggleSelectMultiOption(optValue: string, checked: boolean) {
  const s = new Set(selectMultiValues.value)
  if (checked) s.add(optValue)
  else s.delete(optValue)
  selectMultiValues.value = [...s]
}

function bumpNumber(delta: number) {
  const raw = valueModel.value.trim()
  const n = raw === '' ? 0 : Number(raw)
  const next = Number.isFinite(n) ? n + delta : delta
  valueModel.value = String(next)
}
</script>

<template>
  <div v-if="visible" class="min-w-0 space-y-3">
    <!-- 區塊（與正式填寫版面一致，無建構器提示） -->
    <template v-if="field.fieldType === 'section'">
      <div class="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3
          class="border-b border-border pb-3 text-lg font-semibold tracking-tight text-foreground whitespace-pre-wrap break-words"
        >
          {{ displayLabel }}
        </h3>
        <div class="mt-4 space-y-4">
          <ElectronicFormFillPreviewDepth
            v-for="c in sectionChildren"
            :key="c.id"
            :field="c"
            :all-fields="allFields"
          />
        </div>
      </div>
    </template>

    <!-- 多欄列：僅網格排版，不顯示「第 N 欄」等草稿用標籤 -->
    <template v-else-if="field.fieldType === 'columns'">
      <div class="grid min-w-0" :class="[columnsGapClass, columnsGridClass]">
        <div v-for="si in columnSlots" :key="si" class="min-w-0 space-y-4">
          <ElectronicFormFillPreviewDepth
            v-for="c in childRows(si)"
            :key="c.id"
            :field="c"
            :all-fields="allFields"
          />
        </div>
      </div>
    </template>

    <template v-else-if="field.fieldType === 'divider'">
      <div class="py-1">
        <div class="border-t border-border" role="separator" />
      </div>
    </template>

    <template v-else-if="field.fieldType === 'static_text'">
      <p class="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
        {{ staticContent }}
      </p>
    </template>

    <template v-else-if="field.fieldType === 'text'">
      <Label class="text-foreground whitespace-pre-wrap break-words" :for="`ef-fill-${field.id}`">
        {{ displayLabel }}
        <span v-if="field.required" class="text-destructive">*</span>
      </Label>
      <Input
        :id="`ef-fill-${field.id}`"
        v-model="valueModel"
        class="h-9"
        :placeholder="placeholderText"
      />
    </template>

    <template v-else-if="field.fieldType === 'textarea'">
      <Label class="text-foreground whitespace-pre-wrap break-words" :for="`ef-fill-${field.id}`">
        {{ displayLabel }}
        <span v-if="field.required" class="text-destructive">*</span>
      </Label>
      <textarea
        :id="`ef-fill-${field.id}`"
        v-model="valueModel"
        :placeholder="placeholderText"
        :rows="configRows"
        class="border-input bg-background flex min-h-[4rem] w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground"
      />
    </template>

    <template v-else-if="field.fieldType === 'number'">
      <Label class="text-foreground" :for="`ef-fill-${field.id}`">
        {{ displayLabel }}
        <span v-if="field.required" class="text-destructive">*</span>
      </Label>
      <div class="flex items-stretch gap-1">
        <Input
          :id="`ef-fill-${field.id}`"
          v-model="valueModel"
          type="text"
          inputmode="decimal"
          class="h-9 min-w-0 flex-1 tabular-nums"
          :placeholder="placeholderText"
        />
        <div class="flex shrink-0 flex-col gap-0.5">
          <Button type="button" variant="outline" size="icon" class="size-8" @click="bumpNumber(1)">
            <Plus class="size-3.5" />
          </Button>
          <Button type="button" variant="outline" size="icon" class="size-8" @click="bumpNumber(-1)">
            <Minus class="size-3.5" />
          </Button>
        </div>
      </div>
    </template>

    <template v-else-if="field.fieldType === 'currency'">
      <Label class="text-foreground" :for="`ef-fill-${field.id}`">
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
          :id="`ef-fill-${field.id}`"
          v-model="valueModel"
          type="text"
          inputmode="decimal"
          class="h-9 min-w-0 flex-1 tabular-nums"
          :placeholder="placeholderText"
        />
        <div class="flex shrink-0 flex-col gap-0.5">
          <Button type="button" variant="outline" size="icon" class="size-8" @click="bumpNumber(1)">
            <Plus class="size-3.5" />
          </Button>
          <Button type="button" variant="outline" size="icon" class="size-8" @click="bumpNumber(-1)">
            <Minus class="size-3.5" />
          </Button>
        </div>
      </div>
    </template>

    <template v-else-if="field.fieldType === 'date'">
      <Label class="text-foreground" :for="`ef-fill-${field.id}`">
        {{ displayLabel }}
        <span v-if="field.required" class="text-destructive">*</span>
      </Label>
      <Input :id="`ef-fill-${field.id}`" v-model="valueModel" type="date" class="h-9" />
    </template>

    <template v-else-if="field.fieldType === 'select'">
      <Label class="text-foreground">{{ displayLabel }}<span v-if="field.required" class="text-destructive">*</span></Label>
      <template v-if="selectIsMultiple">
        <Popover v-model:open="selectMultiPopoverOpen">
          <PopoverTrigger as-child>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              class="h-9 w-full justify-between border-input bg-background font-normal text-foreground"
            >
              <span class="truncate text-left text-muted-foreground">{{ selectMultiSummary }}</span>
              <ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-72 max-w-[calc(100vw-2rem)] p-2" align="start">
            <div class="max-h-64 space-y-3 overflow-y-auto">
              <template v-if="selectGrouped.length">
                <div v-for="(grp, gi) in selectGrouped" :key="gi" class="space-y-2">
                  <p
                    v-if="grp.label"
                    class="px-1 text-xs font-medium text-muted-foreground"
                  >
                    {{ grp.label }}
                  </p>
                  <div class="space-y-2">
                    <label
                      v-for="opt in grp.options"
                      :key="opt.value"
                      class="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm text-foreground hover:bg-muted/60"
                    >
                      <Checkbox
                        :checked="selectMultiValues.includes(opt.value)"
                        class="border-border"
                        @update:checked="(v) => toggleSelectMultiOption(opt.value, v === true)"
                      />
                      {{ opt.label }}
                    </label>
                  </div>
                </div>
              </template>
              <p v-else class="px-1 py-2 text-sm text-muted-foreground">（無選項）</p>
            </div>
          </PopoverContent>
        </Popover>
      </template>
      <div
        v-else-if="!selectGrouped.length"
        class="flex h-9 w-full items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground"
      >
        （無選項）
      </div>
      <Select v-else v-model="valueModel">
        <SelectTrigger class="h-9 w-full bg-background">
          <SelectValue
            :placeholder="
              flattenSelectOptions(field.config?.options).length ? '請選擇' : '（無選項）'
            "
          />
        </SelectTrigger>
        <SelectContent>
          <template v-for="(grp, gi) in selectGrouped" :key="gi">
            <SelectGroup v-if="grp.label">
              <SelectLabel>{{ grp.label }}</SelectLabel>
              <SelectItem v-for="opt in grp.options" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </SelectItem>
            </SelectGroup>
            <template v-else>
              <SelectItem v-for="opt in grp.options" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </SelectItem>
            </template>
          </template>
        </SelectContent>
      </Select>
    </template>

    <template v-else-if="field.fieldType === 'radio'">
      <Label class="text-foreground">{{ displayLabel }}<span v-if="field.required" class="text-destructive">*</span></Label>
      <div class="space-y-2">
        <label
          v-for="opt in choiceOptions.length ? choiceOptions : [{ value: 'x', label: '選項' }]"
          :key="opt.value"
          class="flex cursor-pointer items-center gap-2 text-sm text-foreground"
        >
          <input
            v-model="valueModel"
            type="radio"
            class="size-4 shrink-0 accent-primary"
            :value="opt.value"
            :name="`ef-fill-radio-${field.id}`"
          />
          {{ opt.label }}
        </label>
      </div>
    </template>

    <template v-else-if="field.fieldType === 'checkbox_group'">
      <Label class="text-foreground">{{ displayLabel }}<span v-if="field.required" class="text-destructive">*</span></Label>
      <div class="space-y-2">
        <label
          v-for="opt in choiceOptions.length ? choiceOptions : [{ value: 'x', label: '選項' }]"
          :key="opt.value"
          class="flex cursor-pointer items-center gap-2 text-sm text-foreground"
        >
          <Checkbox
            :checked="selectedCheckboxes.includes(opt.value)"
            class="border-border"
            @update:checked="(v) => toggleCheckboxOption(opt.value, v === true)"
          />
          {{ opt.label }}
        </label>
      </div>
    </template>

    <template v-else>
      <p class="text-sm text-muted-foreground">
        不支援預覽的欄位類型：<span class="font-mono text-foreground">{{ field.fieldType }}</span>
      </p>
    </template>
  </div>
</template>
