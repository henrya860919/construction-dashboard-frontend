import type { ElectronicFormFieldItem } from '@/api/electronic-form-definitions'

export const ELECTRONIC_FORM_BUILDER_CLIPBOARD_PREFIX = 'cm-dashboard-ef:v1:'

export type ElectronicFormBuilderClipboardNode = {
  oldId: string
  /** 父欄位若在剪貼簿子樹內，為其 oldId；剪貼簿根節點為 null */
  parentOldId: string | null
  /** 剪貼簿根節點在表單上的父欄位 id（null＝根層） */
  externalParentFieldId: string | null
  slotIndex: number | null
  sortOrder: number
  fieldType: string
  label: string | null
  placeholder: string | null
  required: boolean
  readonly: boolean
  config: Record<string, unknown>
}

export type ElectronicFormBuilderClipboardPayload = {
  v: 1
  nodes: ElectronicFormBuilderClipboardNode[]
}

function subtreeIdSet(rootId: string, allFields: ElectronicFormFieldItem[]): Set<string> {
  const set = new Set<string>()
  function add(id: string) {
    if (set.has(id)) return
    set.add(id)
    for (const c of allFields.filter((f) => f.parentFieldId === id)) add(c.id)
  }
  add(rootId)
  return set
}

/** 前序走訪：父永遠在子之前，便於建立時依序 POST */
export function collectOrderedSubtreeFields(
  rootId: string,
  allFields: ElectronicFormFieldItem[]
): ElectronicFormFieldItem[] {
  const ids = subtreeIdSet(rootId, allFields)
  const out: ElectronicFormFieldItem[] = []
  function visit(id: string) {
    const f = allFields.find((x) => x.id === id)
    if (!f || !ids.has(id)) return
    out.push(f)
    const kids = allFields
      .filter((x) => x.parentFieldId === id && ids.has(x.id))
      .sort((a, b) => {
        const sa = a.slotIndex ?? -1
        const sb = b.slotIndex ?? -1
        if (sa !== sb) return sa - sb
        return a.sortOrder - b.sortOrder
      })
    for (const k of kids) visit(k.id)
  }
  visit(rootId)
  return out
}

export function buildClipboardPayloadFromSubtree(
  ordered: ElectronicFormFieldItem[]
): ElectronicFormBuilderClipboardPayload {
  const ids = new Set(ordered.map((f) => f.id))
  const nodes: ElectronicFormBuilderClipboardNode[] = ordered.map((f) => {
    const p = f.parentFieldId ?? null
    const parentInTree = p != null && ids.has(p)
    return {
      oldId: f.id,
      parentOldId: parentInTree ? p : null,
      externalParentFieldId: parentInTree ? null : p,
      slotIndex: f.slotIndex ?? null,
      sortOrder: f.sortOrder,
      fieldType: f.fieldType,
      label: f.label,
      placeholder: f.placeholder,
      required: f.required,
      readonly: f.readonly,
      config: JSON.parse(JSON.stringify(f.config ?? {})) as Record<string, unknown>,
    }
  })
  return { v: 1, nodes }
}

export function serializeElectronicFormBuilderClipboard(payload: ElectronicFormBuilderClipboardPayload): string {
  return ELECTRONIC_FORM_BUILDER_CLIPBOARD_PREFIX + JSON.stringify(payload)
}

export function parseElectronicFormBuilderClipboard(text: string): ElectronicFormBuilderClipboardPayload | null {
  if (!text.startsWith(ELECTRONIC_FORM_BUILDER_CLIPBOARD_PREFIX)) return null
  try {
    const raw = JSON.parse(text.slice(ELECTRONIC_FORM_BUILDER_CLIPBOARD_PREFIX.length)) as unknown
    if (!raw || typeof raw !== 'object') return null
    const o = raw as { v?: unknown; nodes?: unknown }
    if (o.v !== 1 || !Array.isArray(o.nodes) || o.nodes.length === 0) return null
    return o as ElectronicFormBuilderClipboardPayload
  } catch {
    return null
  }
}
