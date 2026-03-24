/**
 * 與後端 `pcces-path-sort.ts` 一致：PCCES path 分段比較（項次 token 數值序，支援黏接與複合中文數字）。
 */

const CJK_ITEM_NO_MAP: Record<string, number> = {
  壹: 1,
  貳: 2,
  參: 3,
  肆: 4,
  伍: 5,
  陸: 6,
  柒: 7,
  捌: 8,
  玖: 9,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
}

const PATH_SEP = ' > '

function stripLeadingNoise(s: string): string {
  return s.replace(/^[、，．.,:：\s]+/u, '').trim()
}

function leadingDigitRun(segment: string): { raw: string; len: number } | null {
  let len = 0
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i]!
    const code = c.charCodeAt(0)
    if ((c >= '0' && c <= '9') || (code >= 0xff10 && code <= 0xff19)) {
      len++
      continue
    }
    break
  }
  if (len === 0) return null
  const slice = segment.slice(0, len)
  const raw = [...slice]
    .map((ch) => {
      const code = ch.charCodeAt(0)
      if (code >= 0xff10 && code <= 0xff19) {
        return String.fromCharCode(code - 0xff10 + 0x30)
      }
      return ch
    })
    .join('')
  return { raw, len }
}

function chineseNumeralPrefixAtStart(s: string): { raw: string; value: number } | null {
  const mTensUnit = /^([一二三四五六七八九])十([一二三四五六七八九])?$/.exec(s)
  if (mTensUnit) {
    const tens = CJK_ITEM_NO_MAP[mTensUnit[1]!]!
    const ones = mTensUnit[2] ? CJK_ITEM_NO_MAP[mTensUnit[2]!]! : 0
    return { raw: mTensUnit[0], value: tens * 10 + ones }
  }
  const mTen = /^十([一二三四五六七八九])?$/.exec(s)
  if (mTen) {
    const ones = mTen[1] ? CJK_ITEM_NO_MAP[mTen[1]!]! : 0
    return { raw: mTen[0], value: 10 + ones }
  }
  return null
}

function segmentItemNoAndRest(segment: string): { itemNo: string; rest: string } {
  const trimmed = segment.trim()
  if (!trimmed) return { itemNo: '', rest: '' }

  const digits = leadingDigitRun(trimmed)
  if (digits) {
    const rest = stripLeadingNoise(trimmed.slice(digits.len))
    return { itemNo: digits.raw, rest }
  }

  const cn = chineseNumeralPrefixAtStart(trimmed)
  if (cn) {
    const rest = stripLeadingNoise(trimmed.slice(cn.raw.length))
    return { itemNo: cn.raw, rest }
  }

  const first = trimmed[0]!
  if (CJK_ITEM_NO_MAP[first] !== undefined) {
    const rest = stripLeadingNoise(trimmed.slice(1))
    return { itemNo: first, rest }
  }

  const m = /^(\S+)(?:\s+(.*))?$/s.exec(trimmed)
  if (!m) return { itemNo: '', rest: '' }
  return { itemNo: m[1], rest: stripLeadingNoise((m[2] ?? '').trim()) }
}

function parsePccesPathItemNoToken(token: string): number {
  const t = token.trim()
  if (!t) return 9999

  if (/^\d+$/.test(t)) {
    const n = parseInt(t, 10)
    return Number.isNaN(n) ? 9999 : n
  }

  const cn = chineseNumeralPrefixAtStart(t)
  if (cn && t === cn.raw) return cn.value

  if (CJK_ITEM_NO_MAP[t] !== undefined) return CJK_ITEM_NO_MAP[t]

  if (t.length > 1) {
    const cn2 = chineseNumeralPrefixAtStart(t)
    if (cn2) return cn2.value
    const f = t[0]!
    if (CJK_ITEM_NO_MAP[f] !== undefined) return CJK_ITEM_NO_MAP[f]
  }

  const arabic = parseInt(t, 10)
  if (!Number.isNaN(arabic)) return arabic

  return 9999
}

export function comparePccesDisplayPathOrder(aPath: string, bPath: string): number {
  const aSegs = aPath.split(PATH_SEP).map((s) => s.trim()).filter(Boolean)
  const bSegs = bPath.split(PATH_SEP).map((s) => s.trim()).filter(Boolean)
  const n = Math.max(aSegs.length, bSegs.length)
  for (let i = 0; i < n; i++) {
    if (i >= aSegs.length) return -1
    if (i >= bSegs.length) return 1
    const sa = segmentItemNoAndRest(aSegs[i])
    const sb = segmentItemNoAndRest(bSegs[i])
    const na = parsePccesPathItemNoToken(sa.itemNo)
    const nb = parsePccesPathItemNoToken(sb.itemNo)
    if (na !== nb) return na - nb
    const byRest = sa.rest.localeCompare(sb.rest, 'zh-Hant', { sensitivity: 'base' })
    if (byRest !== 0) return byRest
    const byFull = aSegs[i].localeCompare(bSegs[i], 'zh-Hant', { numeric: true, sensitivity: 'base' })
    if (byFull !== 0) return byFull
  }
  return 0
}

