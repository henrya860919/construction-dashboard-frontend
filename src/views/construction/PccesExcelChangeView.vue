<script setup lang="ts">
import { ref, computed, watch, onMounted, shallowRef } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { isAxiosError } from 'axios'
import * as XLSX from 'xlsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { buildProjectPath, ROUTE_PATH, ROUTE_NAME } from '@/constants/routes'
import { formatEngineeringDecimal, parseLocaleNumber } from '@/lib/format-number'
import {
  applyPccesPreviewRollup,
  type PccesRollupPreviewRow,
} from '@/lib/pcces-amount-rollup-preview'
import {
  getPccesImportItems,
  applyPccesImportExcelChanges,
  type PccesItemDto,
  type PccesExcelApplyBody,
} from '@/api/pcces-imports'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { toast } from '@/components/ui/sonner'
import { Loader2, Upload } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => (route.params.projectId as string) ?? '')
function queryParamSingle(v: unknown): string {
  if (typeof v === 'string' && v.trim() !== '') return v.trim()
  if (Array.isArray(v) && typeof v[0] === 'string' && v[0].trim() !== '') return v[0].trim()
  return ''
}

const baseImportId = computed(() => queryParamSingle(route.query.baseImportId))

const perm = useProjectModuleActions(projectId, 'construction.pcces')

const loadingItems = ref(true)
const loadError = ref('')
const items = ref<PccesItemDto[]>([])
const summaryVersion = ref<number | null>(null)
const summaryFileName = ref('')

const excelFileName = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

/** Excel 列（僅含變更後數量或新增單價有值者） */
type ExcelParsed = {
  itemNo: string
  description: string
  unit: string
  qtyRaw: string
  unitPriceRaw: string
  remark: string
}

type UnmatchedRow = ExcelParsed & {
  id: string
  selectedParentKey: number | null
  /** 匯入後寫入 PCCES 的項次（可編輯；與 Excel 稽核欄 excel.itemNo 分開） */
  assignedItemNo: string
}

type ManualPlacedRow = {
  id: string
  parentItemKey: number
  assignedItemNo: string
  excel: ExcelParsed
}

const normalize = (s: string) => s.replace(/[，,、\s]/g, '')

const HEADER_LABELS = {
  itemNo: '項次',
  description: '項目名稱',
  unit: '單位',
  changeQty: '變更後數量',
  newPrice: '新增單價',
  remark: '備註',
} as const

function cellStr(v: unknown): string {
  if (v == null || v === '') return ''
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return String(v).trim()
}

