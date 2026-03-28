/**
 * 將 dragId 放到 dropTargetId 那一列所代表的「插槽」：移除後再插入。
 * 往下拖時，drop 在下一列 = 插在該列之後；非相鄰下移仍插在目標列之前（與既有行為一致）。
 */
export function reorderFieldIds(ids: string[], dragId: string, dropTargetId: string): string[] {
  const from = ids.indexOf(dragId)
  const to = ids.indexOf(dropTargetId)
  if (from < 0 || to < 0 || from === to) return [...ids]
  const next = [...ids]
  next.splice(from, 1)
  let newTo: number
  if (from < to) {
    // 正下方相鄰：to - 1 會插回「目標前」等同原序，必須改為插在目標後（索引 to）
    newTo = to === from + 1 ? to : to - 1
  } else {
    newTo = to
  }
  next.splice(newTo, 0, dragId)
  return next
}

/** 將 dragId 移到清單最後 */
export function moveFieldIdToEnd(ids: string[], dragId: string): string[] {
  const from = ids.indexOf(dragId)
  if (from < 0) return [...ids]
  const next = [...ids]
  next.splice(from, 1)
  next.push(dragId)
  return next
}
