import type { InjectionKey, Ref } from 'vue'
import type { ElectronicFormFieldItem } from '@/api/electronic-form-definitions'

/** 填寫預覽：與 `ElectronicFormFillPreviewDepth` 共用之 answers（fieldKey → 值） */
export const electronicFormFillPreviewValuesKey: InjectionKey<Ref<Record<string, unknown>>> =
  Symbol('electronicFormFillPreviewValues')

export function sortedChildrenInFillPreview(
  allFields: ElectronicFormFieldItem[],
  parentId: string,
  slotIndex: number | null
): ElectronicFormFieldItem[] {
  return allFields
    .filter(
      (f) =>
        (f.parentFieldId ?? null) === parentId && (f.slotIndex ?? null) === slotIndex
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

function isEmptyAnswer(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  return false
}

/** 依欄位 `config.showWhen` 與目前填寫值決定是否顯示（與 Inspector 寫入結構對齊） */
export function isFillPreviewFieldVisible(
  field: ElectronicFormFieldItem,
  values: Record<string, unknown>
): boolean {
  const cfg = field.config as Record<string, unknown> | undefined
  const sw = cfg?.showWhen
  if (!sw || typeof sw !== 'object' || sw === null) return true
  const o = sw as Record<string, unknown>
  const refKey = typeof o.fieldKey === 'string' ? o.fieldKey : ''
  if (!refKey) return true
  const op = typeof o.operator === 'string' ? o.operator : 'equals'
  const refVal = values[refKey]

  switch (op) {
    case 'isEmpty':
      return isEmptyAnswer(refVal)
    case 'isNotEmpty':
      return !isEmptyAnswer(refVal)
    case 'equals': {
      const target = o.value
      if (Array.isArray(refVal)) {
        const rv = refVal.map((x) => String(x)).sort()
        if (Array.isArray(target)) {
          const tv = target.map((x) => String(x)).sort()
          return rv.length === tv.length && rv.every((x, i) => x === tv[i])
        }
        return rv.length === 1 && rv[0] === String(target ?? '')
      }
      return String(refVal ?? '') === String(target ?? '')
    }
    case 'notEquals': {
      const target = o.value
      if (Array.isArray(refVal)) {
        const rv = refVal.map((x) => String(x)).sort()
        if (Array.isArray(target)) {
          const tv = target.map((x) => String(x)).sort()
          return !(rv.length === tv.length && rv.every((x, i) => x === tv[i]))
        }
        return !(rv.length === 1 && rv[0] === String(target ?? ''))
      }
      return String(refVal ?? '') !== String(target ?? '')
    }
    case 'in': {
      const arr = Array.isArray(o.value) ? o.value.map((x) => String(x)) : []
      if (Array.isArray(refVal)) {
        return refVal.some((x) => arr.includes(String(x)))
      }
      return arr.includes(String(refVal ?? ''))
    }
    case 'notIn': {
      const arr = Array.isArray(o.value) ? o.value.map((x) => String(x)) : []
      if (Array.isArray(refVal)) {
        return !refVal.some((x) => arr.includes(String(x)))
      }
      return !arr.includes(String(refVal ?? ''))
    }
    default:
      return true
  }
}