/** 非 HTTPS／部分內嵌 WebView 下 randomUUID 會拋錯，需後備避免整段上傳失敗 */
function randomRowId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    try {
      const buf = new Uint8Array(16)
      crypto.getRandomValues(buf)
      buf[6] = (buf[6] & 0x0f) | 0x40
      buf[8] = (buf[8] & 0x3f) | 0x80
      const hex = [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    } catch {
      return `row-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    }
  }
}

function parseHeaderRow(
  row: unknown[]
): Partial<Record<keyof typeof HEADER_LABELS, number>> | null {
  const col: Partial<Record<keyof typeof HEADER_LABELS, number>> = {}
  for (let i = 0; i < row.length; i++) {
    const c = cellStr(row[i]).replace(/\s/g, '')
    ;(Object.entries(HEADER_LABELS) as [keyof typeof HEADER_LABELS, string][]).forEach(
      ([key, label]) => {
        if (c === label.replace(/\s/g, '')) col[key] = i
      }
    )
  }
  if (col.description == null) return null
  return col
}

type RowCarryState = {
  lastDescription: string
  lastUnit: string
  lastItemNo: string
  /** 上一筆「儲存格有填項目名稱」的列所對應的項次（避免：新項次列名稱空白時誤套上一列名稱而錯誤對應） */
  lastDescFromItemNo: string
}

/**
 * 讀取一列；`項目名稱`／`單位`／`項次` 可沿用上一列（對應合併儲存格下列為空）。
 * 若本列已填新「項次」且與上筆有名稱列的項次不同、但項目名稱空白 → 不沿用，改占位字串以便進未對應清單。
 */
function readDataRowWithCarryForward(
  row: unknown[],
  col: Partial<Record<keyof typeof HEADER_LABELS, number>>,
  carry: RowCarryState
): ExcelParsed | null {
  const di = col.description
  if (di == null) return null
  const rawDesc = cellStr(row[di])
  const rawItemNo = col.itemNo != null ? cellStr(row[col.itemNo]) : ''
  if (rawItemNo) carry.lastItemNo = rawItemNo

  const qtyRaw = col.changeQty != null ? cellStr(row[col.changeQty]) : ''
  const unitPriceRaw = col.newPrice != null ? cellStr(row[col.newPrice]) : ''
  if (!qtyRaw.trim() && !unitPriceRaw.trim()) return null

  let description: string
  if (rawDesc) {
    carry.lastDescription = rawDesc
    carry.lastDescFromItemNo = rawItemNo || carry.lastDescFromItemNo
    description = rawDesc
  } else if (
    carry.lastDescription &&
    (rawItemNo === '' || rawItemNo === carry.lastDescFromItemNo)
  ) {
    description = carry.lastDescription
  } else if (rawItemNo !== '' && rawItemNo !== carry.lastDescFromItemNo) {
    description = `（項次 ${rawItemNo}，Excel 未填項目名稱）`
  } else {
    description = carry.lastDescription
  }

  if (!description.trim()) return null

  const rawUnit = col.unit != null ? cellStr(row[col.unit]) : ''
  if (rawUnit) carry.lastUnit = rawUnit

  return {
    itemNo: carry.lastItemNo,
    description,
    unit: carry.lastUnit,
    qtyRaw,
    unitPriceRaw,
    remark: col.remark != null ? cellStr(row[col.remark]) : '',
  }
}

const HEADER_SCAN_MAX_ROW = 200

function parseSheetToRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })
}

/** 從單一工作表解析；表頭「項目名稱」可在前 200 列內（避免第二份檔前段說明列較多就讀不到） */
function parseRowsFromMatrix(rows: unknown[][]): ExcelParsed[] {
  let headerCols: Partial<Record<keyof typeof HEADER_LABELS, number>> | null = null
  let headerRowIndex = -1
  for (let ri = 0; ri < Math.min(rows.length, HEADER_SCAN_MAX_ROW); ri++) {
    const r = rows[ri] as unknown[]
    const parsed = parseHeaderRow(r)
    if (parsed?.description != null) {
      headerCols = parsed
      headerRowIndex = ri
      break
    }
  }
  if (!headerCols) return []

  const carry: RowCarryState = {
    lastDescription: '',
    lastUnit: '',
    lastItemNo: '',
    lastDescFromItemNo: '',
  }
  const out: ExcelParsed[] = []
  for (let ri = headerRowIndex + 1; ri < rows.length; ri++) {
    const r = rows[ri] as unknown[]
    if (!r?.length) continue
    const row = readDataRowWithCarryForward(r, headerCols, carry)
    if (row) out.push(row)
  }
  return out
}

function parsePccesChangeWorkbook(buffer: ArrayBuffer): ExcelParsed[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const names = wb.SheetNames ?? []
  const all: ExcelParsed[] = []
  for (const sheetName of names) {
    try {
      const sheet = wb.Sheets[sheetName]
      if (!sheet) continue
      const rows = parseSheetToRows(sheet)
      const parsed = parseRowsFromMatrix(rows)
      for (const p of parsed) all.push(p)
    } catch (e) {
      console.warn('[PCCES Excel] 略過無法解析的分頁', sheetName, e)
    }
  }
  return all
}

function mergeExcelRows(a: ExcelParsed, b: ExcelParsed): ExcelParsed {
  return {
    itemNo: b.itemNo.trim() ? b.itemNo : a.itemNo,
    description: a.description,
    unit: b.unit.trim() ? b.unit : a.unit,
    qtyRaw: b.qtyRaw.trim() ? b.qtyRaw : a.qtyRaw,
    unitPriceRaw: b.unitPriceRaw.trim() ? b.unitPriceRaw : a.unitPriceRaw,
    remark: b.remark.trim() ? b.remark : a.remark,
  }
}

const leafItems = computed(() => {
  const pw = new Set<number>()
  for (const it of items.value) {
    if (it.parentItemKey != null) pw.add(it.parentItemKey)
  }
  return items.value.filter((it) => !pw.has(it.itemKey))
})

function buildLeafMatchIndex(leaves: PccesItemDto[]) {
  const exact = new Map<string, PccesItemDto>()
  const norm = new Map<string, PccesItemDto>()
  for (const L of leaves) {
    if (!exact.has(L.description)) exact.set(L.description, L)
    const k = normalize(L.description)
    if (!norm.has(k)) norm.set(k, L)
  }
  return { exact, norm }
}

function matchLeaf(desc: string, idx: ReturnType<typeof buildLeafMatchIndex>): PccesItemDto | null {
  const t = desc.trim()
  if (!t) return null
  const e = idx.exact.get(t)
  if (e) return e
  return idx.norm.get(normalize(t)) ?? null
}

/** itemKey → Excel 列（自動對應） */
const matchedAuto = shallowRef(new Map<number, ExcelParsed>())
const manualPlaced = ref<ManualPlacedRow[]>([])
const unmatchedRows = ref<UnmatchedRow[]>([])
const confirmLoading = ref(false)
/** 確認匯入後產生之新版本顯示名稱（必填，不預設） */
const newVersionLabel = ref('')

const mainItemOptions = computed(() =>
  [...items.value].filter((i) => i.itemKind === 'mainItem').sort((a, b) => a.itemKey - b.itemKey)
)

/** 手動掛載列在父層下依「匯入項次」排序（與清冊項次顯示一致） */
function sortKeyManualItemNo(m: ManualPlacedRow): string {
  return (m.assignedItemNo.trim() || m.excel.itemNo.trim()).trim()
}

function comparePccesItemNoSort(a: string, b: string): number {
  const sa = a || '\uFFFF'
  const sb = b || '\uFFFF'
  return sa.localeCompare(sb, 'zh-Hant', { numeric: true, sensitivity: 'base' })
}

type DisplayTableRow =
  | { kind: 'item'; item: PccesItemDto }
  | { kind: 'manual'; manual: ManualPlacedRow }

/**
 * 同一父層下：清冊子列依 itemKey 遞增（與後端／明細列表一致）；手動掛載列無 itemKey，排在該父層清冊子列之後、依項次排序。
 * 親子關係以 parentItemKey／itemKey 為準（pcces-item-tree）。
 */
function mergedChildSlotsUnderParent(parentItemKey: number): DisplayTableRow[] {
  const base = items.value
    .filter((i) => i.parentItemKey === parentItemKey)
    .sort((a, b) => a.itemKey - b.itemKey)
  const manuals = manualPlaced.value
    .filter((m) => m.parentItemKey === parentItemKey)
    .sort((a, b) => {
      const byNo = comparePccesItemNoSort(sortKeyManualItemNo(a), sortKeyManualItemNo(b))
      return byNo !== 0 ? byNo : a.id.localeCompare(b.id)
    })
  return [
    ...base.map((item) => ({ kind: 'item' as const, item })),
    ...manuals.map((manual) => ({ kind: 'manual' as const, manual })),
  ]
}

function walkItemIntoDisplayRows(
  item: PccesItemDto,
  out: DisplayTableRow[],
  visited: Set<number>
): void {
  if (visited.has(item.itemKey)) return
  visited.add(item.itemKey)
  out.push({ kind: 'item', item })
  for (const slot of mergedChildSlotsUnderParent(item.itemKey)) {
    if (slot.kind === 'manual') {
      out.push(slot)
    } else {
      walkItemIntoDisplayRows(slot.item, out, visited)
    }
  }
}

/** 清冊階層順序（深度優先前序）：根 → 子→孫…；同層清冊列依 itemKey 遞增；parent 不在表內者視為根。 */
const displayRows = computed((): DisplayTableRow[] => {
  const out: DisplayTableRow[] = []
  const visited = new Set<number>()
  const byKey = new Map(items.value.map((i) => [i.itemKey, i]))

  const roots = items.value
    .filter((i) => i.parentItemKey === null || !byKey.has(i.parentItemKey))
    .sort((a, b) => a.itemKey - b.itemKey)
  for (const r of roots) {
    walkItemIntoDisplayRows(r, out, visited)
  }

  const leftovers = items.value
    .filter((i) => !visited.has(i.itemKey))
    .sort((a, b) => a.itemKey - b.itemKey)
  for (const r of leftovers) {
    walkItemIntoDisplayRows(r, out, visited)
  }

  return out
})

/**
 * 依「變更後數量／單價」（無變更則沿用基底）重算整樹複價，與後端 rollup 一致；含手動掛載列。
 */
const revisedRollupMaps = computed(() => {
  const rows: PccesRollupPreviewRow[] = []
  const auto = matchedAuto.value
  for (const it of items.value) {
    const ex = auto.get(it.itemKey)
    const q = ex?.qtyRaw.trim() ? ex.qtyRaw : it.quantity
    const p = ex?.unitPriceRaw.trim() ? ex.unitPriceRaw : it.unitPrice
    rows.push({
      itemKey: it.itemKey,
      parentItemKey: it.parentItemKey,
      depth: it.depth,
      quantity: String(q),
      unitPrice: String(p),
      amountImported: null,
    })
  }
  let synthKey = -1
  const manualKeyById = new Map<string, number>()
  for (const mp of manualPlaced.value) {
    const parent = items.value.find((i) => i.itemKey === mp.parentItemKey)
    const depth = (parent?.depth ?? 0) + 1
    rows.push({
      itemKey: synthKey,
      parentItemKey: mp.parentItemKey,
      depth,
      quantity: mp.excel.qtyRaw.trim() || '0',
      unitPrice: mp.excel.unitPriceRaw.trim() || '0',
      amountImported: null,
    })
    manualKeyById.set(mp.id, synthKey)
    synthKey -= 1
  }
  applyPccesPreviewRollup(rows)
  const byItemKey = new Map<number, string>()
  const rowByKey = new Map(rows.map((r) => [r.itemKey, r]))
  for (const r of rows) {
    byItemKey.set(r.itemKey, r.amountImported ?? '0')
  }
  const byManualId = new Map<string, string>()
  for (const mp of manualPlaced.value) {
    const k = manualKeyById.get(mp.id)
    if (k != null) {
      byManualId.set(mp.id, rowByKey.get(k)?.amountImported ?? '0')
    }
  }
  return { byItemKey, byManualId }
})

function displayRevisedAmountForItem(itemKey: number): string {
  return formatEngineeringDecimal(revisedRollupMaps.value.byItemKey.get(itemKey))
}

function displayRevisedAmountForManual(manualId: string): string {
  return formatEngineeringDecimal(revisedRollupMaps.value.byManualId.get(manualId))
}

function revisedItemAmountDiffersFromOriginal(item: PccesItemDto): boolean {
  const rev = revisedRollupMaps.value.byItemKey.get(item.itemKey)
  if (rev == null) return false
  const a = parseLocaleNumber(rev)
  const b = parseLocaleNumber(item.amountImported)
  if (a === null || b === null) return false
  return Math.abs(a - b) > 1e-6
}

function getSiblingsForParent(parentKey: number): PccesItemDto[] {
  return items.value
    .filter((i) => i.parentItemKey === parentKey)
    .sort((a, b) => a.itemKey - b.itemKey)
}

function parseTrailingIntFromItemNo(itemNo: string): { value: number; digitWidth: number } | null {
  const t = itemNo.trim()
  const m = t.match(/(\d+)$/)
  if (!m) return null
  const digits = m[1]
  return { value: parseInt(digits, 10), digitWidth: digits.length }
}

/** 基底版工項中該父層下既有子列，加上已「手動掛載」列的項次尾碼（不含未對應清單） */
function collectNumericTailsForParent(parentKey: number): {
  maxVal: number
  width: number
  any: boolean
} {
  let maxVal = 0
  let width = 1
  let any = false
  const consider = (raw: string) => {
    const p = parseTrailingIntFromItemNo(raw)
    if (p) {
      any = true
      maxVal = Math.max(maxVal, p.value)
      width = Math.max(width, p.digitWidth)
    }
  }
  for (const s of getSiblingsForParent(parentKey)) consider(s.itemNo)
  for (const m of manualPlaced.value) {
    if (m.parentItemKey === parentKey) consider(m.assignedItemNo)
  }
  return { maxVal, width, any }
}

function maxTailConsideringUnmatched(
  parentKey: number,
  excludeUnmatchedId?: string
): { next: number; width: number; any: boolean } {
  const base = collectNumericTailsForParent(parentKey)
  let maxVal = base.maxVal
  let width = base.width
  let any = base.any
  for (const u of unmatchedRows.value) {
    if (u.selectedParentKey !== parentKey) continue
    if (excludeUnmatchedId && u.id === excludeUnmatchedId) continue
    const p = parseTrailingIntFromItemNo(u.assignedItemNo)
    if (p) {
      any = true
      maxVal = Math.max(maxVal, p.value)
      width = Math.max(width, p.digitWidth)
    }
  }
  return { next: any ? maxVal + 1 : 1, width, any }
}

function formatSequentialItemNo(n: number, width: number, usePadding: boolean): string {
  if (!usePadding) return String(n)
  return String(n).padStart(width, '0')
}

function applyDefaultAssignedItemNosToUnmatched() {
  const rows = unmatchedRows.value
  const byParent = new Map<number, UnmatchedRow[]>()
  for (const u of rows) {
    if (u.selectedParentKey == null) continue
    const list = byParent.get(u.selectedParentKey) ?? []
    list.push(u)
    byParent.set(u.selectedParentKey, list)
  }
  for (const [, group] of byParent) {
    if (group.length === 0) continue
    const parentKey = group[0].selectedParentKey
    if (parentKey == null) continue
    const { maxVal, width, any } = collectNumericTailsForParent(parentKey)
    let cursor = any ? maxVal + 1 : 1
    for (const u of group) {
      u.assignedItemNo = formatSequentialItemNo(cursor, width, any)
      cursor++
    }
  }
}

function onUnmatchedParentChange(u: UnmatchedRow, pk: number | null) {
  u.selectedParentKey = pk
  if (pk != null) {
    const { next, width, any } = maxTailConsideringUnmatched(pk, u.id)
    u.assignedItemNo = formatSequentialItemNo(next, width, any)
  } else {
    u.assignedItemNo = ''
  }
}

const versionsPath = computed(() =>
  buildProjectPath(projectId.value, ROUTE_PATH.PROJECT_CONSTRUCTION_PCCES_VERSIONS)
)

function resetParsedState() {
  matchedAuto.value = new Map()
  manualPlaced.value = []
  unmatchedRows.value = []
  excelFileName.value = ''
}

function toUnmatchedRows(rows: ExcelParsed[]): UnmatchedRow[] {
  const defaultParent = mainItemOptions.value[0]?.itemKey ?? null
  return rows.map((row) => ({
    ...row,
    id: randomRowId(),
    selectedParentKey: defaultParent,
    assignedItemNo: '',
  }))
}

function runAutoMatch(parsed: ExcelParsed[]) {
  if (leafItems.value.length === 0) {
    toast.error(
      '無葉節點工項可自動對應，已將 Excel 列全部列入「未對應清單」；請指定父層後手動加入。'
    )
    matchedAuto.value = new Map()
    unmatchedRows.value = toUnmatchedRows(parsed)
    applyDefaultAssignedItemNosToUnmatched()
    return
  }
  const idx = buildLeafMatchIndex(leafItems.value)
  const nextMap = new Map<number, ExcelParsed>()
  const unmatched: UnmatchedRow[] = []
  for (const row of parsed) {
    const hit = matchLeaf(row.description, idx)
    if (!hit) {
      unmatched.push({
        ...row,
        id: randomRowId(),
        selectedParentKey: mainItemOptions.value[0]?.itemKey ?? null,
        assignedItemNo: '',
      })
      continue
    }
    const prev = nextMap.get(hit.itemKey)
    nextMap.set(hit.itemKey, prev ? mergeExcelRows(prev, row) : row)
  }
  matchedAuto.value = nextMap
  unmatchedRows.value = unmatched
  applyDefaultAssignedItemNosToUnmatched()
}

async function loadBaseItems() {
  if (!projectId.value || !baseImportId.value) return
  loadingItems.value = true
  loadError.value = ''
  try {
    const res = await getPccesImportItems(projectId.value, baseImportId.value, { all: true })
    summaryVersion.value = res.import.version
    summaryFileName.value = res.import.fileName
    items.value = res.items
    resetParsedState()
  } catch {
    loadError.value = '無法載入基底匯入或該版本不存在。'
    items.value = []
    summaryVersion.value = null
    resetParsedState()
  } finally {
    loadingItems.value = false
  }
}

function onPickFile() {
  fileInputRef.value?.click()
}

async function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const lower = file.name.toLowerCase()
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
    toast.error('請上傳 .xlsx 或 .xls')
    return
  }
  try {
    const buf = await file.arrayBuffer()
    const parsed = parsePccesChangeWorkbook(buf)
    if (parsed.length === 0) {
      toast.error(
        '未讀到有效資料列：請確認任一分頁有表頭「項目名稱」（表頭列建議在前 200 列內），且「變更後數量」或「新增單價」至少一欄有值'
      )
      return
    }
    excelFileName.value = file.name
    manualPlaced.value = []
    runAutoMatch(parsed)
    const nAuto = matchedAuto.value.size
    const nUn = unmatchedRows.value.length

    console.log('[PCCES Excel 上傳]', {
      fileName: file.name,
      baseImportId: baseImportId.value,
      parsedCount: parsed.length,
      parsedRows: parsed,
      autoMatchedCount: nAuto,
      autoMatched: [...matchedAuto.value.entries()].map(([itemKey, excel]) => ({
        itemKey,
        ...excel,
      })),
      unmatchedCount: nUn,
      unmatchedRows: unmatchedRows.value.map((u) => ({
        description: u.description,
        itemNo: u.itemNo,
        assignedItemNo: u.assignedItemNo,
        unit: u.unit,
        qtyRaw: u.qtyRaw,
        unitPriceRaw: u.unitPriceRaw,
        selectedParentKey: u.selectedParentKey,
      })),
    })

    if (nUn > 0 && nAuto > 0) {
      toast.success(
        `已解析 ${parsed.length} 筆：${nAuto} 筆已自動對應、${nUn} 筆在未對應清單（請選父層後加入再確認匯入）`
      )
    } else if (nUn > 0 && nAuto === 0) {
      toast.success(
        `已解析 ${parsed.length} 筆，均未與既有工項名稱對應。請在未對應清單確認父層後按「全部加入」或逐筆「加入」，再按確認匯入。`
      )
    } else {
      toast.success(`已解析 ${parsed.length} 筆變更列`)
    }
  } catch (err: unknown) {
    console.error('[PCCES Excel] 讀取失敗', err)
    const msg =
      err instanceof Error && err.message ? err.message.replace(/\s+/g, ' ').slice(0, 120) : ''
    toast.error(msg ? `無法讀取 Excel：${msg}` : '無法讀取 Excel（檔案可能損毀、已加密或格式不符）')
  }
}

function toExcelAudit(e: ExcelParsed) {
  return {
    description: e.description,
    itemNo: e.itemNo.trim() || undefined,
    unit: e.unit.trim() || undefined,
    qtyRaw: e.qtyRaw.trim() || undefined,
    unitPriceRaw: e.unitPriceRaw.trim() || undefined,
    remark: e.remark.trim() || undefined,
  }
}

function unmatchedToExcelParsed(u: UnmatchedRow): ExcelParsed {
  return {
    itemNo: u.itemNo,
    description: u.description,
    unit: u.unit,
    qtyRaw: u.qtyRaw,
    unitPriceRaw: u.unitPriceRaw,
    remark: u.remark,
  }
}

function placeManual(row: UnmatchedRow) {
  if (row.selectedParentKey == null) {
    toast.error('請選擇指定父層（mainItem）')
    return
  }
  const no = row.assignedItemNo.trim() || row.itemNo.trim()
  if (!no) {
    toast.error('請填寫項次')
    return
  }
  manualPlaced.value = [
    ...manualPlaced.value,
    {
      id: row.id,
      parentItemKey: row.selectedParentKey,
      assignedItemNo: row.assignedItemNo.trim() || row.itemNo.trim(),
      excel: unmatchedToExcelParsed(row),
    },
  ]
  unmatchedRows.value = unmatchedRows.value.filter((u) => u.id !== row.id)
}

/** 將目前未對應列一次移入待匯入（新項目必做；沿用各列已選父層，未選則略過並提示） */
function placeAllUnmatched() {
  if (unmatchedRows.value.length === 0) return
  const added: ManualPlacedRow[] = []
  const remaining: UnmatchedRow[] = []
  let emptyItemNo = 0
  for (const u of unmatchedRows.value) {
    if (u.selectedParentKey == null) {
      remaining.push(u)
      continue
    }
    const no = u.assignedItemNo.trim() || u.itemNo.trim()
    if (!no) {
      emptyItemNo++
      remaining.push(u)
      continue
    }
    added.push({
      id: u.id,
      parentItemKey: u.selectedParentKey,
      assignedItemNo: no,
      excel: unmatchedToExcelParsed(u),
    })
  }
  if (added.length > 0) {
    manualPlaced.value = [...manualPlaced.value, ...added]
  }
  unmatchedRows.value = remaining
  if (added.length > 0) {
    toast.success(`已加入 ${added.length} 筆至待匯入（手動掛載）`)
  }
  const noParent = remaining.filter((u) => u.selectedParentKey == null).length
  if (noParent > 0) {
    toast.error(`有 ${noParent} 筆未選父層，請選擇 mainItem 後再試`)
  }
  if (emptyItemNo > 0) {
    toast.error(`有 ${emptyItemNo} 筆項次為空白，請填寫後再試`)
  }
}

function removeManual(m: ManualPlacedRow) {
  manualPlaced.value = manualPlaced.value.filter((x) => x.id !== m.id)
  unmatchedRows.value = [
    ...unmatchedRows.value,
    {
      ...m.excel,
      id: randomRowId(),
      selectedParentKey: m.parentItemKey,
      assignedItemNo: m.assignedItemNo,
    },
  ]
}

function highlightClass(has: boolean) {
  /* 變更欄高亮：需與底色對比，故使用半透明 amber */
  return has ? 'bg-amber-500/15 dark:bg-amber-400/10' : ''
}

async function onConfirmImport() {
  if (!projectId.value || !baseImportId.value) return
  if (!perm.canCreate.value) {
    toast.error('您沒有匯入權限')
    return
  }
  const vLabel = newVersionLabel.value.trim()
  if (!vLabel) {
    toast.error('請填寫「新版本名稱」')
    return
  }

  const autoMatched: PccesExcelApplyBody['autoMatched'] = []
  for (const [itemKey, excel] of matchedAuto.value) {
    const q = excel.qtyRaw.trim()
    const p = excel.unitPriceRaw.trim()
    if (!q && !p) continue
    autoMatched.push({
      itemKey,
      newQuantity: q || undefined,
      newUnitPrice: p || undefined,
      excel: toExcelAudit(excel),
    })
  }

  const perParentNos = new Map<number, Set<string>>()
  for (const m of manualPlaced.value) {
    const itemNo = (m.assignedItemNo.trim() || m.excel.itemNo.trim()).trim()
    if (!itemNo) {
      toast.error('手動掛載列中有項次為空白，請補齊後再確認匯入')
      return
    }
    if (
      items.value.some((i) => i.parentItemKey === m.parentItemKey && i.itemNo.trim() === itemNo)
    ) {
      toast.error(`項次「${itemNo}」在該父層下已存在於基底版，請改用其他項次`)
      return
    }
    const set = perParentNos.get(m.parentItemKey) ?? new Set<string>()
    if (set.has(itemNo)) {
      toast.error(`手動掛載中，同一父層下項次「${itemNo}」重複，請調整後再試`)
      return
    }
    set.add(itemNo)
    perParentNos.set(m.parentItemKey, set)
  }

  /** 與「對應結果」表相同：父列在 displayRows 中第一次出現的列序，供手動掛載列與畫面階層一致 */
  const parentRowOrder = new Map<number, number>()
  displayRows.value.forEach((row, idx) => {
    if (row.kind === 'item') parentRowOrder.set(row.item.itemKey, idx)
  })
  const manualOrdered = [...manualPlaced.value].sort((x, y) => {
    const ix = parentRowOrder.get(x.parentItemKey) ?? 1_000_000
    const iy = parentRowOrder.get(y.parentItemKey) ?? 1_000_000
    if (ix !== iy) return ix - iy
    return comparePccesItemNoSort(sortKeyManualItemNo(x), sortKeyManualItemNo(y))
  })

  const manuallyPlaced: PccesExcelApplyBody['manuallyPlaced'] = manualOrdered.map((m) => ({
    parentItemKey: m.parentItemKey,
    itemNo: m.assignedItemNo.trim() || m.excel.itemNo.trim() || '—',
    description: m.excel.description,
    unit: m.excel.unit.trim() || '—',
    quantity: m.excel.qtyRaw.trim() || '0',
    unitPrice: m.excel.unitPriceRaw.trim() || '0',
    remark: m.excel.remark.trim() || undefined,
    excel: toExcelAudit(m.excel),
  }))

  if (autoMatched.length === 0 && manuallyPlaced.length === 0) {
    if (unmatchedRows.value.length > 0) {
      toast.error(
        `尚有 ${unmatchedRows.value.length} 筆留在「未對應清單」：這些名稱與基底版葉節點對不到，不會自動寫入。請選 mainItem 父層後按「加入」或「全部加入未對應列」，再按確認匯入。`
      )
    } else {
      toast.error('沒有可匯入的項目（請上傳 Excel，或將未對應列加入後再確認）')
    }
    return
  }

  confirmLoading.value = true
  try {
    const body: PccesExcelApplyBody = {
      fileName: excelFileName.value.trim() || undefined,
      versionLabel: vLabel,
      autoMatched,
      manuallyPlaced,
    }
    const created = await applyPccesImportExcelChanges(projectId.value, baseImportId.value, body)
    toast.success(`已產生第 ${created.version} 版匯入`)
    await router.push({
      name: ROUTE_NAME.PROJECT_CONSTRUCTION_PCCES_VERSION_DETAIL,
      params: { projectId: projectId.value, importId: created.id },
    })
  } catch (e) {
    const msg = isAxiosError(e)
      ? (e.response?.data as { error?: { message?: string } })?.error?.message
      : null
    toast.error(msg ?? '確認匯入失敗')
  } finally {
    confirmLoading.value = false
  }
}

onMounted(() => loadBaseItems())
watch([projectId, baseImportId], () => loadBaseItems())
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" as-child>
          <RouterLink :to="versionsPath">返回匯入紀錄</RouterLink>
        </Button>
      </div>

      <div>
        <h1 class="text-xl font-semibold text-foreground">PCCES 施工項目變更（Excel）</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          解析結果僅暫存於此頁；離開或重新整理後需重新上傳。按下「確認匯入」後會複製基底版工項並套用變更，產生新版本（
          <code class="rounded bg-muted px-1 py-0.5 text-xs">excel_change</code>
          ）。活頁簿內所有工作表皆會讀入並合併（各表須有相同表頭欄名）。
        </p>
      </div>

      <div
        v-if="!baseImportId"
        class="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
      >
        請從
        <RouterLink :to="versionsPath" class="text-primary underline-offset-4 hover:underline">
          PCCES 匯入紀錄
        </RouterLink>
        選擇一版，點「Excel 變更」帶入
        <code class="rounded bg-muted px-1 py-0.5 text-xs">baseImportId</code>
        參數。
      </div>

      <template v-else>
        <div v-if="!perm.canRead.value" class="text-sm text-muted-foreground">
          您沒有 PCCES 檢視權限。
        </div>

        <template v-else>
          <div class="rounded-lg border border-border bg-card">
            <div
              class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
            >
              <div class="min-w-0 w-full max-w-md flex-1 space-y-2">
                <Label for="pcces-new-version-label">新版本名稱</Label>
                <Input
                  id="pcces-new-version-label"
                  v-model="newVersionLabel"
                  class="bg-background"
                  placeholder="請自訂此版名稱（例如：第一次契約變更）"
                  autocomplete="off"
                />
                <p class="text-xs text-muted-foreground">
                  確認匯入後會新增一版（Excel
                  變更）；名稱不預設，請自行填寫，之後可在匯入紀錄明細修改。
                </p>
              </div>
              <div class="flex shrink-0 flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  :disabled="confirmLoading || !perm.canCreate.value || loadingItems || !!loadError"
                  @click="onConfirmImport"
                >
                  <Loader2 v-if="confirmLoading" class="mr-2 size-4 animate-spin" />
                  確認匯入
                </Button>
              </div>
            </div>
          </div>

          <Card class="border-border bg-card">
            <CardHeader>
              <CardTitle class="text-lg">基底版本</CardTitle>
              <CardDescription>
                <span v-if="summaryVersion != null">
                  第 {{ summaryVersion }} 版 · {{ summaryFileName }}
                </span>
                <span v-else-if="loadingItems">載入中…</span>
                <span v-else>—</span>
              </CardDescription>
            </CardHeader>
            <CardContent class="flex flex-wrap items-end gap-4">
              <div class="space-y-2">
                <Label for="pcces-excel-file">變更清單 Excel</Label>
                <input
                  id="pcces-excel-file"
                  ref="fileInputRef"
                  type="file"
                  accept=".xlsx,.xls"
                  class="sr-only"
                  @change="onFileChange"
                />
                <Button
                  type="button"
                  variant="outline"
                  class="gap-2"
                  :disabled="loadingItems"
                  @click="onPickFile"
                >
                  <Upload class="size-4" />
                  選擇檔案
                </Button>
              </div>
              <p v-if="excelFileName" class="text-sm text-muted-foreground">
                已選：{{ excelFileName }}
              </p>
            </CardContent>
          </Card>

          <div v-if="loadingItems" class="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 class="size-4 animate-spin" />
            載入工項…
          </div>
          <p v-else-if="loadError" class="text-sm text-destructive">{{ loadError }}</p>

          <template v-else>
            <div class="rounded-lg border border-border bg-card">
              <div class="border-b border-border px-4 py-3">
                <h2 class="text-base font-medium text-foreground">未對應清單</h2>
                <p class="mt-1 text-xs text-muted-foreground">
                  與基底版葉節點名稱對不到的列會出現在這裡（代表 Excel
                  有、清冊尚無），不是程式錯誤。父層須為
                  <code class="rounded bg-muted px-1">mainItem</code>
                  ；加入後才會一併確認匯入。
                </p>
                <div v-if="unmatchedRows.length > 0" class="mt-3 flex flex-wrap items-center gap-3">
                  <Button type="button" size="sm" variant="secondary" @click="placeAllUnmatched">
                    全部加入未對應列
                  </Button>
                  <span class="text-xs text-muted-foreground">
                    已預設每列第一個 mainItem
                    為父層；項次接在該父層既有子工項之後遞增編號，可自行修改。可改選父層後再按「加入」或「全部加入」。
                  </span>
                </div>
              </div>
              <div
                v-if="unmatchedRows.length === 0"
                class="px-4 py-6 text-sm text-muted-foreground"
              >
                目前無未對應列。
              </div>
              <div v-else class="overflow-x-auto p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead class="min-w-[7rem]">項次</TableHead>
                      <TableHead>項目名稱</TableHead>
                      <TableHead class="w-24">單位</TableHead>
                      <TableHead class="w-28">變更後數量</TableHead>
                      <TableHead class="w-28">新增單價</TableHead>
                      <TableHead class="min-w-[12rem]">指定父層</TableHead>
                      <TableHead class="w-24 text-end">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="u in unmatchedRows" :key="u.id">
                      <TableCell class="min-w-[7rem]">
                        <Input
                          v-model="u.assignedItemNo"
                          class="h-8 font-mono text-sm tabular-nums"
                          placeholder="匯入項次"
                          autocomplete="off"
                        />
                      </TableCell>
                      <TableCell class="max-w-[16rem] line-clamp-2">{{ u.description }}</TableCell>
                      <TableCell>{{ u.unit || '—' }}</TableCell>
                      <TableCell class="tabular-nums">{{ u.qtyRaw || '—' }}</TableCell>
                      <TableCell class="tabular-nums">{{ u.unitPriceRaw || '—' }}</TableCell>
                      <TableCell>
                        <Select
                          :model-value="
                            u.selectedParentKey != null ? String(u.selectedParentKey) : ''
                          "
                          @update:model-value="
                            (v) => onUnmatchedParentChange(u, v ? Number(v) : null)
                          "
                        >
                          <SelectTrigger class="w-full min-w-[12rem]">
                            <SelectValue placeholder="選擇 mainItem" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="opt in mainItemOptions"
                              :key="opt.itemKey"
                              :value="String(opt.itemKey)"
                            >
                              {{ opt.itemNo }} · {{ opt.description.slice(0, 40)
                              }}{{ opt.description.length > 40 ? '…' : '' }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell class="text-end">
                        <Button type="button" size="sm" variant="secondary" @click="placeManual(u)">
                          加入
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <div class="rounded-lg border border-border bg-card">
              <div class="border-b border-border px-4 py-3">
                <h2 class="text-base font-medium text-foreground">對應結果（工項表）</h2>
                <p class="mt-1 text-xs text-muted-foreground">
                  <span class="text-foreground">列順序</span
                  >：依清冊階層（先父後子、深度優先），同層清冊列依
                  <code class="rounded bg-muted px-1">itemKey</code>
                  遞增；手動掛載列排在該父層清冊子列之後。親子以
                  <code class="rounded bg-muted px-1">parentItemKey</code>
                  為準（與後端 PCCES 工項樹一致）。變更後數量／單價以淡黃底標示；滑鼠暫留可見 Excel
                  原始字串。「變更後複價」為套用變更後數量／單價（未變更列沿用基底）再依階層加總之預覽，與確認匯入後後端
                  rollup 邏輯一致。
                </p>
              </div>
              <div class="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead class="w-24">項次</TableHead>
                      <TableHead>項目及說明</TableHead>
                      <TableHead class="w-20">單位</TableHead>
                      <TableHead class="w-28 text-end">數量</TableHead>
                      <TableHead class="w-28 text-end">單價</TableHead>
                      <TableHead class="w-28 text-end">複價</TableHead>
                      <TableHead class="w-32 text-end">變更後數量</TableHead>
                      <TableHead class="w-32 text-end">變更後單價</TableHead>
                      <TableHead class="w-32 text-end">變更後複價</TableHead>
                      <TableHead class="w-24">來源</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-if="displayRows.length === 0">
                      <TableCell colspan="10" class="text-center text-muted-foreground">
                        尚無資料；請上傳 Excel 或確認已載入基底工項。
                      </TableCell>
                    </TableRow>
                    <TableRow
                      v-for="row in displayRows"
                      :key="row.kind === 'item' ? `i-${row.item.itemKey}` : `m-${row.manual.id}`"
                    >
                      <template v-if="row.kind === 'item'">
                        <TableCell class="tabular-nums">{{ row.item.itemNo }}</TableCell>
                        <TableCell>
                          <span
                            class="line-clamp-2 max-w-[min(28rem,55vw)]"
                            :style="{ paddingLeft: `${Math.max(0, row.item.depth - 1) * 12}px` }"
                          >
                            {{ row.item.description }}
                          </span>
                        </TableCell>
                        <TableCell>{{ row.item.unit }}</TableCell>
                        <TableCell class="text-end tabular-nums">
                          {{ formatEngineeringDecimal(row.item.quantity) }}
                        </TableCell>
                        <TableCell class="text-end tabular-nums">
                          {{ formatEngineeringDecimal(row.item.unitPrice) }}
                        </TableCell>
                        <TableCell class="text-end tabular-nums text-muted-foreground">
                          {{ formatEngineeringDecimal(row.item.amountImported) }}
                        </TableCell>
                        <TableCell
                          class="text-end tabular-nums"
                          :class="
                            highlightClass(!!matchedAuto.get(row.item.itemKey)?.qtyRaw?.trim())
                          "
                        >
                          <Tooltip v-if="matchedAuto.get(row.item.itemKey)?.qtyRaw?.trim()">
                            <TooltipTrigger as-child>
                              <span class="block min-h-[1.25rem] cursor-default">
                                {{ matchedAuto.get(row.item.itemKey)?.qtyRaw?.trim() || '—' }}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Excel 原始：{{ matchedAuto.get(row.item.itemKey)?.qtyRaw }}
                            </TooltipContent>
                          </Tooltip>
                          <span v-else>—</span>
                        </TableCell>
                        <TableCell
                          class="text-end tabular-nums"
                          :class="
                            highlightClass(
                              !!matchedAuto.get(row.item.itemKey)?.unitPriceRaw?.trim()
                            )
                          "
                        >
                          <Tooltip v-if="matchedAuto.get(row.item.itemKey)?.unitPriceRaw?.trim()">
                            <TooltipTrigger as-child>
                              <span class="block min-h-[1.25rem] cursor-default">
                                {{ matchedAuto.get(row.item.itemKey)?.unitPriceRaw?.trim() || '—' }}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Excel 原始：{{ matchedAuto.get(row.item.itemKey)?.unitPriceRaw }}
                            </TooltipContent>
                          </Tooltip>
                          <span v-else>—</span>
                        </TableCell>
                        <TableCell
                          class="text-end tabular-nums"
                          :class="highlightClass(revisedItemAmountDiffersFromOriginal(row.item))"
                        >
                          {{ displayRevisedAmountForItem(row.item.itemKey) }}
                        </TableCell>
                        <TableCell class="text-xs text-muted-foreground">
                          {{ matchedAuto.has(row.item.itemKey) ? '自動' : '—' }}
                        </TableCell>
                      </template>
                      <template v-else>
                        <TableCell class="min-w-[6.5rem]">
                          <Input
                            v-model="row.manual.assignedItemNo"
                            class="h-8 font-mono text-sm tabular-nums"
                            autocomplete="off"
                          />
                        </TableCell>
                        <TableCell>
                          {{ row.manual.excel.description }}
                        </TableCell>
                        <TableCell>{{ row.manual.excel.unit }}</TableCell>
                        <TableCell class="text-end text-muted-foreground">—</TableCell>
                        <TableCell class="text-end text-muted-foreground">—</TableCell>
                        <TableCell class="text-end text-muted-foreground">—</TableCell>
                        <TableCell
                          class="text-end tabular-nums"
                          :class="highlightClass(!!row.manual.excel.qtyRaw.trim())"
                        >
                          <Tooltip v-if="row.manual.excel.qtyRaw.trim()">
                            <TooltipTrigger as-child>
                              <span class="block min-h-[1.25rem] cursor-default">
                                {{ row.manual.excel.qtyRaw }}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Excel 原始：{{ row.manual.excel.qtyRaw }}
                            </TooltipContent>
                          </Tooltip>
                          <span v-else>—</span>
                        </TableCell>
                        <TableCell
                          class="text-end tabular-nums"
                          :class="highlightClass(!!row.manual.excel.unitPriceRaw.trim())"
                        >
                          <Tooltip v-if="row.manual.excel.unitPriceRaw.trim()">
                            <TooltipTrigger as-child>
                              <span class="block min-h-[1.25rem] cursor-default">
                                {{ row.manual.excel.unitPriceRaw }}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Excel 原始：{{ row.manual.excel.unitPriceRaw }}
                            </TooltipContent>
                          </Tooltip>
                          <span v-else>—</span>
                        </TableCell>
                        <TableCell
                          class="text-end tabular-nums"
                          :class="
                            highlightClass(
                              !!row.manual.excel.qtyRaw.trim() ||
                                !!row.manual.excel.unitPriceRaw.trim()
                            )
                          "
                        >
                          {{ displayRevisedAmountForManual(row.manual.id) }}
                        </TableCell>
                        <TableCell class="text-xs text-muted-foreground">
                          <div class="flex flex-col gap-1">
                            <span>手動</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              class="h-7 px-2 text-xs"
                              @click="removeManual(row.manual)"
                            >
                              撤回
                            </Button>
                          </div>
                        </TableCell>
                      </template>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </template>
        </template>
      </template>
    </div>
  </TooltipProvider>
</template>
