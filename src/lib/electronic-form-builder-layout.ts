import type { ElectronicFormFieldItem } from '@/api/electronic-form-definitions'
import { getElectronicFormColumnsCount } from '@/constants/electronic-form-field-contract'

export type ElectronicFormLayoutAssignment = {
  id: string
  parentFieldId: string | null
  slotIndex: number | null
  sortOrder: number
}

export type BuilderDropTarget =
  | { type: 'before'; targetField: ElectronicFormFieldItem }
  | { type: 'append-root' }
  | { type: 'append-slot'; parentColumnsId: string; slotIndex: number }
  | { type: 'append-section'; sectionId: string }

export function buildAssignmentsFromFields(
  fields: ElectronicFormFieldItem[]
): ElectronicFormLayoutAssignment[] {
  return fields.map((f) => ({
    id: f.id,
    parentFieldId: f.parentFieldId ?? null,
    slotIndex: f.slotIndex ?? null,
    sortOrder: f.sortOrder,
  }))
}

/** 由子節點往上走，若途中經過 `ancestorId` 則為 true（`descendantId` 是否在該祖先底下） */
export function isFieldAncestorOf(
  fields: ElectronicFormFieldItem[],
  ancestorId: string,
  descendantId: string
): boolean {
  let cur: ElectronicFormFieldItem | undefined = fields.find((f) => f.id === descendantId)
  while (cur?.parentFieldId) {
    const parentId = cur.parentFieldId
    if (parentId === ancestorId) return true
    cur = fields.find((f) => f.id === parentId)
  }
  return false
}

export function canDropField(
  fields: ElectronicFormFieldItem[],
  dragId: string,
  target: BuilderDropTarget
): boolean {
  const drag = fields.find((f) => f.id === dragId)
  if (!drag) return false

  if (target.type === 'before' && target.targetField.id === dragId) return false

  let newParentId: string | null
  let newSlot: number | null

  if (target.type === 'append-root') {
    newParentId = null
    newSlot = null
  } else if (target.type === 'append-slot') {
    newParentId = target.parentColumnsId
    newSlot = target.slotIndex
  } else if (target.type === 'append-section') {
    newParentId = target.sectionId
    newSlot = null
  } else {
    newParentId = target.targetField.parentFieldId ?? null
    newSlot = target.targetField.slotIndex ?? null
  }

  if (newParentId && isFieldAncestorOf(fields, dragId, newParentId)) return false

  if (newParentId) {
    const parent = fields.find((f) => f.id === newParentId)
    if (!parent) return false
    if (parent.fieldType === 'columns') {
      if (drag.fieldType === 'section' || drag.fieldType === 'columns') return false
      const n = getElectronicFormColumnsCount(parent.config as Record<string, unknown>)
      if (newSlot == null || newSlot < 0 || newSlot >= n) return false
    } else if (parent.fieldType === 'section') {
      if (newSlot != null) return false
    } else {
      return false
    }
  } else if (newSlot != null) {
    return false
  }

  return true
}

/**
 * 將 `dragId` 移到 `newParentId` / `newSlot` 底下；`beforeId` 有值時插在其前，否則接在同層最後。
 */
export function moveFieldToContainer(
  fields: ElectronicFormFieldItem[],
  dragId: string,
  newParentId: string | null,
  newSlot: number | null,
  beforeId: string | null
): ElectronicFormLayoutAssignment[] {
  const copy = fields.map((f) => ({ ...f }))
  const dragIdx = copy.findIndex((x) => x.id === dragId)
  if (dragIdx < 0) return buildAssignmentsFromFields(copy)

  const oldP = copy[dragIdx].parentFieldId ?? null
  const oldS = copy[dragIdx].slotIndex ?? null

  function sortedSiblingIds(parentId: string | null, slot: number | null, excludeId: string): string[] {
    return copy
      .filter(
        (f) =>
          f.id !== excludeId &&
          (f.parentFieldId ?? null) === parentId &&
          (f.slotIndex ?? null) === slot
      )
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((f) => f.id)
  }

  function writeSiblings(parentId: string | null, slot: number | null, ids: string[]) {
    ids.forEach((id, sortOrder) => {
      const i = copy.findIndex((x) => x.id === id)
      if (i >= 0) {
        copy[i] = {
          ...copy[i],
          parentFieldId: parentId,
          slotIndex: slot,
          sortOrder,
        }
      }
    })
  }

  const oldIds = sortedSiblingIds(oldP, oldS, dragId)
  writeSiblings(oldP, oldS, oldIds)

  let newIds = sortedSiblingIds(newParentId, newSlot, dragId)
  if (beforeId) {
    const at = newIds.indexOf(beforeId)
    if (at >= 0) {
      newIds = [...newIds.slice(0, at), dragId, ...newIds.slice(at)]
    } else {
      newIds = [...newIds, dragId]
    }
  } else {
    newIds = [...newIds, dragId]
  }
  writeSiblings(newParentId, newSlot, newIds)

  return buildAssignmentsFromFields(copy)
}

export function assignmentsForDuplicateNextToSource(
  fields: ElectronicFormFieldItem[],
  sourceId: string,
  newId: string
): ElectronicFormLayoutAssignment[] {
  const source = fields.find((f) => f.id === sourceId)
  const p = source?.parentFieldId ?? null
  const s = source?.slotIndex ?? null
  const orderedIds = fields
    .filter((f) => (f.parentFieldId ?? null) === p && (f.slotIndex ?? null) === s)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f) => f.id)
  const withoutNew = orderedIds.filter((id) => id !== newId)
  const at = withoutNew.indexOf(sourceId)
  const next =
    at >= 0 ? [...withoutNew.slice(0, at + 1), newId, ...withoutNew.slice(at + 1)] : [...withoutNew, newId]

  const copy = fields.map((f) => ({ ...f }))
  next.forEach((id, sortOrder) => {
    const i = copy.findIndex((x) => x.id === id)
    if (i >= 0) {
      copy[i] = { ...copy[i], parentFieldId: p, slotIndex: s, sortOrder }
    }
  })
  return buildAssignmentsFromFields(copy)
}
