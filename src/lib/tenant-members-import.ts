import * as XLSX from 'xlsx'
import { parseCsv } from './parse-csv'

export type ParsedTenantMembersImport = {
  rows: Record<string, unknown>[]
  error?: string
}

/** 與後端 `canonicalMemberImportField` 一致；匯入固定為系統使用者／內部成員，不對應角色／類型欄 */
export function mapMemberImportHeaderToCanonical(header: string): string | null {
  const t = header.trim()
  if (!t) return null
  const lower = t.toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_')
  const map: Record<string, string> = {
    電子郵件: 'email',
    email: 'email',
    e_mail: 'email',
    密碼: 'password',
    password: 'password',
    姓名: 'name',
    name: 'name',
  }
  if (map[t] !== undefined) return map[t]!
  if (map[lower] !== undefined) return map[lower]!
  return null
}

function headersHaveRequired(headers: string[]): boolean {
  const canon = new Set(
    headers.map((h) => mapMemberImportHeaderToCanonical(h)).filter((x): x is string => !!x)
  )
  return canon.has('email') && canon.has('password')
}

function isBlankRow(r: Record<string, unknown>): boolean {
  return Object.values(r).every((v) => {
    if (v === undefined || v === null) return true
    return String(v).trim() === ''
  })
}

function finalizeMemberImportRows(rows: Record<string, unknown>[]): ParsedTenantMembersImport {
  const nonBlank = rows.filter((r) => !isBlankRow(r))
  if (nonBlank.length === 0) {
    return { rows: [], error: '沒有可匯入的資料列（已略過空白列）' }
  }
  if (nonBlank.length > 500) {
    return { rows: [], error: '單次最多 500 筆，請分批匯入' }
  }
  const headers = Object.keys(nonBlank[0]!)
  if (!headersHaveRequired(headers)) {
    return {
      rows: [],
      error: '表頭需包含「電子郵件」與「密碼」欄（或英文 email、password）',
    }
  }
  return { rows: nonBlank }
}

export function parseTenantMembersImportXlsx(buf: ArrayBuffer): ParsedTenantMembersImport {
  const wb = XLSX.read(buf, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    return { rows: [], error: '檔案中沒有工作表' }
  }
  const sheet = wb.Sheets[sheetName]
  if (!sheet) {
    return { rows: [], error: '無法讀取工作表' }
  }
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })
  const rows = raw.map((r) => {
    const o: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(r)) {
      o[k.trim()] = v
    }
    return o
  })
  if (rows.length === 0) {
    return { rows: [], error: '至少需要表頭下方一列資料' }
  }
  return finalizeMemberImportRows(rows)
}

export function parseTenantMembersImportCsv(text: string): ParsedTenantMembersImport {
  const trimmed = text.replace(/^\uFEFF/, '')
  const matrix = parseCsv(trimmed)
  if (matrix.length < 2) {
    return { rows: [], error: '至少需要表頭與一列資料' }
  }
  const headers = matrix[0]!.map((h) => h.trim())
  if (!headersHaveRequired(headers)) {
    return {
      rows: [],
      error: '表頭需包含「電子郵件」與「密碼」欄（或英文 email、password）',
    }
  }
  const rows: Record<string, unknown>[] = []
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r]!
    if (line.every((c) => !String(c ?? '').trim())) continue
    const obj: Record<string, unknown> = {}
    headers.forEach((h, col) => {
      obj[h] = line[col] ?? ''
    })
    rows.push(obj)
  }
  return finalizeMemberImportRows(rows)
}

export async function parseTenantMembersImportFile(file: File): Promise<ParsedTenantMembersImport> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buf = await file.arrayBuffer()
    return parseTenantMembersImportXlsx(buf)
  }
  if (lower.endsWith('.csv')) {
    return parseTenantMembersImportCsv(await file.text())
  }
  return { rows: [], error: '請上傳 .xlsx、.xls 或 .csv' }
}
