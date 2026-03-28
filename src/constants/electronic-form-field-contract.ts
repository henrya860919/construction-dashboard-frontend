/**
 * 電子表單欄位契約（與後端 `src/schemas/electronic-form-field-contract.ts` 對齊）。
 * 變更 fieldType 清單或語意時請同步後端並遞增 ELECTRONIC_FORM_FIELD_CONTRACT_VERSION。
 */
export const ELECTRONIC_FORM_FIELD_CONTRACT_VERSION = 4 as const

export const ELECTRONIC_FORM_FIELD_TYPES = [
  'section',
  'columns',
  'divider',
  'static_text',
  'text',
  'textarea',
  'number',
  'currency',
  'date',
  'select',
  'radio',
  'checkbox_group',
] as const

export type ElectronicFormFieldType = (typeof ELECTRONIC_FORM_FIELD_TYPES)[number]

export function isElectronicFormFieldType(s: string): s is ElectronicFormFieldType {
  return (ELECTRONIC_FORM_FIELD_TYPES as readonly string[]).includes(s)
}

export function isElectronicFormContainerFieldType(s: string): boolean {
  return s === 'section' || s === 'columns'
}

/** 與後端 `getElectronicFormColumnsCount` 對齊 */
export function getElectronicFormColumnsCount(config: Record<string, unknown> | undefined): 2 | 3 {
  const c = config?.columns
  if (c === 3) return 3
  return 2
}

/** Builder 元件庫／矩陣顯示用 */
export const ELECTRONIC_FORM_FIELD_TYPE_LABELS: Record<ElectronicFormFieldType, string> = {
  section: '區塊',
  columns: '多欄列',
  divider: '分隔線',
  static_text: '說明文字',
  text: '單行文字',
  textarea: '多行文字',
  number: '數字',
  currency: '金額',
  date: '日期',
  select: '下拉選單',
  radio: '單選',
  checkbox_group: '多選',
}

/**
 * 結構／裝飾欄位不寫入 FormSubmission.data[fieldKey]（或可不存 key）。
 * 其餘型別預設以 fieldKey 存一筆值。
 */
export const ELECTRONIC_FORM_FIELD_TYPES_WITHOUT_DATA_KEY: ReadonlySet<ElectronicFormFieldType> = new Set([
  'section',
  'columns',
  'divider',
  'static_text',
])

/**
 * `data[fieldKey]` 建議值型別（Runtime 與後端索引／JSON 約定）。
 * - currency：建議存 number（整數最小單位或十進位數；與後端 Decimal 索引策略一致即可）
 */
export type ElectronicFormFieldValueType =
  | 'string'
  | 'string[]'
  | 'number'
  | 'none'

export const ELECTRONIC_FORM_FIELD_VALUE_KIND: Record<ElectronicFormFieldType, ElectronicFormFieldValueType> = {
  section: 'none',
  columns: 'none',
  divider: 'none',
  static_text: 'none',
  text: 'string',
  textarea: 'string',
  number: 'number',
  currency: 'number',
  date: 'string',
  /** 單選為 string；`config.multiple === true` 時為 string[] */
  select: 'string',
  radio: 'string',
  checkbox_group: 'string[]',
}

/** 新增欄位時給後端 `config` 的合理預設（可再依 UI 覆寫） */
export function defaultConfigForElectronicFormFieldType(
  type: ElectronicFormFieldType
): Record<string, unknown> {
  switch (type) {
    case 'section':
      return {}
    case 'columns':
      return { columns: 2, gap: 'md' }
    case 'divider':
      return {}
    case 'static_text':
      return { content: '說明文字', variant: 'default' }
    case 'text':
      return {}
    case 'textarea':
      return { rows: 4 }
    case 'number':
      return {}
    case 'currency':
      return { decimals: 2, currencyCode: 'TWD' }
    case 'date':
      return {}
    case 'select':
      return {
        multiple: false,
        options: [
          { value: 'a', label: '選項 A' },
          { value: 'b', label: '選項 B' },
        ],
      }
    case 'radio':
    case 'checkbox_group':
      return {
        options: [
          { value: 'a', label: '選項 A' },
          { value: 'b', label: '選項 B' },
        ],
      }
  }
}
