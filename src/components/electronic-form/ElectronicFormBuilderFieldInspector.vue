<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { ElectronicFormFieldItem } from '@/api/electronic-form-definitions'
import {
  ELECTRONIC_FORM_FIELD_TYPES_WITHOUT_DATA_KEY,
  getElectronicFormColumnsCount,
  isElectronicFormFieldType,
  type ElectronicFormFieldType,
} from '@/constants/electronic-form-field-contract'
import { randomClientId, randomHexToken } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-vue-next'

export type ElectronicFormInspectorApplyPayload = {
  fieldId: string
  fieldKey: string
  label: string | null
  placeholder: string | null
  required: boolean
  config: Record<string, unknown>
}

/** 即時畫布預覽用（不寫入 API，條件未填齊時會略過 showWhen） */
export type ElectronicFormInspectorPreviewPayload = {
  fieldKey: string
  label: string | null
  placeholder: string | null
  required: boolean
  config: Record<string, unknown>
}

const props = defineProps<{
  field: ElectronicFormFieldItem
  isDraft: boolean
  allFields: ElectronicFormFieldItem[]
  busy: boolean
}>()

const emit = defineEmits<{
  apply: [payload: ElectronicFormInspectorApplyPayload]
  'preview-change': [payload: ElectronicFormInspectorPreviewPayload]
  'delete-request': []
}>()

const SHOW_WHEN_OPERATORS = [
  { value: 'equals', label: '等於' },
  { value: 'notEquals', label: '不等於' },
  { value: 'in', label: '屬於清單' },
  { value: 'notIn', label: '不屬於清單' },
  { value: 'isEmpty', label: '為空' },
  { value: 'isNotEmpty', label: '不為空' },
] as const

const SHOW_WHEN_REF_TYPES: ReadonlySet<ElectronicFormFieldType> = new Set([
  'text',
  'textarea',
  'number',
  'currency',
  'date',
  'select',
  'radio',
  'checkbox_group',
])

type ChoiceRow = { value: string; label: string }

type SelectInnerRow = { id: string; value: string; label: string }

type SelectBlock =
  | { id: string; type: 'option'; value: string; label: string }
  | { id: string; type: 'group'; title: string; items: SelectInnerRow[] }

