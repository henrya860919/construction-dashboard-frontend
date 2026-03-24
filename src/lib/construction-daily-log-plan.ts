/**
 * 施工日誌「預定進度 %」預覽：與後端 `planned-progress-for-log.ts` 邏輯對齊。
 * 節點須為填表日當下已生效之進度計畫（含變更後累計預定）；有節點則內插，否則依開工日＋核定工期線性推算。
 */

export type ProgressPlanKnot = { periodDate: string; cumulativePlanned: string }

function ymdToUtcDayIndex(ymd: string): number | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || !mo || !d) return null
  return Math.floor(Date.UTC(y, mo - 1, d) / 86400000)
}

function roundClampPct(x: number): number {
  return Math.round(Math.min(100, Math.max(0, x)) * 100) / 100
}

/** 與後端 `interpolatePlannedPercentFromPlanKnots` 一致 */
export function interpolatePlannedPercentFromPlanKnots(
  logDateYmd: string,
  startDateYmd: string | null,
  knots: ProgressPlanKnot[]
): number | null {
  if (!knots.length) return null
  const logT = ymdToUtcDayIndex(logDateYmd)
  if (logT == null) return null

  const sorted = [...knots].sort((a, b) => a.periodDate.localeCompare(b.periodDate))
  const parsed: { t: number; c: number }[] = []
  for (const k of sorted) {
    const t = ymdToUtcDayIndex(k.periodDate)
    const c = Number(String(k.cumulativePlanned).replace(/,/g, ''))
    if (t == null || !Number.isFinite(c)) continue
    parsed.push({ t, c })
  }
  if (!parsed.length) return null

  const firstT = parsed[0]!.t
  const st = startDateYmd ? ymdToUtcDayIndex(startDateYmd) : null
  const anchorT = st != null && st < firstT ? st : firstT - 1

  const points: { t: number; c: number }[] = [{ t: anchorT, c: 0 }]
  for (const p of parsed) {
    const last = points[points.length - 1]!
    if (last.t === p.t) {
      points[points.length - 1] = p
    } else {
      points.push(p)
    }
  }
  points.sort((a, b) => a.t - b.t)

  if (logT < points[0]!.t) {
    return roundClampPct(points[0]!.c)
  }
  if (logT >= points[points.length - 1]!.t) {
    return roundClampPct(points[points.length - 1]!.c)
  }

  let i = 0
  while (i < points.length - 1 && points[i + 1]!.t < logT) {
    i++
  }
  const a = points[i]!
  const b = points[i + 1]!
  if (!b || b.t <= a.t) {
    return roundClampPct(a.c)
  }
  const f = (logT - a.t) / (b.t - a.t)
  return roundClampPct(a.c + f * (b.c - a.c))
}

/** 無進度表時：依開工日與核定工期線性比例，上限 100 */
export function computePlannedProgressLinearPreview(
  logDate: string,
  startDate: string | null,
  approvedDurationDays: number | null | undefined
): number | null {
  if (!startDate || approvedDurationDays == null || approvedDurationDays <= 0) return null
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(Date.UTC(y, m - 1, d))
  }
  const start = parse(startDate)
  const log = parse(logDate)
  if (!start || !log) return null
  const ua = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  const ub = Date.UTC(log.getUTCFullYear(), log.getUTCMonth(), log.getUTCDate())
  const elapsed = Math.max(0, Math.floor((ub - ua) / 86400000) + 1)
  if (elapsed === 0) return 0
  const raw = (elapsed / approvedDurationDays) * 100
  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100
}

/**
 * 表單預覽用預定進度（累計 %）。
 * @param progressKnots 來自 defaults／單筆日誌 API 之 `progressPlanKnots`；有資料則內插。
 */
export function computePlannedProgressPreview(
  logDate: string,
  startDate: string | null,
  approvedDurationDays: number | null | undefined,
  progressKnots?: ProgressPlanKnot[] | null
): number | null {
  const startTrim = startDate?.trim() || null
  const ad =
    approvedDurationDays === undefined || approvedDurationDays === null
      ? null
      : Number(approvedDurationDays)

  if (progressKnots?.length) {
    const v = interpolatePlannedPercentFromPlanKnots(logDate, startTrim, progressKnots)
    if (v !== null) return v
  }
  return computePlannedProgressLinearPreview(logDate, startTrim, ad != null && Number.isFinite(ad) ? ad : null)
}
