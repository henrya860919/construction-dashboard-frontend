import * as XLSX from 'xlsx'

export type ParsedProgressPlanRow = {
  periodDate: string
  periodIndex: number
  periodProgress: number
  /** Excel 第 3 欄累計預定 %；有則後端／圖表以此列為累計基準 */
  cumulativeProgress?: number
}

export class ProgressPlanExcelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProgressPlanExcelError'
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toIsoDateUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/** Excel serial (days since 1899-12-30) → UTC 日期字串 */
function excelSerialToIso(n: number): string | null {
  if (!Number.isFinite(n)) return null
  const base = Date.UTC(1899, 11, 30)
  const ms = Math.round(n * 86400000)
  return toIsoDateUtc(new Date(base + ms))
}

export function parseCellDate(v: unknown): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return excelSerialToIso(v)
  if (v instanceof Date && !Number.isNaN(v.getTime())) return toIsoDateUtc(v)
  const s = String(v).trim()
  const m = s.match(/^(\d{4})\D(\d{1,2})\D(\d{1,2})/)
  if (m) return `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`
  const t = Date.parse(s)
  if (!Number.isNaN(t)) return toIsoDateUtc(new Date(t))
  return null
}

function parseCellNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(String(v).replace(/,/g, '').replace(/%/g, '').trim())
  return Number.isFinite(n) ? n : null
}

function isHeaderRow(row: unknown[]): boolean {
  const h0 = String(row[0] ?? '')
    .replace(/\s/g, '')
    .toLowerCase()
  if (!h0) return false
  return (
    h0.includes('時間') ||
    h0.includes('日期') ||
    h0.includes('週') ||
    h0.includes('interval') ||
    h0.includes('date')
  )
}

/**
 * 解析進度計畫 Excel（第一個工作表）。
 * 欄位：第 1 欄時間區間、第 2 欄本期預定 %、第 3 欄累計預定 %（可選；若無第 2 欄則由累計差分推算）。
 * 第一列若偵測為表頭則略過。
 */
export function parseProgressPlanExcelBuffer(buf: ArrayBuffer): ParsedProgressPlanRow[] {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new ProgressPlanExcelError('檔案中沒有工作表')
  const sheet = wb.Sheets[sheetName]
  if (!sheet) throw new ProgressPlanExcelError('無法讀取工作表')

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
  }) as unknown[][]
  if (!rows.length) throw new ProgressPlanExcelError('工作表為空')

  let start = 0
  if (rows[0] && isHeaderRow(rows[0] as unknown[])) start = 1

  type Raw = { date: string; period: number | null; cum: number | null; sheetRow: number }
  const raw: Raw[] = []

  for (let r = start; r < rows.length; r++) {
    const row = rows[r] as unknown[]
    if (!row || row.length === 0) continue
    const date = parseCellDate(row[0])
    const c1 = parseCellNumber(row[1])
    const c2 = row.length > 2 ? parseCellNumber(row[2]) : null
    const emptyRow = !date && c1 == null && c2 == null && !String(row[0] ?? '').trim()
    if (emptyRow) continue
    if (!date) {
      throw new ProgressPlanExcelError(`第 ${r + 1} 列：無法解析日期（時間區間）`)
    }
    raw.push({ date, period: c1, cum: c2, sheetRow: r + 1 })
  }

  if (!raw.length) throw new ProgressPlanExcelError('沒有有效的資料列')

  raw.sort((a, b) => a.date.localeCompare(b.date))

  for (let i = 1; i < raw.length; i++) {
    if (raw[i]!.date === raw[i - 1]!.date) {
      throw new ProgressPlanExcelError('存在重複的時間區間日期，請修正後再上傳')
    }
  }

  let running = 0
  const entries: ParsedProgressPlanRow[] = []

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]!
    let pp: number | null = row.period
    if (pp == null && row.cum != null) {
      pp = row.cum - running
    }
    if (pp == null || !Number.isFinite(pp)) {
      throw new ProgressPlanExcelError(
        `第 ${row.sheetRow} 列：請填寫「預定進度（本期 %）」或「累計預定進度（%）」至少一項`
      )
    }
    running += pp
    entries.push({
      periodDate: row.date,
      periodIndex: i,
      periodProgress: pp,
      ...(row.cum != null && Number.isFinite(row.cum) ? { cumulativeProgress: row.cum } : {}),
    })
  }

  return entries
}
