import type { ElectronicFormFieldType } from '@/constants/electronic-form-field-contract'

/**
 * Builder 左側元件庫：同一 fieldType 可出現多次時以 id 區分。
 */
export type ElectronicFormBuilderPaletteEntry = {
  id: string
  fieldType: ElectronicFormFieldType
  label: string
  /** 與 defaultConfigForElectronicFormFieldType 淺層合併 */
  configPatch?: Record<string, unknown>
}

export const ELECTRONIC_FORM_BUILDER_PALETTE: readonly ElectronicFormBuilderPaletteEntry[] = [
  { id: 'section', fieldType: 'section', label: '區塊' },
  { id: 'columns', fieldType: 'columns', label: '多欄列' },
  { id: 'divider', fieldType: 'divider', label: '分隔線' },
  { id: 'static_text', fieldType: 'static_text', label: '說明文字' },

  { id: 'text', fieldType: 'text', label: '單行文字' },
  { id: 'textarea', fieldType: 'textarea', label: '多行文字' },
  { id: 'number', fieldType: 'number', label: '數字' },
  { id: 'currency', fieldType: 'currency', label: '金額' },
  { id: 'date', fieldType: 'date', label: '日期' },
  { id: 'select', fieldType: 'select', label: '下拉選單' },
  { id: 'radio', fieldType: 'radio', label: '單選' },
  { id: 'checkbox_group', fieldType: 'checkbox_group', label: '多選' },
]
