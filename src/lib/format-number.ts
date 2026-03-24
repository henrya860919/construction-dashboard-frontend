/**
 * 數字千分位與金額顯示（zh-TW：`1,234.56` 形式）。
 * 後端若回傳字串小數，請直接傳入；已含逗號的字串會先去除再解析。
 */

export type FormatThousandsOptions = {
  /** 最少小數位；未指定時為 0 */
  minimumFractionDigits?: number
  /** 最多小數位；未指定時為 20（避免長小數被截斷） */
  maximumFractionDigits?: number
  /** 無法解析為有效數字時顯示 */
  fallback?: string
}

/**
 * 解析為有限數字；無法解析回傳 `null`（不拋錯）。
 * 會略過千分位逗號與空白。
 */
export function parseLocaleNumber(
  value: string | number | bigint | null | undefined
): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'bigint') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const s = String(value).replace(/,/g, '').replace(/\s/g, '').trim()
  if (s === '' || s === '-' || s === '+') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * 千分位格式化（核心）。
 */
export function formatThousands(
  value: string | number | bigint | null | undefined,
  options?: FormatThousandsOptions
): string {
  const fallback = options?.fallback ?? '—'
  const n = parseLocaleNumber(value)
  if (n === null) return fallback

  const minimumFractionDigits = options?.minimumFractionDigits ?? 0
  const maximumFractionDigits = options?.maximumFractionDigits ?? 20

  return new Intl.NumberFormat('zh-TW', {
    useGrouping: true,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(n)
}

/**
 * 一般金額：千分位，小數 0～2 位（尾隨 0 不強制補滿）。
 */
export function formatMoney(
  value: string | number | bigint | null | undefined,
  options?: Pick<FormatThousandsOptions, 'fallback'>
): string {
  return formatThousands(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    fallback: options?.fallback,
  })
}

/**
 * 金額固定兩位小數（例如帳面新台幣）。
 */
export function formatMoneyFixed2(
  value: string | number | bigint | null | undefined,
  options?: Pick<FormatThousandsOptions, 'fallback'>
): string {
  return formatThousands(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    fallback: options?.fallback,
  })
}

/**
 * 與後端 `Decimal(18,4)` 對齊：單價、複價、數量等工程數值（最多四位小數）。
 */
export function formatEngineeringDecimal(
  value: string | number | bigint | null | undefined,
  options?: Pick<FormatThousandsOptions, 'fallback'>
): string {
  return formatThousands(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
    fallback: options?.fallback,
  })
}
