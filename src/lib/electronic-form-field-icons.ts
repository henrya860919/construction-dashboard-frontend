import type { Component } from 'vue'
import {
  AlignJustify,
  CalendarDays,
  ChevronsUpDown,
  CircleDollarSign,
  CircleDot,
  Columns2,
  Hash,
  LayoutPanelTop,
  ListChecks,
  Minus,
  ScrollText,
  TextCursorInput,
} from 'lucide-vue-next'
import type { ElectronicFormFieldType } from '@/constants/electronic-form-field-contract'

/** Builder 元件庫／畫布列：欄位類型對應 Lucide 圖示 */
export const ELECTRONIC_FORM_FIELD_TYPE_ICONS: Record<ElectronicFormFieldType, Component> = {
  section: LayoutPanelTop,
  columns: Columns2,
  divider: Minus,
  static_text: ScrollText,
  text: TextCursorInput,
  textarea: AlignJustify,
  number: Hash,
  currency: CircleDollarSign,
  date: CalendarDays,
  select: ChevronsUpDown,
  radio: CircleDot,
  checkbox_group: ListChecks,
}