/**
 * 同一 parentItemKey 桶內多筆葉子 path 中，display 序最小者。
 * 用於「桶與桶」排序：勿只用父層 path（較短會誤排在較深子樹之前）。
 */
export function minPccesDisplayPath(paths: string[]): string {
  const nonEmpty = paths.map((p) => p.trim()).filter(Boolean)
  if (nonEmpty.length === 0) return ''
  let best = nonEmpty[0]!
  for (let i = 1; i < nonEmpty.length; i++) {
    const p = nonEmpty[i]!
    if (comparePccesDisplayPathOrder(p, best) < 0) best = p
  }
  return best
}

export function pathSegmentCount(p: string): number {
  return p.split(PATH_SEP).map((s) => s.trim()).filter(Boolean).length
}

export type PccesTreeRowForBucketOrder = {
  itemKey: number
  parentItemKey: number | null
  path: string
}

export type PccesValuationBucketEmit =
  | { kind: 'chapterBanner'; parentItemKey: number }
  | { kind: 'section'; parentItemKey: number; hideParentRow: boolean }

export function orderPccesValuationBucketEmits(
  bucketParentKeys: Iterable<number>,
  rows: PccesTreeRowForBucketOrder[],
): PccesValuationBucketEmit[] {
  const bucketSet = new Set(bucketParentKeys)
  if (bucketSet.size === 0) return []

  const byKey = new Map(rows.map((r) => [r.itemKey, r]))
  const children = new Map<number, number[]>()
  for (const r of rows) {
    const p = r.parentItemKey
    if (p == null) continue
    const arr = children.get(p) ?? []
    arr.push(r.itemKey)
    children.set(p, arr)
  }

  const memoSub = new Map<number, boolean>()
  function subtreeHasBucket(k: number): boolean {
    const hit = memoSub.get(k)
    if (hit !== undefined) return hit
    let v = bucketSet.has(k)
    for (const ch of children.get(k) ?? []) {
      if (subtreeHasBucket(ch)) {
        v = true
        break
      }
    }
    memoSub.set(k, v)
    return v
  }

  function sortChildKeys(keys: number[]): number[] {
    return [...keys].sort((a, b) => {
      const pa = byKey.get(a)?.path ?? ''
      const pb = byKey.get(b)?.path ?? ''
      const c = comparePccesDisplayPathOrder(pa, pb)
      return c !== 0 ? c : a - b
    })
  }

  function rootsOfBuckets(): number[] {
    const rootSet = new Set<number>()
    for (const pk of bucketSet) {
      let cur: number | null = pk
      for (let i = 0; i < 256 && cur != null; i++) {
        const row = byKey.get(cur)
        if (!row) break
        if (row.parentItemKey == null) {
          rootSet.add(row.itemKey)
          break
        }
        cur = row.parentItemKey
      }
    }
    return sortChildKeys([...rootSet])
  }

  function dfs(n: number): PccesValuationBucketEmit[] {
    const row = byKey.get(n)
    if (!row) return []
    const ch = sortChildKeys(children.get(n) ?? [])
    const hasDirect = bucketSet.has(n)
    const childWithBucket = ch.filter((c) => subtreeHasBucket(c))
    const needsBanner = pathSegmentCount(row.path) === 1 && hasDirect && childWithBucket.length > 0

    const out: PccesValuationBucketEmit[] = []
    if (needsBanner) {
      out.push({ kind: 'chapterBanner', parentItemKey: n })
    }
    for (const c of ch) {
      if (!subtreeHasBucket(c)) continue
      out.push(...dfs(c))
    }
    if (hasDirect) {
      out.push({ kind: 'section', parentItemKey: n, hideParentRow: needsBanner })
    }
    return out
  }

  const out: PccesValuationBucketEmit[] = []
  for (const r of rootsOfBuckets()) {
    out.push(...dfs(r))
  }
  return out
}

export function parentPathPrefixFromLeafPath(leafPath: string): string {
  const t = leafPath.trim()
  const i = t.lastIndexOf(PATH_SEP)
  return i === -1 ? '' : t.slice(0, i)
}

/** 分桶排序鍵：優先父層列的 path；否則由子列 path 去尾段推算 */
export function pccesBucketOrderPath<
  T extends { parentItemKey: number | null; path: string; isStructuralLeaf: boolean; itemKey: number },
>(leaf: T, rows: T[]): string {
  const pk = leaf.parentItemKey
  if (pk == null) {
    return leaf.path.trim()
  }
  const parentRow = rows.find((x) => x.itemKey === pk && !x.isStructuralLeaf)
  if (parentRow?.path?.trim()) {
    return parentRow.path.trim()
  }
  return parentPathPrefixFromLeafPath(leaf.path)
}
