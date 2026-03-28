import {
  addElectronicFormField,
  deleteElectronicFormField,
  getElectronicFormDefinition,
  reorderElectronicFormFields,
  updateElectronicFormDefinition,
  updateElectronicFormField,
  type ElectronicFormFieldItem,
  type ElectronicFormFieldLayoutAssignment,
} from '@/api/electronic-form-definitions'

function fieldDepth(fields: ElectronicFormFieldItem[], id: string): number {
  const byId = new Map(fields.map((f) => [f.id, f]))
  let d = 0
  let cur: string | null = id
  const seen = new Set<string>()
  while (cur) {
    if (seen.has(cur)) return d
    seen.add(cur)
    const f = byId.get(cur)
    if (!f || f.parentFieldId == null) return d
    d += 1
    cur = f.parentFieldId
  }
  return d
}

function sortFieldsForCreation(
  toCreate: ElectronicFormFieldItem[],
  idMap: Map<string, string>
): ElectronicFormFieldItem[] {
  const remaining = new Set(toCreate.map((f) => f.id))
  const byId = new Map(toCreate.map((f) => [f.id, f]))
  const result: ElectronicFormFieldItem[] = []
  while (remaining.size > 0) {
    let progressed = false
    for (const id of [...remaining]) {
      const f = byId.get(id)!
      const p = f.parentFieldId
      if (p == null || idMap.has(p)) {
        result.push(f)
        remaining.delete(id)
        progressed = true
      }
    }
    if (!progressed) {
      throw new Error('無法還原欄位樹：父子關係異常')
    }
  }
  return result
}

function fieldContentSignature(f: ElectronicFormFieldItem): string {
  return JSON.stringify({
    fieldKey: f.fieldKey,
    fieldType: f.fieldType,
    label: f.label,
    placeholder: f.placeholder,
    required: f.required,
    readonly: f.readonly,
    config: f.config ?? {},
  })
}

/**
 * 將後端表單欄位狀態對齊到目標快照（用於復原）：刪除多餘、補回缺漏、更新內容、最後整批版面 reorder。
 */
export async function reconcileElectronicFormDefinitionToSnapshot(
  formId: string,
  tenantId: string | undefined,
  targetFields: ElectronicFormFieldItem[],
  options?: { name?: string }
): Promise<void> {
  let server = await getElectronicFormDefinition(formId, tenantId)
  const snapIds = new Set(targetFields.map((f) => f.id))

  const targetName = options?.name?.trim()
  if (targetName && targetName !== server.name) {
    await updateElectronicFormDefinition(formId, tenantId, { name: targetName })
    server = await getElectronicFormDefinition(formId, tenantId)
  }

  const idMap = new Map<string, string>()
  for (const f of targetFields) {
    if (server.fields.some((s) => s.id === f.id)) {
      idMap.set(f.id, f.id)
    }
  }

  const toRemove = server.fields.filter((sf) => !snapIds.has(sf.id))
  toRemove.sort((a, b) => fieldDepth(server.fields, b.id) - fieldDepth(server.fields, a.id))
  for (const f of toRemove) {
    await deleteElectronicFormField(formId, f.id, tenantId)
  }

  if (toRemove.length > 0) {
    server = await getElectronicFormDefinition(formId, tenantId)
  }

  const toCreate = targetFields.filter((f) => !idMap.has(f.id))
  const creationOrder = sortFieldsForCreation(toCreate, idMap)
  const configClone = (c: Record<string, unknown>) =>
    JSON.parse(JSON.stringify(c ?? {})) as Record<string, unknown>

  for (const f of creationOrder) {
    const parentSnapId = f.parentFieldId ?? null
    const parentServerId =
      parentSnapId == null ? undefined : (idMap.get(parentSnapId) ?? undefined)
    if (parentSnapId != null && parentServerId == null) {
      throw new Error('無法還原欄位：父欄位尚未建立')
    }
    const created = await addElectronicFormField(formId, tenantId, {
      fieldKey: f.fieldKey,
      fieldType: f.fieldType,
      label: f.label,
      placeholder: f.placeholder,
      required: f.required,
      readonly: f.readonly,
      sortOrder: f.sortOrder,
      parentFieldId: parentServerId ?? null,
      slotIndex: f.slotIndex ?? null,
      config: configClone(f.config as Record<string, unknown>),
    })
    idMap.set(f.id, created.id)
  }

  server = await getElectronicFormDefinition(formId, tenantId)
  const serverById = new Map(server.fields.map((x) => [x.id, x]))

  for (const snapField of targetFields) {
    const serverId = idMap.get(snapField.id)
    if (!serverId) continue
    const row = serverById.get(serverId)
    if (!row) continue
    if (fieldContentSignature(row) === fieldContentSignature(snapField)) continue
    await updateElectronicFormField(formId, serverId, tenantId, {
      fieldKey: snapField.fieldKey,
      fieldType: snapField.fieldType,
      label: snapField.label,
      placeholder: snapField.placeholder,
      required: snapField.required,
      readonly: snapField.readonly,
      config: configClone(snapField.config as Record<string, unknown>),
    })
  }

  server = await getElectronicFormDefinition(formId, tenantId)
  if (server.fields.length !== targetFields.length) {
    throw new Error('還原後欄位數量不一致，請重新整理頁面')
  }

  const assignments: ElectronicFormFieldLayoutAssignment[] = targetFields.map((f) => {
    const id = idMap.get(f.id)
    if (!id) throw new Error('還原版面時缺少欄位對應')
    const parentSnap = f.parentFieldId
    const parentServer =
      parentSnap == null ? null : (idMap.get(parentSnap) ?? null)
    if (parentSnap != null && parentServer == null) {
      throw new Error('還原版面時父欄位對應遺失')
    }
    return {
      id,
      parentFieldId: parentServer,
      slotIndex: f.slotIndex ?? null,
      sortOrder: f.sortOrder,
    }
  })

  await reorderElectronicFormFields(formId, tenantId, assignments)
}
