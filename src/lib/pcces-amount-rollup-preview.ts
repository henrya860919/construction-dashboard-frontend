/**
 * 與後端 `pcces-amount-rollup.ts` 對齊：預覽「變更後數量／單價」套用後的階層複價（含子層加總、非葉單價反算）。
 */

export type PccesRollupPreviewRow = {
  itemKey: number
  parentItemKey: number | null
  depth: number
  quantity: string
  unitPrice: string
  /** 計算後寫入；呼叫前可為 null */
  amountImported: string | null
}

const DECIMAL_PLACES = 4

function parseNum(s: string): number {
  const n = parseFloat(String(s).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

function roundToPlaces(n: number): number {
  if (!Number.isFinite(n)) return 0
  const f = 10 ** DECIMAL_PLACES
  return Math.round(n * f) / f
}

function engineeringDecimalString(n: number): string {
  const r = roundToPlaces(n)
  if (r === 0) return '0'
  const s = r.toFixed(DECIMAL_PLACES).replace(/\.?0+$/, '')
  return s === '-0' ? '0' : s
}

function parentItemKeysWithChildren(rows: readonly { parentItemKey: number | null }[]): Set<number> {
  const s = new Set<number>()
  for (const r of rows) {
    if (r.parentItemKey != null) s.add(r.parentItemKey)
  }
  return s
}

/**
 * 就地計算每列複價（由最深層往淺層）。
 */
export function applyPccesPreviewRollup(rows: PccesRollupPreviewRow[]): void {
  if (rows.length === 0) return

  const parentsWithChildren = parentItemKeysWithChildren(rows)

  const childrenByParent = new Map<number, PccesRollupPreviewRow[]>()
  for (const r of rows) {
    const pk = r.parentItemKey
    if (pk === null) continue
    const list = childrenByParent.get(pk)
    if (list) list.push(r)
    else childrenByParent.set(pk, [r])
  }

  let maxDepth = 0
  for (const r of rows) {
    if (r.depth > maxDepth) maxDepth = r.depth
  }

  for (let d = maxDepth; d >= 1; d--) {
    for (const r of rows) {
      if (r.depth !== d) continue

      const isLeaf = !parentsWithChildren.has(r.itemKey)
      if (isLeaf) {
        const amt = parseNum(r.quantity) * parseNum(r.unitPrice)
        r.amountImported = engineeringDecimalString(amt)
        continue
      }

      const kids = childrenByParent.get(r.itemKey) ?? []
      let sum = 0
      for (const k of kids) {
        const a = k.amountImported != null ? parseNum(k.amountImported) : 0
        sum += a
      }
      r.amountImported = engineeringDecimalString(sum)
      const q = parseNum(r.quantity)
      r.unitPrice = q > 0 ? engineeringDecimalString(roundToPlaces(sum / q)) : '0'
    }
  }
}
