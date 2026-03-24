const MS_PER_DAY = 24 * 60 * 60 * 1000

function toKey(s: string): string {
  const t = String(s ?? '').trim()
  if (t.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  return t.slice(0, 10)
}

function parseYmdLocal(s: string): number {
  const key = toKey(s)
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).setHours(0, 0, 0, 0)
}

/**
 * WBS 工期語意：**含開始日在內**之日曆天數。
 * 結束日（完成日）= 開始日 + (工期 − 1)，**不再**額外 +1。
 * 「+1」僅用於前置：後續開始日 = 前置完成日 + 1。
 */
export function wbsEndDateInclusive(startYmd: string, durationDays: number): string {
  const d = Math.max(1, Math.floor(durationDays))
  const key = toKey(startYmd)
  const [y, m, day] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, day)
  dt.setDate(dt.getDate() + d - 1)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** 由開始、結束（含首尾）反推工期天數 */
export function wbsDurationInclusiveDays(startYmd: string, endYmd: string): number {
  const s = parseYmdLocal(startYmd)
  const e = parseYmdLocal(endYmd)
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 1
  return Math.max(1, Math.round((e - s) / MS_PER_DAY) + 1)
}
