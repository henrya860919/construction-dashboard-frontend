import type { ElectronicFormFieldItem } from '@/api/electronic-form-definitions'
import type { ElectronicFormBuilderPaletteEntry } from '@/constants/electronic-form-builder-palette'
import { ELECTRONIC_FORM_BUILDER_PALETTE } from '@/constants/electronic-form-builder-palette'

/** 元件庫拖入畫布時的放置目標 */
export type ElectronicFormBuilderPaletteDropPlacement =
  | { kind: 'root' }
  | { kind: 'section-append'; sectionId: string }
  | { kind: 'columns-slot'; columnsId: string; slotIndex: number }
  | { kind: 'before-field'; beforeField: ElectronicFormFieldItem }

export const ELECTRONIC_FORM_PALETTE_DRAG_PREFIX = 'efpalette:'

export function setElectronicFormPaletteDragData(e: DragEvent, entryId: string): void {
  e.dataTransfer?.setData('text/plain', `${ELECTRONIC_FORM_PALETTE_DRAG_PREFIX}${entryId}`)
  // copyMove + 放置點設 dropEffect=move，可減少部分瀏覽器綠色「+」游標
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copyMove'
}

export function parseElectronicFormPaletteEntryFromDataTransfer(
  dt: DataTransfer | null
): ElectronicFormBuilderPaletteEntry | null {
  const raw = dt?.getData('text/plain') ?? ''
  if (!raw.startsWith(ELECTRONIC_FORM_PALETTE_DRAG_PREFIX)) return null
  const id = raw.slice(ELECTRONIC_FORM_PALETTE_DRAG_PREFIX.length)
  return ELECTRONIC_FORM_BUILDER_PALETTE.find((e) => e.id === id) ?? null
}

/** 是否為元件庫拖曳（避免與欄位 id 的 text/plain 混淆） */
export function isElectronicFormPaletteDragData(dt: DataTransfer | null): boolean {
  return parseElectronicFormPaletteEntryFromDataTransfer(dt) != null
}