function generateUniqueOptionValue(used: Set<string>): string {
  for (let attempt = 0; attempt < 32; attempt++) {
    const v = `opt_${randomHexToken(12)}`
    if (!used.has(v)) {
      used.add(v)
      return v
    }
  }
  const v = `opt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  used.add(v)
  return v
}

/** 每列具唯一、非空 value；沿用既有合法 value，缺漏或重複則自動補 */
function ensureChoiceValuesUnique(rows: ChoiceRow[]): ChoiceRow[] {
  const used = new Set<string>()
  const result: ChoiceRow[] = []
  for (const r of rows) {
    let v = r.value.trim()
    if (!v || used.has(v)) {
      v = generateUniqueOptionValue(used)
    } else {
      used.add(v)
    }
    result.push({ value: v, label: r.label })
  }
  return result
}

function ensureSelectBlockValuesUnique(blocks: SelectBlock[]): SelectBlock[] {
  const used = new Set<string>()
  const fix = (v: string): string => {
    let x = v.trim()
    if (!x || used.has(x)) {
      x = generateUniqueOptionValue(used)
    } else {
      used.add(x)
    }
    return x
  }
  return blocks.map((b) => {
    if (b.type === 'option') {
      return { ...b, value: fix(b.value), label: b.label }
    }
    return {
      ...b,
      items: b.items.map((it) => ({ ...it, value: fix(it.value), label: it.label })),
    }
  })
}

function parseSelectBlocksFromConfig(cfg: Record<string, unknown>): SelectBlock[] {
  const raw = cfg.options
  if (!Array.isArray(raw) || raw.length === 0) {
    const used = new Set<string>()
    return [
      {
        id: randomClientId(),
        type: 'option',
        value: generateUniqueOptionValue(used),
        label: '選項 A',
      },
      {
        id: randomClientId(),
        type: 'option',
        value: generateUniqueOptionValue(used),
        label: '選項 B',
      },
    ]
  }
  const blocks: SelectBlock[] = []
  for (const el of raw) {
    if (el === null || typeof el !== 'object') continue
    const o = el as Record<string, unknown>
    if (o.type === 'group' && Array.isArray(o.options)) {
      const used = new Set<string>()
      const items: SelectInnerRow[] = (o.options as unknown[])
        .filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object')
        .map((x) => ({
          id: randomClientId(),
          value: String(x.value ?? ''),
          label: String(x.label ?? x.value ?? ''),
        }))
      blocks.push({
        id: randomClientId(),
        type: 'group',
        title: String(o.label ?? ''),
        items:
          items.length > 0
            ? items
            : [{ id: randomClientId(), value: generateUniqueOptionValue(used), label: '' }],
      })
    } else if ('value' in o) {
      blocks.push({
        id: randomClientId(),
        type: 'option',
        value: String(o.value ?? ''),
        label: String(o.label ?? o.value ?? ''),
      })
    }
  }
  if (blocks.length < 1) {
    return parseSelectBlocksFromConfig({})
  }
  return ensureSelectBlockValuesUnique(blocks)
}

function serializeSelectBlocks(blocks: SelectBlock[]): unknown[] {
  const normalized = ensureSelectBlockValuesUnique(blocks)
  const out: unknown[] = []
  for (const b of normalized) {
    if (b.type === 'option') {
      const label = b.label.trim()
      if (!label) continue
      out.push({ value: b.value.trim(), label })
    } else {
      const title = b.title.trim()
      const opts = b.items
        .map((it) => ({
          value: it.value.trim(),
          label: it.label.trim(),
        }))
        .filter((it) => it.label.length > 0 && it.value.length > 0)
      if (opts.length < 1) continue
      out.push({
        type: 'group',
        label: title.length > 0 ? title : '群組',
        options: opts,
      })
    }
  }
  return out
}

const selectModeStr = computed({
  get: () => (selectMultiple.value ? 'multiple' : 'single'),
  set: (v: string) => {
    selectMultiple.value = v === 'multiple'
  },
})

const localError = ref('')
const inspectorTab = ref('basic')

const fieldKeyLocal = ref('')
const labelLocal = ref('')
const placeholderLocal = ref('')
const requiredLocal = ref(false)
const columnsCountStr = ref<'2' | '3'>('2')

const choiceOptions = ref<ChoiceRow[]>([])

const selectMultiple = ref(false)
const selectBlocks = ref<SelectBlock[]>([])

const staticContent = ref('')
const staticVariantStr = ref<'default' | 'muted'>('default')
const sectionCollapsible = ref(false)
const dividerSpacingStr = ref<'sm' | 'md' | 'lg'>('md')

const textMaxLength = ref('')
const textInputModeStr = ref<'text' | 'email' | 'tel' | 'url'>('text')
const textareaMaxLength = ref('')
const textareaRows = ref('')

const numberMin = ref('')
const numberMax = ref('')
const numberStep = ref('')

const currencyDecimals = ref('')
const currencyCode = ref('')

const dateMin = ref('')
const dateMax = ref('')

const showWhenEnabled = ref(false)
const showWhenFieldKey = ref('')
const showWhenOperatorStr = ref<(typeof SHOW_WHEN_OPERATORS)[number]['value']>('equals')
const showWhenValueStr = ref('')

const conditionReferenceFields = computed(() =>
  props.allFields.filter(
    (f) =>
      f.id !== props.field.id &&
      isElectronicFormFieldType(f.fieldType) &&
      SHOW_WHEN_REF_TYPES.has(f.fieldType)
  )
)

/** 單選／多選（非下拉）：扁平 options 編輯器 */
const isFlatChoiceField = computed(() =>
  ['radio', 'checkbox_group'].includes(props.field.fieldType)
)

const isSelectField = computed(() => props.field.fieldType === 'select')

const hasDataKey = computed(
  () =>
    isElectronicFormFieldType(props.field.fieldType) &&
    !ELECTRONIC_FORM_FIELD_TYPES_WITHOUT_DATA_KEY.has(props.field.fieldType)
)

function parseOptionsFromConfig(cfg: Record<string, unknown>): ChoiceRow[] {
  const raw = cfg.options
  if (!Array.isArray(raw) || raw.length === 0) {
    const used = new Set<string>()
    return [
      { value: generateUniqueOptionValue(used), label: '選項 A' },
      { value: generateUniqueOptionValue(used), label: '選項 B' },
    ]
  }
  const parsed = raw
    .filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object')
    .map((x) => ({
      value: String(x.value ?? ''),
      label: String(x.label ?? x.value ?? ''),
    }))
  return ensureChoiceValuesUnique(parsed)
}

function optPositiveInt(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t)
  if (!Number.isFinite(n)) return undefined
  const i = Math.trunc(n)
  return i >= 1 ? i : undefined
}

function optNumber(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

function optNonNegInt(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t)
  if (!Number.isFinite(n)) return undefined
  const i = Math.trunc(n)
  return i >= 0 ? i : undefined
}

function hydrate() {
  localError.value = ''
  const f = props.field
  const cfg = (f.config ?? {}) as Record<string, unknown>

  fieldKeyLocal.value = f.fieldKey
  labelLocal.value = f.label ?? ''
  placeholderLocal.value = f.placeholder ?? ''
  requiredLocal.value = f.required

  columnsCountStr.value = getElectronicFormColumnsCount(cfg) === 3 ? '3' : '2'

  if (f.fieldType === 'select') {
    selectBlocks.value = parseSelectBlocksFromConfig(cfg)
    selectMultiple.value = cfg.multiple === true
    choiceOptions.value = []
  } else {
    choiceOptions.value = parseOptionsFromConfig(cfg)
    selectBlocks.value = []
    selectMultiple.value = false
  }

  staticContent.value = typeof cfg.content === 'string' ? cfg.content : '說明文字'
  staticVariantStr.value = cfg.variant === 'muted' ? 'muted' : 'default'
  sectionCollapsible.value = cfg.collapsible === true
  dividerSpacingStr.value =
    cfg.spacing === 'sm' || cfg.spacing === 'lg' ? cfg.spacing : 'md'

  textMaxLength.value =
    typeof cfg.maxLength === 'number' && cfg.maxLength > 0 ? String(cfg.maxLength) : ''
  const im = cfg.inputMode
  textInputModeStr.value =
    im === 'email' || im === 'tel' || im === 'url' ? im : 'text'

  textareaMaxLength.value =
    typeof cfg.maxLength === 'number' && cfg.maxLength > 0 ? String(cfg.maxLength) : ''
  textareaRows.value = typeof cfg.rows === 'number' && cfg.rows > 0 ? String(cfg.rows) : ''

  numberMin.value = typeof cfg.min === 'number' ? String(cfg.min) : ''
  numberMax.value = typeof cfg.max === 'number' ? String(cfg.max) : ''
  numberStep.value = typeof cfg.step === 'number' ? String(cfg.step) : ''

  currencyDecimals.value =
    typeof cfg.decimals === 'number' && cfg.decimals >= 0 ? String(cfg.decimals) : ''
  currencyCode.value = typeof cfg.currencyCode === 'string' ? cfg.currencyCode : 'TWD'

  dateMin.value = typeof cfg.minDate === 'string' ? cfg.minDate : ''
  dateMax.value = typeof cfg.maxDate === 'string' ? cfg.maxDate : ''

  const sw = cfg.showWhen
  if (sw && typeof sw === 'object' && !Array.isArray(sw)) {
    const o = sw as Record<string, unknown>
    const op = o.operator
    showWhenEnabled.value = true
    showWhenFieldKey.value = typeof o.fieldKey === 'string' ? o.fieldKey : ''
    showWhenOperatorStr.value = SHOW_WHEN_OPERATORS.some((x) => x.value === op)
      ? (op as (typeof SHOW_WHEN_OPERATORS)[number]['value'])
      : 'equals'
    const v = o.value
    if (Array.isArray(v)) {
      showWhenValueStr.value = v.map((x) => String(x)).join(', ')
    } else if (v != null && typeof v !== 'object') {
      showWhenValueStr.value = String(v)
    } else {
      showWhenValueStr.value = ''
    }
  } else {
    showWhenEnabled.value = false
    showWhenFieldKey.value = ''
    showWhenOperatorStr.value = 'equals'
    showWhenValueStr.value = ''
  }
}

function addChoiceRow() {
  const used = new Set<string>()
  for (const r of choiceOptions.value) {
    const v = r.value.trim()
    if (v) used.add(v)
  }
  const value = generateUniqueOptionValue(used)
  choiceOptions.value = [...choiceOptions.value, { value, label: '' }]
}

function removeChoiceRow(i: number) {
  choiceOptions.value = choiceOptions.value.filter((_, idx) => idx !== i)
}

function collectUsedValuesFromSelectBlocks(blocks: SelectBlock[]): Set<string> {
  const used = new Set<string>()
  for (const b of blocks) {
    if (b.type === 'option') {
      const v = b.value.trim()
      if (v) used.add(v)
    } else {
      for (const it of b.items) {
        const v = it.value.trim()
        if (v) used.add(v)
      }
    }
  }
  return used
}

function addSelectOptionBlock() {
  const used = collectUsedValuesFromSelectBlocks(selectBlocks.value)
  const value = generateUniqueOptionValue(used)
  selectBlocks.value = [
    ...selectBlocks.value,
    { id: randomClientId(), type: 'option', value, label: '' },
  ]
}

function addSelectGroupBlock() {
  const used = collectUsedValuesFromSelectBlocks(selectBlocks.value)
  const v1 = generateUniqueOptionValue(used)
  const v2 = generateUniqueOptionValue(used)
  selectBlocks.value = [
    ...selectBlocks.value,
    {
      id: randomClientId(),
      type: 'group',
      title: '',
      items: [
        { id: randomClientId(), value: v1, label: '' },
        { id: randomClientId(), value: v2, label: '' },
      ],
    },
  ]
}

function removeSelectBlock(i: number) {
  selectBlocks.value = selectBlocks.value.filter((_, idx) => idx !== i)
}

function addSelectGroupItem(blockIdx: number) {
  const b = selectBlocks.value[blockIdx]
  if (!b || b.type !== 'group') return
  const used = collectUsedValuesFromSelectBlocks(selectBlocks.value)
  const value = generateUniqueOptionValue(used)
  const items = [...b.items, { id: randomClientId(), value, label: '' }]
  const next = [...selectBlocks.value]
  next[blockIdx] = { ...b, items }
  selectBlocks.value = next
}

function removeSelectGroupItem(blockIdx: number, itemIdx: number) {
  const b = selectBlocks.value[blockIdx]
  if (!b || b.type !== 'group') return
  if (b.items.length <= 1) return
  const items = b.items.filter((_, idx) => idx !== itemIdx)
  const next = [...selectBlocks.value]
  next[blockIdx] = { ...b, items }
  selectBlocks.value = next
}

function valueNeedsShowWhenInput(): boolean {
  return showWhenOperatorStr.value !== 'isEmpty' && showWhenOperatorStr.value !== 'isNotEmpty'
}

/** 預覽用：條件不完整時不寫入 showWhen，不設 localError */
function applyShowWhenPreview(target: Record<string, unknown>) {
  if (!showWhenEnabled.value) {
    delete target.showWhen
    return
  }
  if (!showWhenFieldKey.value.trim()) {
    delete target.showWhen
    return
  }
  const op = showWhenOperatorStr.value
  const row: Record<string, unknown> = {
    fieldKey: showWhenFieldKey.value.trim(),
    operator: op,
  }
  if (op === 'in' || op === 'notIn') {
    const parts = showWhenValueStr.value
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length < 1) {
      delete target.showWhen
      return
    }
    row.value = parts
  } else if (op !== 'isEmpty' && op !== 'isNotEmpty') {
    const v = showWhenValueStr.value.trim()
    if (!v) {
      delete target.showWhen
      return
    }
    row.value = v
  }
  target.showWhen = row
}

function applyShowWhen(target: Record<string, unknown>): boolean {
  if (!showWhenEnabled.value) {
    delete target.showWhen
    return true
  }
  if (!showWhenFieldKey.value.trim()) {
    localError.value = '條件：請選擇或填寫依據欄位。'
    return false
  }
  const op = showWhenOperatorStr.value
  const row: Record<string, unknown> = {
    fieldKey: showWhenFieldKey.value.trim(),
    operator: op,
  }
  if (op === 'in' || op === 'notIn') {
    const parts = showWhenValueStr.value
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length < 1) {
      localError.value = '條件：清單運算請至少填寫一個值（可用逗號分隔）。'
      return false
    }
    row.value = parts
  } else if (op !== 'isEmpty' && op !== 'isNotEmpty') {
    const v = showWhenValueStr.value.trim()
    if (!v) {
      localError.value = '條件：請填寫比對值。'
      return false
    }
    row.value = v
  }
  target.showWhen = row
  return true
}

function buildConfig(): Record<string, unknown> | null {
  const f = props.field
  const base = { ...(f.config as Record<string, unknown> | undefined) } as Record<string, unknown>
  const t = f.fieldType

  if (t === 'columns') {
    const next: Record<string, unknown> = {
      columns: columnsCountStr.value === '3' ? 3 : 2,
    }
    if (base.gap === 'sm' || base.gap === 'md' || base.gap === 'lg') {
      next.gap = base.gap
    }
    return next
  }

  if (t === 'divider') {
    return { spacing: dividerSpacingStr.value }
  }

  if (t === 'section') {
    const next: Record<string, unknown> = { ...base }
    if (sectionCollapsible.value) next.collapsible = true
    else delete next.collapsible
    if (!applyShowWhen(next)) return null
    return next
  }

  if (t === 'static_text') {
    const next: Record<string, unknown> = {
      ...base,
      content: staticContent.value.trim() || '說明文字',
      variant: staticVariantStr.value,
    }
    if (!applyShowWhen(next)) return null
    return next
  }

  if (t === 'select') {
    const serialized = serializeSelectBlocks(selectBlocks.value)
    if (serialized.length < 1) {
      localError.value = '請至少保留一筆有效的選項（顯示文字為必填）。'
      return null
    }
    const next: Record<string, unknown> = { ...base, options: serialized }
    if (selectMultiple.value) next.multiple = true
    else delete next.multiple
    if (!applyShowWhen(next)) return null
    return next
  }

  if (isFlatChoiceField.value) {
    const normalized = ensureChoiceValuesUnique(choiceOptions.value)
    const cleaned = normalized
      .map((r) => ({
        value: r.value.trim(),
        label: r.label.trim(),
      }))
      .filter((r) => r.label.length > 0)
    if (cleaned.length < 1) {
      localError.value = '請至少保留一筆有效的選項（顯示文字為必填）。'
      return null
    }
    const next: Record<string, unknown> = { ...base, options: cleaned }
    if (!applyShowWhen(next)) return null
    return next
  }

  if (t === 'text') {
    const next: Record<string, unknown> = { ...base }
    const ml = optPositiveInt(textMaxLength.value)
    if (ml !== undefined) next.maxLength = ml
    else delete next.maxLength
    next.inputMode = textInputModeStr.value
    if (!applyShowWhen(next)) return null
    return next
  }

  if (t === 'textarea') {
    const next: Record<string, unknown> = { ...base }
    const ml = optPositiveInt(textareaMaxLength.value)
    if (ml !== undefined) next.maxLength = ml
    else delete next.maxLength
    const rows = optPositiveInt(textareaRows.value)
    if (rows !== undefined) next.rows = rows
    else delete next.rows
    if (!applyShowWhen(next)) return null
    return next
  }

  if (t === 'number') {
    const next: Record<string, unknown> = { ...base }
    const mn = optNumber(numberMin.value)
    const mx = optNumber(numberMax.value)
    const st = optNumber(numberStep.value)
    if (mn !== undefined) next.min = mn
    else delete next.min
    if (mx !== undefined) next.max = mx
    else delete next.max
    if (st !== undefined && st > 0) next.step = st
    else delete next.step
    if (!applyShowWhen(next)) return null
    return next
  }

  if (t === 'currency') {
    const next: Record<string, unknown> = { ...base }
    const d = optNonNegInt(currencyDecimals.value)
    if (d !== undefined) next.decimals = d
    else delete next.decimals
    const code = currencyCode.value.trim().toUpperCase()
    if (code.length === 3) next.currencyCode = code
    else delete next.currencyCode
    if (!applyShowWhen(next)) return null
    return next
  }

  if (t === 'date') {
    const next: Record<string, unknown> = { ...base }
    const minD = dateMin.value.trim()
    const maxD = dateMax.value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(minD)) next.minDate = minD
    else delete next.minDate
    if (/^\d{4}-\d{2}-\d{2}$/.test(maxD)) next.maxDate = maxD
    else delete next.maxDate
    if (!applyShowWhen(next)) return null
    return next
  }

  const next: Record<string, unknown> = { ...base }
  if (!applyShowWhen(next)) return null
  return next
}

function choiceOptionsForPreview(): { value: string; label: string }[] {
  const normalized = ensureChoiceValuesUnique(choiceOptions.value)
  const cleaned = normalized
    .map((r) => ({
      value: r.value.trim(),
      label: (r.label.trim() || '（未命名）').trim() || ' ',
    }))
    .filter((r) => r.value.length > 0)
  if (cleaned.length < 1) {
    return [{ value: '_', label: '（請新增選項）' }]
  }
  return cleaned
}

function selectOptionsForPreview(): unknown[] {
  const serialized = serializeSelectBlocks(selectBlocks.value)
  if (serialized.length < 1) {
    return [{ value: '_', label: '（請新增選項）' }]
  }
  return serialized
}

/** 畫布即時預覽：不驗證儲存規則、不寫 localError */
function buildPreviewConfig(): Record<string, unknown> {
  const f = props.field
  const base = { ...(f.config as Record<string, unknown> | undefined) } as Record<string, unknown>
  const t = f.fieldType

  if (t === 'columns') {
    const next: Record<string, unknown> = {
      columns: columnsCountStr.value === '3' ? 3 : 2,
    }
    if (base.gap === 'sm' || base.gap === 'md' || base.gap === 'lg') {
      next.gap = base.gap
    }
    return next
  }

  if (t === 'divider') {
    return { spacing: dividerSpacingStr.value }
  }

  if (t === 'section') {
    const next: Record<string, unknown> = { ...base }
    if (sectionCollapsible.value) next.collapsible = true
    else delete next.collapsible
    applyShowWhenPreview(next)
    return next
  }

  if (t === 'static_text') {
    const next: Record<string, unknown> = {
      ...base,
      content: staticContent.value.trim() || '說明文字',
      variant: staticVariantStr.value,
    }
    applyShowWhenPreview(next)
    return next
  }

  if (t === 'select') {
    const next: Record<string, unknown> = { ...base, options: selectOptionsForPreview() }
    if (selectMultiple.value) next.multiple = true
    else delete next.multiple
    applyShowWhenPreview(next)
    return next
  }

  if (isFlatChoiceField.value) {
    const next: Record<string, unknown> = { ...base, options: choiceOptionsForPreview() }
    applyShowWhenPreview(next)
    return next
  }

  if (t === 'text') {
    const next: Record<string, unknown> = { ...base }
    const ml = optPositiveInt(textMaxLength.value)
    if (ml !== undefined) next.maxLength = ml
    else delete next.maxLength
    next.inputMode = textInputModeStr.value
    applyShowWhenPreview(next)
    return next
  }

  if (t === 'textarea') {
    const next: Record<string, unknown> = { ...base }
    const ml = optPositiveInt(textareaMaxLength.value)
    if (ml !== undefined) next.maxLength = ml
    else delete next.maxLength
    const rows = optPositiveInt(textareaRows.value)
    if (rows !== undefined) next.rows = rows
    else delete next.rows
    applyShowWhenPreview(next)
    return next
  }

  if (t === 'number') {
    const next: Record<string, unknown> = { ...base }
    const mn = optNumber(numberMin.value)
    const mx = optNumber(numberMax.value)
    const st = optNumber(numberStep.value)
    if (mn !== undefined) next.min = mn
    else delete next.min
    if (mx !== undefined) next.max = mx
    else delete next.max
    if (st !== undefined && st > 0) next.step = st
    else delete next.step
    applyShowWhenPreview(next)
    return next
  }

  if (t === 'currency') {
    const next: Record<string, unknown> = { ...base }
    const d = optNonNegInt(currencyDecimals.value)
    if (d !== undefined) next.decimals = d
    else delete next.decimals
    const code = currencyCode.value.trim().toUpperCase()
    if (code.length === 3) next.currencyCode = code
    else delete next.currencyCode
    applyShowWhenPreview(next)
    return next
  }

  if (t === 'date') {
    const next: Record<string, unknown> = { ...base }
    const minD = dateMin.value.trim()
    const maxD = dateMax.value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(minD)) next.minDate = minD
    else delete next.minDate
    if (/^\d{4}-\d{2}-\d{2}$/.test(maxD)) next.maxDate = maxD
    else delete next.maxDate
    applyShowWhenPreview(next)
    return next
  }

  const next: Record<string, unknown> = { ...base }
  applyShowWhenPreview(next)
  return next
}

function emitPreviewChange() {
  const fk = fieldKeyLocal.value.trim() || props.field.fieldKey
  emit('preview-change', {
    fieldKey: fk,
    label: labelLocal.value.trim() || null,
    placeholder: placeholderLocal.value.trim() || null,
    required: requiredLocal.value,
    config: buildPreviewConfig(),
  })
}

const previewWatchState = computed(() => ({
  fieldKey: fieldKeyLocal.value,
  label: labelLocal.value,
  placeholder: placeholderLocal.value,
  required: requiredLocal.value,
  columnsCountStr: columnsCountStr.value,
  selectMultiple: selectMultiple.value,
  selectBlocks: selectBlocks.value.map((b) =>
    b.type === 'option'
      ? { ...b }
      : { ...b, items: b.items.map((i) => ({ ...i })) },
  ),
  choiceOptions: choiceOptions.value.map((r) => ({ ...r })),
  staticContent: staticContent.value,
  staticVariantStr: staticVariantStr.value,
  sectionCollapsible: sectionCollapsible.value,
  dividerSpacingStr: dividerSpacingStr.value,
  textMaxLength: textMaxLength.value,
  textInputModeStr: textInputModeStr.value,
  textareaMaxLength: textareaMaxLength.value,
  textareaRows: textareaRows.value,
  numberMin: numberMin.value,
  numberMax: numberMax.value,
  numberStep: numberStep.value,
  currencyDecimals: currencyDecimals.value,
  currencyCode: currencyCode.value,
  dateMin: dateMin.value,
  dateMax: dateMax.value,
  showWhenEnabled: showWhenEnabled.value,
  showWhenFieldKey: showWhenFieldKey.value,
  showWhenOperatorStr: showWhenOperatorStr.value,
  showWhenValueStr: showWhenValueStr.value,
}))

watch(
  () => props.field.id,
  (id, prevId) => {
    if (prevId !== undefined && id !== prevId) {
      inspectorTab.value = 'basic'
    }
    hydrate()
  },
  { immediate: true }
)

function configsEqual(a: Record<string, unknown>, b: Record<string, unknown> | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b ?? {})
}

function buildApplyPayload(): ElectronicFormInspectorApplyPayload | null {
  localError.value = ''
  const key = fieldKeyLocal.value.trim()
  if (!key) {
    localError.value = '欄位識別碼不可為空。'
    return null
  }
  const cfg = buildConfig()
  if (cfg === null) return null
  if (localError.value) return null
  return {
    fieldId: props.field.id,
    fieldKey: key,
    label: labelLocal.value.trim() || null,
    placeholder: placeholderLocal.value.trim() || null,
    required: requiredLocal.value,
    config: cfg,
  }
}

function isDirtyVsServer(payload: ElectronicFormInspectorApplyPayload): boolean {
  const f = props.field
  return (
    payload.fieldKey !== f.fieldKey ||
    payload.label !== f.label ||
    payload.placeholder !== f.placeholder ||
    payload.required !== f.required ||
    !configsEqual(payload.config, f.config as Record<string, unknown>)
  )
}

function persistIfDirty() {
  if (!props.isDraft || props.busy) return
  const payload = buildApplyPayload()
  if (!payload) return
  if (!isDirtyVsServer(payload)) return
  localError.value = ''
  emit('apply', payload)
}

let persistDebounce: ReturnType<typeof setTimeout> | null = null
const PERSIST_DEBOUNCE_MS = 500

function schedulePersist() {
  if (persistDebounce) clearTimeout(persistDebounce)
  persistDebounce = setTimeout(() => {
    persistDebounce = null
    persistIfDirty()
  }, PERSIST_DEBOUNCE_MS)
}

watch(
  previewWatchState,
  () => {
    void nextTick(() => emitPreviewChange())
    schedulePersist()
  },
  { deep: true, immediate: true }
)

watch(
  () => props.busy,
  (b) => {
    if (!b && props.isDraft) {
      void nextTick(() => persistIfDirty())
    }
  }
)

onBeforeUnmount(() => {
  if (persistDebounce) {
    clearTimeout(persistDebounce)
    persistDebounce = null
  }
  if (!props.isDraft) return
  const payload = buildApplyPayload()
  if (!payload || !isDirtyVsServer(payload)) return
  localError.value = ''
  emit('apply', payload)
})

const showValidationTab = computed(() =>
  ['text', 'textarea', 'number', 'currency', 'date'].includes(props.field.fieldType)
)

const showConditionsTab = computed(() =>
  [
    'text',
    'textarea',
    'number',
    'currency',
    'date',
    'select',
    'radio',
    'checkbox_group',
    'static_text',
    'section',
  ].includes(props.field.fieldType)
)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <Tabs v-model="inspectorTab" class="flex min-h-0 flex-1 flex-col gap-0">
      <TabsList
        class="h-auto w-full shrink-0 justify-start gap-0 rounded-none border-b border-border bg-transparent p-0"
      >
        <TabsTrigger
          value="basic"
          class="rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
        >
          基本
        </TabsTrigger>
        <TabsTrigger
          v-if="showValidationTab"
          value="validation"
          class="rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
        >
          驗證
        </TabsTrigger>
        <TabsTrigger
          v-if="showConditionsTab"
          value="conditions"
          class="rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
        >
          條件
        </TabsTrigger>
      </TabsList>

      <TabsContent value="basic" class="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
        <div class="space-y-2">
          <Label for="ef-inspector-label" class="text-foreground">顯示標題</Label>
          <Input id="ef-inspector-label" v-model="labelLocal" class="h-8" :disabled="!isDraft" />
        </div>
        <div v-if="hasDataKey" class="space-y-2">
          <Label for="ef-inspector-ph" class="text-foreground">Placeholder</Label>
          <Input id="ef-inspector-ph" v-model="placeholderLocal" class="h-8" :disabled="!isDraft" />
        </div>
        <div v-if="hasDataKey" class="flex items-center gap-2">
          <Checkbox id="ef-inspector-req" v-model:checked="requiredLocal" :disabled="!isDraft" />
          <Label for="ef-inspector-req" class="cursor-pointer text-foreground">必填</Label>
        </div>

        <template v-if="field.fieldType === 'columns'">
          <div class="space-y-2">
            <Label for="ef-inspector-cols" class="text-foreground">欄位數</Label>
            <Select v-model="columnsCountStr" :disabled="!isDraft">
              <SelectTrigger id="ef-inspector-cols" class="h-8 bg-background" :disabled="!isDraft">
                <SelectValue placeholder="欄數" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">兩欄</SelectItem>
                <SelectItem value="3">三欄</SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">
              若改為較少欄數，請先移出多餘欄槽內的欄位。
            </p>
          </div>
        </template>

        <template v-else-if="field.fieldType === 'section'">
          <div class="flex items-center gap-2">
            <Checkbox id="ef-section-collapsible" v-model:checked="sectionCollapsible" :disabled="!isDraft" />
            <Label for="ef-section-collapsible" class="cursor-pointer text-foreground">可摺疊</Label>
          </div>
        </template>

        <template v-else-if="field.fieldType === 'static_text'">
          <div class="space-y-2">
            <Label for="ef-static-content" class="text-foreground">文字內容</Label>
            <textarea
              id="ef-static-content"
              v-model="staticContent"
              rows="4"
              class="border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              :disabled="!isDraft"
            />
          </div>
          <div class="space-y-2">
            <Label class="text-foreground">樣式</Label>
            <Select v-model="staticVariantStr" :disabled="!isDraft">
              <SelectTrigger class="h-8 bg-background" :disabled="!isDraft">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">預設</SelectItem>
                <SelectItem value="muted">較淡</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </template>

        <template v-else-if="field.fieldType === 'divider'">
          <div class="space-y-2">
            <Label class="text-foreground">間距</Label>
            <Select v-model="dividerSpacingStr" :disabled="!isDraft">
              <SelectTrigger class="h-8 bg-background" :disabled="!isDraft">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">小</SelectItem>
                <SelectItem value="md">中</SelectItem>
                <SelectItem value="lg">大</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </template>

        <template v-else-if="isSelectField">
          <div class="space-y-3">
            <div class="space-y-2">
              <Label class="text-foreground">選擇模式</Label>
              <Select v-model="selectModeStr" :disabled="!isDraft">
                <SelectTrigger class="h-8 bg-background" :disabled="!isDraft">
                  <SelectValue placeholder="模式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">單選</SelectItem>
                  <SelectItem value="multiple">多選</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator class="bg-border" />
            <div class="space-y-2">
              <div class="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="h-8 shrink-0"
                  :disabled="!isDraft"
                  @click="addSelectOptionBlock"
                >
                  <Plus class="size-3.5" />
                  新增選項
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="h-8 shrink-0"
                  :disabled="!isDraft"
                  @click="addSelectGroupBlock"
                >
                  <Plus class="size-3.5" />
                  新增群組
                </Button>
              </div>
              <p class="text-xs text-muted-foreground">
                儲存用代碼由系統自動產生；群組僅為分類標題（顯示於下拉選單內）。
              </p>
              <div class="space-y-3 rounded-md border border-border bg-muted/20 p-2">
                <template v-for="(block, bIdx) in selectBlocks" :key="block.id">
                  <div
                    v-if="block.type === 'option'"
                    class="flex items-end gap-2 rounded-md border border-border/60 bg-background/50 p-2"
                  >
                    <div class="min-w-0 flex-1 space-y-1">
                      <Label :for="`ef-sel-opt-${block.id}`" class="text-xs text-muted-foreground">
                        選項 · 顯示文字
                      </Label>
                      <Input
                        :id="`ef-sel-opt-${block.id}`"
                        v-model="block.label"
                        class="h-8"
                        :disabled="!isDraft"
                        placeholder="使用者看到的選項文字"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      :disabled="!isDraft || selectBlocks.length <= 1"
                      title="移除此選項"
                      @click="removeSelectBlock(bIdx)"
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </div>
                  <div
                    v-else
                    class="space-y-2 rounded-md border border-dashed border-border bg-background/50 p-2"
                  >
                    <div class="flex flex-wrap items-end justify-between gap-2">
                      <div class="min-w-0 flex-1 space-y-1">
                        <Label :for="`ef-sel-grp-${block.id}`" class="text-xs text-muted-foreground">
                          群組標題
                        </Label>
                        <Input
                          :id="`ef-sel-grp-${block.id}`"
                          v-model="block.title"
                          class="h-8"
                          :disabled="!isDraft"
                          placeholder="顯示於選單中的分類名稱"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        :disabled="!isDraft || selectBlocks.length <= 1"
                        title="移除此群組"
                        @click="removeSelectBlock(bIdx)"
                      >
                        <Trash2 class="size-4" />
                      </Button>
                    </div>
                    <div class="space-y-2 pl-1">
                      <div
                        v-for="(it, iIdx) in block.items"
                        :key="it.id"
                        class="flex items-end gap-2"
                      >
                        <div class="min-w-0 flex-1 space-y-1">
                          <Label :for="`ef-sel-gi-${it.id}`" class="text-xs text-muted-foreground">
                            選項 · 顯示文字
                          </Label>
                          <Input
                            :id="`ef-sel-gi-${it.id}`"
                            v-model="it.label"
                            class="h-8"
                            :disabled="!isDraft"
                            placeholder="使用者看到的選項文字"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          class="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                          :disabled="!isDraft || block.items.length <= 1"
                          title="移除此選項"
                          @click="removeSelectGroupItem(bIdx, iIdx)"
                        >
                          <Trash2 class="size-4" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        class="h-8 w-full"
                        :disabled="!isDraft"
                        @click="addSelectGroupItem(bIdx)"
                      >
                        <Plus class="size-3.5" />
                        在此群組新增選項
                      </Button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="isFlatChoiceField">
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <Label class="text-foreground">選項</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-8 shrink-0"
                :disabled="!isDraft"
                @click="addChoiceRow"
              >
                <Plus class="size-3.5" />
                新增選項
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">儲存用代碼由系統自動產生，只需填寫顯示文字。</p>
            <div class="space-y-2 rounded-md border border-border bg-muted/20 p-2">
              <div
                v-for="(row, idx) in choiceOptions"
                :key="row.value || idx"
                class="flex items-end gap-2"
              >
                <div class="min-w-0 flex-1 space-y-1">
                  <Label :for="`ef-opt-l-${idx}`" class="text-xs text-muted-foreground">顯示文字</Label>
                  <Input
                    :id="`ef-opt-l-${idx}`"
                    v-model="row.label"
                    class="h-8"
                    :disabled="!isDraft"
                    placeholder="使用者看到的選項文字"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  :disabled="!isDraft || choiceOptions.length <= 1"
                  title="移除此選項"
                  @click="removeChoiceRow(idx)"
                >
                  <Trash2 class="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="field.fieldType === 'textarea'">
          <div class="space-y-2">
            <Label for="ef-ta-rows-basic" class="text-foreground">顯示列數</Label>
            <Input
              id="ef-ta-rows-basic"
              v-model="textareaRows"
              type="number"
              min="1"
              class="h-8"
              placeholder="例如 4"
              :disabled="!isDraft"
            />
          </div>
        </template>
      </TabsContent>

      <TabsContent
        v-if="showValidationTab"
        value="validation"
        class="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5"
      >
        <template v-if="field.fieldType === 'text'">
          <div class="space-y-2">
            <Label for="ef-text-max" class="text-foreground">最大字數</Label>
            <Input
              id="ef-text-max"
              v-model="textMaxLength"
              type="number"
              min="1"
              class="h-8"
              placeholder="留空表示不限制"
              :disabled="!isDraft"
            />
          </div>
          <div class="space-y-2">
            <Label class="text-foreground">輸入類型</Label>
            <Select v-model="textInputModeStr" :disabled="!isDraft">
              <SelectTrigger class="h-8 bg-background" :disabled="!isDraft">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">一般文字</SelectItem>
                <SelectItem value="email">電子郵件</SelectItem>
                <SelectItem value="tel">電話</SelectItem>
                <SelectItem value="url">網址</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </template>

        <template v-else-if="field.fieldType === 'textarea'">
          <div class="space-y-2">
            <Label for="ef-ta-max" class="text-foreground">最大字數</Label>
            <Input
              id="ef-ta-max"
              v-model="textareaMaxLength"
              type="number"
              min="1"
              class="h-8"
              placeholder="留空表示不限制"
              :disabled="!isDraft"
            />
          </div>
        </template>

        <template v-else-if="field.fieldType === 'number'">
          <div class="space-y-2">
            <Label for="ef-num-min" class="text-foreground">最小值</Label>
            <Input id="ef-num-min" v-model="numberMin" type="number" class="h-8" :disabled="!isDraft" />
          </div>
          <div class="space-y-2">
            <Label for="ef-num-max" class="text-foreground">最大值</Label>
            <Input id="ef-num-max" v-model="numberMax" type="number" class="h-8" :disabled="!isDraft" />
          </div>
          <div class="space-y-2">
            <Label for="ef-num-step" class="text-foreground">步進</Label>
            <Input
              id="ef-num-step"
              v-model="numberStep"
              type="number"
              min="0"
              step="any"
              class="h-8"
              placeholder="留空使用預設"
              :disabled="!isDraft"
            />
          </div>
        </template>

        <template v-else-if="field.fieldType === 'currency'">
          <div class="space-y-2">
            <Label for="ef-cur-dec" class="text-foreground">小數位數</Label>
            <Input
              id="ef-cur-dec"
              v-model="currencyDecimals"
              type="number"
              min="0"
              max="6"
              class="h-8"
              placeholder="例如 2"
              :disabled="!isDraft"
            />
          </div>
          <div class="space-y-2">
            <Label for="ef-cur-code" class="text-foreground">幣別（ISO 4217）</Label>
            <Input
              id="ef-cur-code"
              v-model="currencyCode"
              maxlength="3"
              class="h-8 font-mono uppercase"
              placeholder="TWD"
              :disabled="!isDraft"
            />
          </div>
        </template>

        <template v-else-if="field.fieldType === 'date'">
          <div class="space-y-2">
            <Label for="ef-date-min" class="text-foreground">最早日期</Label>
            <Input id="ef-date-min" v-model="dateMin" type="date" class="h-8" :disabled="!isDraft" />
          </div>
          <div class="space-y-2">
            <Label for="ef-date-max" class="text-foreground">最晚日期</Label>
            <Input id="ef-date-max" v-model="dateMax" type="date" class="h-8" :disabled="!isDraft" />
          </div>
          <p class="text-xs text-muted-foreground">格式 YYYY-MM-DD；留空表示不限制。</p>
        </template>
      </TabsContent>

      <TabsContent
        v-if="showConditionsTab"
        value="conditions"
        class="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5"
      >
        <div class="flex items-center gap-2">
          <Checkbox id="ef-sw-en" v-model:checked="showWhenEnabled" :disabled="!isDraft" />
          <Label for="ef-sw-en" class="cursor-pointer text-foreground">依條件顯示此欄位</Label>
        </div>
        <template v-if="showWhenEnabled">
          <div class="space-y-2">
            <Label class="text-foreground">依據欄位</Label>
            <Select v-model="showWhenFieldKey" :disabled="!isDraft">
              <SelectTrigger class="h-8 bg-background" :disabled="!isDraft">
                <SelectValue placeholder="選擇欄位" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="rf in conditionReferenceFields"
                  :key="rf.id"
                  :value="rf.fieldKey"
                >
                  {{ rf.fieldKey }}
                  <span v-if="rf.label" class="text-muted-foreground">（{{ rf.label }}）</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="conditionReferenceFields.length === 0" class="text-xs text-muted-foreground">
              表單內尚無其他可參照的輸入欄位。
            </p>
          </div>
          <div class="space-y-2">
            <Label class="text-foreground">條件</Label>
            <Select v-model="showWhenOperatorStr" :disabled="!isDraft">
              <SelectTrigger class="h-8 bg-background" :disabled="!isDraft">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="op in SHOW_WHEN_OPERATORS" :key="op.value" :value="op.value">
                  {{ op.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-if="valueNeedsShowWhenInput()" class="space-y-2">
            <Label for="ef-sw-val" class="text-foreground">
              {{ showWhenOperatorStr === 'in' || showWhenOperatorStr === 'notIn' ? '值清單（逗號分隔）' : '比對值' }}
            </Label>
            <Input
              id="ef-sw-val"
              v-model="showWhenValueStr"
              class="h-8"
              :disabled="!isDraft"
              placeholder="與依據欄位儲存值一致（選項類為系統產生之代碼）"
            />
          </div>
          <p class="text-xs text-muted-foreground">
            僅支援單一條件；複合邏輯將於後續版本擴充。
          </p>
        </template>
      </TabsContent>
    </Tabs>

    <p v-if="localError" class="shrink-0 text-xs text-destructive">{{ localError }}</p>

    <div class="mt-auto flex shrink-0 flex-col gap-2 border-t border-border pt-3">
      <p v-if="isDraft && busy" class="text-xs text-muted-foreground">正在儲存欄位…</p>
      <Button size="sm" variant="destructive" class="h-8" :disabled="!isDraft || busy" @click="emit('delete-request')">
        刪除此欄位
      </Button>
    </div>
  </div>
</template>
