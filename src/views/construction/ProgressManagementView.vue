<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check, Download, Loader2, Pencil, Plus, Upload } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ProgressUnifiedScurve from '@/components/construction/ProgressUnifiedScurve.vue'
import ProgressPlanUploadsListView from '@/views/construction/ProgressPlanUploadsListView.vue'
import type { ChangeMarker } from '@/components/construction/ProgressUnifiedScurve.vue'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { useThemeStore } from '@/stores/theme'
import { useProjectProgressDashboardStore } from '@/stores/projectProgressDashboard'
import {
  getProgressDashboard,
  createProgressPlanWithUpload,
  downloadProgressPlanExcelTemplate,
  putProgressPlanEntries,
  putProgressActuals,
} from '@/api/project-progress'
import type { ProgressPeriodDto, ProgressPlanSummaryDto } from '@/types/project-progress'
import {
  parseProgressPlanExcelBuffer,
  ProgressPlanExcelError,
  type ParsedProgressPlanRow,
} from '@/lib/progress-plan-excel'
import { getApiErrorMessage } from '@/lib/api-error'
import { cellWFromHostWidth, totalSvgWidth } from '@/lib/progress-scurve-layout'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => (route.params.projectId as string) ?? '')

const progressTab = computed({
  get(): 'current' | 'history' {
    return route.query.tab === 'history' ? 'history' : 'current'
  },
  set(v: string | number) {
    const next = String(v) === 'history' ? 'history' : 'current'
    const q = { ...route.query }
    if (next === 'history') q.tab = 'history'
    else delete q.tab
    void router.replace({ query: q })
  },
})
const perm = useProjectModuleActions(projectId, 'construction.progress')
const themeStore = useThemeStore()

const progressScrollHostRef = ref<HTMLElement | null>(null)
const hostWidth = ref(0)
let progressResizeObserver: ResizeObserver | null = null

function updateProgressHostWidth() {
  const el = progressScrollHostRef.value
  hostWidth.value = el?.clientWidth ?? 0
}

const loading = ref(true)
const progressDashStore = useProjectProgressDashboardStore()
const dashboard = computed(() => {
  const id = projectId.value
  if (!id) return null
  return progressDashStore.dashboards[id] ?? null
})
const primaryPlanId = ref<string>('')
const comparePlanId = ref<string>('__none__')

/** 預設「目前版本」：版本號最大者（與後端未帶 primary 時優先 baseline 不同） */
function latestPlanId(plans: ProgressPlanSummaryDto[]): string | null {
  if (!plans.length) return null
  let best = plans[0]!
  for (let i = 1; i < plans.length; i++) {
    const p = plans[i]!
    if (p.version > best.version) best = p
  }
  return best.id
}

const plannedDraft = ref<Record<string, string>>({})
const actualDraft = ref<Record<string, string>>({})

const changeDialogOpen = ref(false)
const newVersionLabel = ref('')
const downloadingProgressTemplate = ref(false)
const changeUploading = ref(false)
const changeFileInputRef = ref<HTMLInputElement | null>(null)
const changeSelectedFileName = ref('')
const changeParsedRows = ref<ParsedProgressPlanRow[] | null>(null)
const changePendingFile = ref<File | null>(null)
const changePendingBuf = ref<ArrayBuffer | null>(null)
const changeEffectiveDate = ref('')

const baselineDialogOpen = ref(false)
const baselinePlanLabel = ref('原始計畫')
const baselineUploading = ref(false)
const baselineFileInputRef = ref<HTMLInputElement | null>(null)
const baselineSelectedFileName = ref('')
const baselineParsedRows = ref<ParsedProgressPlanRow[] | null>(null)
const baselinePendingFile = ref<File | null>(null)
const baselinePendingBuf = ref<ArrayBuffer | null>(null)
const baselineEffectiveDate = ref('')

const scurveTheme = ref({
  grid: 'oklch(0 0 0 / 12%)',
  axis: 'oklch(0.556 0 0)',
  headerBg: 'oklch(0 0 0 / 6%)',
  tableLabelBg: 'oklch(1 0 0)',
  border: 'oklch(0 0 0 / 12%)',
  extendedColumnBg: 'color-mix(in oklch, var(--chart-4) 12%, transparent)',
  todayColumnBg: 'color-mix(in oklch, var(--chart-1) 12%, transparent)',
  foreground: 'oklch(0.2 0 0)',
  mutedForeground: 'oklch(0.556 0 0)',
  actualStroke: 'oklch(0.6 0.118 184.704)',
  markerStroke: 'oklch(0.646 0.222 41.116)',
  todayLine: 'oklch(0.577 0.245 27.325)',
  pointRing: 'oklch(1 0 0)',
})

const curveStrokes = ref<string[]>([])

function refreshScurveVisuals() {
  const root = document.documentElement
  const s = getComputedStyle(root)
  scurveTheme.value = {
    grid: s.getPropertyValue('--border').trim() || scurveTheme.value.grid,
    axis: s.getPropertyValue('--muted-foreground').trim() || scurveTheme.value.axis,
    headerBg: s.getPropertyValue('--muted').trim() || scurveTheme.value.headerBg,
    tableLabelBg: s.getPropertyValue('--card').trim() || scurveTheme.value.tableLabelBg,
    border: s.getPropertyValue('--border').trim() || scurveTheme.value.border,
    extendedColumnBg: 'color-mix(in oklch, var(--chart-4) 12%, transparent)',
    todayColumnBg: 'color-mix(in oklch, var(--chart-1) 12%, transparent)',
    foreground: s.getPropertyValue('--foreground').trim() || scurveTheme.value.foreground,
    mutedForeground:
      s.getPropertyValue('--muted-foreground').trim() || scurveTheme.value.mutedForeground,
    actualStroke: s.getPropertyValue('--chart-2').trim() || scurveTheme.value.actualStroke,
    markerStroke: s.getPropertyValue('--chart-3').trim() || scurveTheme.value.markerStroke,
    todayLine: s.getPropertyValue('--destructive').trim() || scurveTheme.value.todayLine,
    pointRing: s.getPropertyValue('--background').trim() || scurveTheme.value.pointRing,
  }
}

function refreshCurveStrokes() {
  const curves = dashboard.value?.planCurves ?? []
  const root = document.documentElement
  const s = getComputedStyle(root)
  const palette = [
    s.getPropertyValue('--chart-1').trim(),
    s.getPropertyValue('--chart-2').trim(),
    s.getPropertyValue('--chart-3').trim(),
    s.getPropertyValue('--chart-4').trim(),
    s.getPropertyValue('--chart-5').trim(),
  ]
  const muted = s.getPropertyValue('--muted-foreground').trim() || 'oklch(0.556 0 0)'
  curveStrokes.value = curves.map((c) => {
    if (c.isBaseline) return muted
    const i = Math.max(0, c.version - 1) % palette.length
    return palette[i] || muted
  })
}

watch(
  () => themeStore.isDark,
  () => {
    requestAnimationFrame(() => {
      refreshScurveVisuals()
      refreshCurveStrokes()
    })
  }
)

watch(
  () => dashboard.value?.planCurves,
  () => {
    requestAnimationFrame(refreshCurveStrokes)
  },
  { deep: true }
)

const periods = computed(() => dashboard.value?.periods ?? [])

const cellW = computed(() => cellWFromHostWidth(hostWidth.value, periods.value.length))

const progressGridMinWidth = computed(() => totalSvgWidth(periods.value.length, cellW.value))

const primaryMeta = computed(() =>
  dashboard.value?.plans.find(
    (p) => p.id === (primaryPlanId.value || dashboard.value?.primaryPlanId)
  )
)

const primaryIsBaseline = computed(() => primaryMeta.value?.isBaseline === true)

/** 按下「編輯進度值」後才開啟底表輸入（仍須具 update 權限） */
const progressValuesEditMode = ref(false)
const progressSaveBusy = ref(false)

const scurveCanUpdatePlanned = computed(
  () => Boolean(perm.canUpdate.value) && !primaryIsBaseline.value && progressValuesEditMode.value
)

const scurveCanUpdateActual = computed(
  () => Boolean(perm.canUpdate.value) && progressValuesEditMode.value
)

function shortDate(iso: string) {
  const p = iso.split('-')
  if (p.length < 3) return iso
  return `${p[1]}-${p[2]}`
}

/** 以已讀取的 buffer 組新 File，避免先 arrayBuffer() 再送同一個 File 時部分瀏覽器上傳為空 */
function fileFromBuffer(buf: ArrayBuffer, source: File): File {
  const type = source.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return new File([buf], source.name, { type })
}

function parsePct(s: string): number | null {
  const t = s.trim()
  if (t === '' || t === '—') return null
  const n = Number(t.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** 累計預定：沿用後端（Excel 上傳之 cumulativeProgress；無則後端依本期加總），不因編輯本期而在前端重算 */
const displayCumulativePlanned = computed(() => periods.value.map((p) => p.cumulativePlanned))

const cumulativeActualDraft = ref<Record<string, string>>({})

/** 累計實際：手填草稿（圖表與底表與後端 cumulativeActual 同步） */
const displayCumulativeActual = computed(() =>
  periods.value.map((p) => cumulativeActualDraft.value[p.periodDate] ?? '')
)

const curveYValues = computed(() => {
  const curves = dashboard.value?.planCurves ?? []
  const activeId = primaryPlanId.value || dashboard.value?.primaryPlanId || ''
  return curves.map((c) =>
    periods.value.map((_, i) => {
      if (c.planId === activeId) return displayCumulativePlanned.value[i] ?? '0'
      const v = c.cumulativePlanned[i]
      return v != null && v !== '' ? v : '0'
    })
  )
})

/** 圖表曲線：僅「目前版本」＋「比較顯示」（未選比較或與目前相同則只畫一條） */
const chartPlanCurves = computed(() => {
  const full = dashboard.value?.planCurves ?? []
  const activeId = primaryPlanId.value || dashboard.value?.primaryPlanId || ''
  let cmp = comparePlanId.value !== '__none__' && comparePlanId.value ? comparePlanId.value : ''
  if (cmp === activeId) cmp = ''
  const ids = new Set<string>()
  if (activeId) ids.add(activeId)
  if (cmp) ids.add(cmp)
  const filtered = full.filter((c) => ids.has(c.planId))
  return [...filtered].sort((a, b) => a.version - b.version)
})

const chartCurveYValues = computed(() => {
  const full = dashboard.value?.planCurves ?? []
  return chartPlanCurves.value.map((c) => {
    const idx = full.findIndex((x) => x.planId === c.planId)
    return idx >= 0 ? curveYValues.value[idx]! : []
  })
})

const chartCurveStrokes = computed(() => {
  const full = dashboard.value?.planCurves ?? []
  const muted = scurveTheme.value.mutedForeground
  return chartPlanCurves.value.map((c) => {
    const idx = full.findIndex((x) => x.planId === c.planId)
    const st = idx >= 0 ? curveStrokes.value[idx] : ''
    return st && st.length > 0 ? st : muted
  })
})

function patchPlannedDraft(periodDate: string, value: string) {
  plannedDraft.value = { ...plannedDraft.value, [periodDate]: value }
}

function patchActualDraft(periodDate: string, value: string) {
  actualDraft.value = { ...actualDraft.value, [periodDate]: value }
}

function patchCumulativeActualDraft(periodDate: string, value: string) {
  cumulativeActualDraft.value = { ...cumulativeActualDraft.value, [periodDate]: value }
}

function syncDraftsFromPeriods(list: ProgressPeriodDto[]) {
  const pd: Record<string, string> = {}
  const ad: Record<string, string> = {}
  const cad: Record<string, string> = {}
  for (const p of list) {
    pd[p.periodDate] = p.periodPlanned ?? ''
    ad[p.periodDate] = p.periodActual ?? ''
    cad[p.periodDate] = p.cumulativeActual ?? ''
  }
  plannedDraft.value = pd
  actualDraft.value = ad
  cumulativeActualDraft.value = cad
}

async function load() {
  if (!projectId.value) return
  loading.value = true
  try {
    const effPrimary = primaryPlanId.value || undefined
    let cmp =
      comparePlanId.value && comparePlanId.value !== '__none__' ? comparePlanId.value : undefined
    if (cmp && effPrimary && cmp === effPrimary) cmp = undefined

    const d = await getProgressDashboard(projectId.value, {
      primaryPlanId: effPrimary,
      comparePlanId: cmp,
    })
    progressDashStore.setDashboard(projectId.value, { ...d, planCurves: d.planCurves ?? [] })
    if (!primaryPlanId.value && d.plans.length > 0) {
      const want = latestPlanId(d.plans)
      if (want) {
        primaryPlanId.value = want
        if (want !== d.primaryPlanId) {
          await load()
          return
        }
      }
    }
    syncDraftsFromPeriods(d.periods)
    requestAnimationFrame(() => {
      refreshScurveVisuals()
      refreshCurveStrokes()
    })
  } catch {
    progressDashStore.clearDashboard(projectId.value)
    toast.error('無法載入進度資料')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshScurveVisuals()
  refreshCurveStrokes()
  void load()
})

watch(projectId, (id, prev) => {
  if (!id || prev === undefined) return
  primaryPlanId.value = ''
  comparePlanId.value = '__none__'
  progressValuesEditMode.value = false
  void load()
})

watch(loading, async (busy) => {
  if (busy) return
  await nextTick()
  setupProgressResizeObserver()
})

onUnmounted(() => {
  progressResizeObserver?.disconnect()
  progressResizeObserver = null
})

function onPrimaryPlanChange(v: unknown) {
  if (typeof v !== 'string') return
  primaryPlanId.value = v
  progressValuesEditMode.value = false
  load()
}

function onComparePlanChange(v: unknown) {
  if (typeof v !== 'string') return
  comparePlanId.value = v
  load()
}

function resetBaselineWizard() {
  baselineParsedRows.value = null
  baselinePendingFile.value = null
  baselinePendingBuf.value = null
  baselineEffectiveDate.value = ''
  baselineSelectedFileName.value = ''
}

function resetChangeWizard() {
  changeParsedRows.value = null
  changePendingFile.value = null
  changePendingBuf.value = null
  changeEffectiveDate.value = ''
  changeSelectedFileName.value = ''
}

watch(baselineDialogOpen, (open) => {
  if (!open) resetBaselineWizard()
})

watch(changeDialogOpen, (open) => {
  if (!open) resetChangeWizard()
})

function openBaselineDialog() {
  resetBaselineWizard()
  baselinePlanLabel.value = '原始計畫'
  baselineDialogOpen.value = true
}

function triggerBaselineFilePick() {
  baselineFileInputRef.value?.click()
}

function onBaselineFileInputChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  baselineSelectedFileName.value = file?.name ?? ''
  if (!file || !projectId.value || !perm.canCreate.value) return
  void (async () => {
    try {
      const buf = await file.arrayBuffer()
      const rows = parseProgressPlanExcelBuffer(buf)
      if (!rows.length) {
        toast.error('Excel 無有效資料列')
        return
      }
      baselinePendingBuf.value = buf
      baselinePendingFile.value = file
      baselineParsedRows.value = rows
      baselineEffectiveDate.value = rows[0]!.periodDate
    } catch (e) {
      if (e instanceof ProgressPlanExcelError) {
        toast.error(e.message)
      } else {
        toast.error('無法解析 Excel', { description: getApiErrorMessage(e) })
      }
    }
  })()
}

async function submitBaselineConfirm() {
  if (!projectId.value || !perm.canCreate.value) return
  const rows = baselineParsedRows.value
  const buf = baselinePendingBuf.value
  const file = baselinePendingFile.value
  if (!rows?.length || !buf || !file) {
    toast.error('請先選擇 Excel')
    return
  }
  const effDate = baselineEffectiveDate.value
  const effRow = rows.find((r) => r.periodDate === effDate)
  if (!effRow) {
    toast.error('請選擇計畫／變更生效日期')
    return
  }
  const label = baselinePlanLabel.value.trim() || '原始計畫'
  baselineUploading.value = true
  try {
    await createProgressPlanWithUpload(
      projectId.value,
      {
        label,
        isBaseline: true,
        effectiveFromDate: effRow.periodDate,
        effectiveFromIdx: effRow.periodIndex,
        entries: rows.map((r) => ({
          periodDate: r.periodDate,
          periodIndex: r.periodIndex,
          periodProgress: r.periodProgress,
          cumulativeProgress: r.cumulativeProgress ?? null,
        })),
      },
      fileFromBuffer(buf, file)
    )
    toast.success('已自 Excel 建立原始計畫')
    baselineDialogOpen.value = false
    primaryPlanId.value = ''
    await load()
  } catch (e) {
    if (e instanceof ProgressPlanExcelError) {
      toast.error(e.message)
    } else {
      toast.error('無法建立原始計畫', { description: getApiErrorMessage(e) })
    }
  } finally {
    baselineUploading.value = false
  }
}

async function savePlanned() {
  if (!perm.canUpdate.value || !projectId.value || primaryIsBaseline.value) return
  const pid = primaryPlanId.value || dashboard.value?.primaryPlanId
  if (!pid) return
  progressSaveBusy.value = true
  try {
    await putProgressPlanEntries(projectId.value, pid, {
      entries: periods.value.map((p) => ({
        periodDate: p.periodDate,
        periodIndex: p.periodIndex,
        periodProgress: parsePct(plannedDraft.value[p.periodDate] ?? ''),
        isLocked: p.isLocked,
        isExtended: p.isExtended,
      })),
    })
    progressDashStore.applySavedPlanned(projectId.value, plannedDraft.value)
  } catch {
    toast.error('儲存計畫失敗')
  } finally {
    progressSaveBusy.value = false
  }
}

async function saveActuals() {
  if (!perm.canUpdate.value || !projectId.value) return
  progressSaveBusy.value = true
  try {
    await putProgressActuals(projectId.value, {
      rows: periods.value.map((p) => ({
        periodDate: p.periodDate,
        periodIndex: p.periodIndex,
        periodProgressPercent: parsePct(actualDraft.value[p.periodDate] ?? ''),
        cumulativeProgressPercent: parsePct(cumulativeActualDraft.value[p.periodDate] ?? ''),
      })),
    })
    progressDashStore.applySavedActuals(
      projectId.value,
      actualDraft.value,
      cumulativeActualDraft.value
    )
  } catch {
    toast.error('儲存實際進度失敗')
  } finally {
    progressSaveBusy.value = false
  }
}

function openChangeDialog() {
  resetChangeWizard()
  newVersionLabel.value = `第 ${(dashboard.value?.plans.length ?? 0) + 1} 次變更`
  changeDialogOpen.value = true
}

async function downloadProgressTemplateFile() {
  if (!projectId.value || downloadingProgressTemplate.value || !perm.canRead.value) return
  downloadingProgressTemplate.value = true
  try {
    await downloadProgressPlanExcelTemplate(projectId.value)
    toast.success('已下載樣板')
  } catch (e) {
    toast.error('下載樣板失敗', { description: getApiErrorMessage(e) })
  } finally {
    downloadingProgressTemplate.value = false
  }
}

function triggerChangeFilePick() {
  if (!newVersionLabel.value.trim()) {
    toast.error('請先填寫版本名稱')
    return
  }
  changeFileInputRef.value?.click()
}

function onChangeFileInputChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  changeSelectedFileName.value = file?.name ?? ''
  if (!file || !projectId.value || !perm.canCreate.value) return
  void (async () => {
    try {
      const buf = await file.arrayBuffer()
      const rows = parseProgressPlanExcelBuffer(buf)
      if (!rows.length) {
        toast.error('Excel 無有效資料列')
        return
      }
      changePendingBuf.value = buf
      changePendingFile.value = file
      changeParsedRows.value = rows
      changeEffectiveDate.value = rows[0]!.periodDate
    } catch (e) {
      if (e instanceof ProgressPlanExcelError) {
        toast.error(e.message)
      } else {
        toast.error('無法解析 Excel', { description: getApiErrorMessage(e) })
      }
    }
  })()
}

async function submitChangeConfirm() {
  if (!projectId.value || !perm.canCreate.value) return
  const label = newVersionLabel.value.trim()
  if (!label) {
    toast.error('請輸入版本名稱')
    return
  }
  const rows = changeParsedRows.value
  const buf = changePendingBuf.value
  const file = changePendingFile.value
  if (!rows?.length || !buf || !file) {
    toast.error('請先選擇 Excel')
    return
  }
  const effRow = rows.find((r) => r.periodDate === changeEffectiveDate.value)
  if (!effRow) {
    toast.error('請選擇變更生效日期')
    return
  }
  changeUploading.value = true
  try {
    const created = await createProgressPlanWithUpload(
      projectId.value,
      {
        label,
        isBaseline: false,
        effectiveFromDate: effRow.periodDate,
        effectiveFromIdx: effRow.periodIndex,
        entries: rows.map((r) => ({
          periodDate: r.periodDate,
          periodIndex: r.periodIndex,
          periodProgress: r.periodProgress,
          cumulativeProgress: r.cumulativeProgress ?? null,
        })),
      },
      fileFromBuffer(buf, file)
    )
    changeDialogOpen.value = false
    toast.success('已上傳 Excel 並建立變更版本')
    primaryPlanId.value = created.id
    comparePlanId.value = '__none__'
    await load()
  } catch (e) {
    if (e instanceof ProgressPlanExcelError) {
      toast.error(e.message)
    } else {
      toast.error('無法建立變更版本', { description: getApiErrorMessage(e) })
    }
  } finally {
    changeUploading.value = false
  }
}

const planSelectItems = computed(() => dashboard.value?.plans ?? [])

const compareSelectItems = computed(() => [
  { id: '__none__', label: '無' },
  ...planSelectItems.value.map((p) => ({
    id: p.id,
    label: `${p.label}（v${p.version}）`,
  })),
])

/** 非原始計畫之生效週期：對應後端 effectiveFromDate／effectiveFromIdx，供圖表垂直標記 */
const changeMarkers = computed((): ChangeMarker[] => {
  const d = dashboard.value
  if (!d?.plans?.length || !periods.value.length) return []
  const dateToIdx = new Map(periods.value.map((p, i) => [p.periodDate, i]))
  const out: ChangeMarker[] = []
  for (const plan of d.plans) {
    if (plan.isBaseline) continue
    let idx = dateToIdx.get(plan.effectiveFromDate)
    if (idx === undefined) idx = plan.effectiveFromIdx
    idx = Math.max(0, Math.min(periods.value.length - 1, idx))
    out.push({ index: idx, label: `${plan.label}（v${plan.version}）` })
  }
  return out.sort((a, b) => a.index - b.index || a.label.localeCompare(b.label))
})

function setupProgressResizeObserver() {
  updateProgressHostWidth()
  progressResizeObserver?.disconnect()
  progressResizeObserver = null
  const el = progressScrollHostRef.value
  if (!el || typeof ResizeObserver === 'undefined') return
  progressResizeObserver = new ResizeObserver(() => updateProgressHostWidth())
  progressResizeObserver.observe(el)
}

/** 分頁隱藏時捲動容器寬度為 0，切回「當前進度」後須重測，否則進度表欄寬不會貼齊頁寬 */
function remeasureProgressHostAfterTabShow() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      updateProgressHostWidth()
      setupProgressResizeObserver()
    })
  })
}

watch(progressTab, async (tab) => {
  if (tab !== 'current') return
  await nextTick()
  remeasureProgressHostAfterTabShow()
})

</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-xl font-semibold tracking-tight text-foreground">進度管理</h1>
    </div>

    <Tabs v-model="progressTab">
      <TabsList class="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="current">當前進度</TabsTrigger>
        <TabsTrigger value="history">歷史紀錄</TabsTrigger>
      </TabsList>

      <TabsContent value="current" class="mt-4 space-y-6">
        <p class="text-sm text-muted-foreground">
          原始計畫與每次變更皆需上傳 Excel，並於確認前<strong class="text-foreground"
            >選擇生效日期</strong
          >。進度表為<strong class="text-foreground">單一 SVG</strong>；<strong
            class="text-foreground"
            >S 曲線僅顯示上方「目前版本」與「比較顯示」所選計畫</strong
          >（未選比較則只畫目前版本）。變更版本之<strong class="text-foreground"
            >累計預定以上傳 Excel 為準</strong
          >，編輯本期後圖表與累計列仍顯示該筆資料（不另依本期加總）。<strong class="text-foreground"
            >本期實際與累計實際皆為手填</strong
          >，可編輯欄依權限而定。欄位較多時可左右捲動。上傳檔案列表請至「歷史紀錄」分頁。
        </p>

        <div
          v-if="loading"
          class="flex items-center justify-center rounded-lg border border-border bg-card py-12 text-muted-foreground"
        >
          <Loader2 class="size-8 animate-spin" />
        </div>

        <template v-else>
          <div
            v-if="!dashboard?.plans?.length && perm.canCreate"
            class="rounded-lg border border-border bg-card p-8 text-center"
          >
            <p class="text-sm text-muted-foreground">
              尚無計畫版本。請上傳 Excel（第一個工作表：日期、本期預定 %、累計預定 %
              可選）建立原始計畫。
            </p>
            <div class="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Button
                v-if="perm.canRead"
                variant="outline"
                :disabled="downloadingProgressTemplate"
                @click="downloadProgressTemplateFile"
              >
                <Download class="size-4" />
                {{ downloadingProgressTemplate ? '下載中…' : '下載 Excel 樣板' }}
              </Button>
              <Button @click="openBaselineDialog">
                <Upload class="size-4" />
                上傳 Excel 建立原始計畫
              </Button>
            </div>
          </div>

          <div
            v-else-if="!dashboard?.plans?.length"
            class="rounded-lg border border-border bg-card p-8 text-center"
          >
            <p class="text-sm text-muted-foreground">尚無資料，且您沒有建立權限。</p>
            <Button
              v-if="perm.canRead"
              variant="outline"
              class="mt-4"
              :disabled="downloadingProgressTemplate"
              @click="downloadProgressTemplateFile"
            >
              <Download class="size-4" />
              {{ downloadingProgressTemplate ? '下載中…' : '下載 Excel 樣板' }}
            </Button>
          </div>

          <div v-else class="space-y-4">
            <div class="flex flex-wrap items-center justify-end gap-3">
              <Button
                v-if="perm.canRead"
                variant="outline"
                :disabled="downloadingProgressTemplate"
                @click="downloadProgressTemplateFile"
              >
                <Download class="size-4" />
                {{ downloadingProgressTemplate ? '下載中…' : '下載 Excel 樣板' }}
              </Button>
              <Button
                v-if="perm.canCreate"
                :disabled="!dashboard?.primaryPlanId"
                @click="openChangeDialog"
              >
                <Plus class="size-4" />
                新增變更時間點
              </Button>
            </div>

            <div class="flex flex-wrap items-end gap-4">
              <div class="space-y-1.5">
                <Label class="text-muted-foreground">目前版本</Label>
                <Select :model-value="primaryPlanId" @update:model-value="onPrimaryPlanChange">
                  <SelectTrigger class="w-[220px] border-border bg-background">
                    <SelectValue placeholder="選擇版本" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="p in planSelectItems" :key="p.id" :value="p.id">
                      {{ p.label }}（v{{ p.version }}）{{ p.isBaseline ? ' · 原始' : '' }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-1.5">
                <Label class="text-muted-foreground">比較顯示</Label>
                <Select :model-value="comparePlanId" @update:model-value="onComparePlanChange">
                  <SelectTrigger class="w-[240px] border-border bg-background">
                    <SelectValue placeholder="無" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="p in compareSelectItems" :key="p.id" :value="p.id">
                      {{ p.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="ms-auto flex flex-wrap items-end justify-end gap-2 pb-0.5">
                <template v-if="progressValuesEditMode && perm.canUpdate && periods.length > 0">
                  <Button
                    v-if="!primaryIsBaseline"
                    type="button"
                    variant="outline"
                    :disabled="progressSaveBusy"
                    @click="savePlanned"
                  >
                    儲存本期預定
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    :disabled="progressSaveBusy"
                    @click="saveActuals"
                  >
                    儲存實際進度
                  </Button>
                </template>
                <Button
                  v-if="perm.canUpdate && periods.length > 0"
                  type="button"
                  :variant="progressValuesEditMode ? 'default' : 'outline'"
                  :disabled="progressSaveBusy"
                  @click="progressValuesEditMode = !progressValuesEditMode"
                >
                  <Pencil v-if="!progressValuesEditMode" class="size-4" />
                  <Check v-else class="size-4" />
                  {{ progressValuesEditMode ? '完成編輯' : '編輯進度值' }}
                </Button>
              </div>
            </div>

            <div ref="progressScrollHostRef" class="w-full max-w-full overflow-x-auto">
              <div class="inline-block" :style="{ minWidth: `${progressGridMinWidth}px` }">
                <ProgressUnifiedScurve
                  v-if="dashboard && periods.length > 0"
                  :host-width="hostWidth"
                  :periods="periods"
                  :plan-curves="chartPlanCurves"
                  :curve-y-values="chartCurveYValues"
                  :curve-strokes="chartCurveStrokes"
                  :active-plan-id="primaryPlanId || dashboard.primaryPlanId || ''"
                  :compare-plan-id="comparePlanId === '__none__' ? '' : comparePlanId"
                  :display-cumulative-actual="displayCumulativeActual"
                  :change-markers="changeMarkers"
                  :primary-is-baseline="primaryIsBaseline"
                  :perm-can-update-planned="scurveCanUpdatePlanned"
                  :perm-can-update-actual="scurveCanUpdateActual"
                  :planned-draft="plannedDraft"
                  :actual-draft="actualDraft"
                  :cumulative-actual-draft="cumulativeActualDraft"
                  v-bind="scurveTheme"
                  @update:planned-draft="patchPlannedDraft"
                  @update:actual-draft="patchActualDraft"
                  @update:cumulative-actual-draft="patchCumulativeActualDraft"
                />
              </div>
            </div>
          </div>
        </template>
      </TabsContent>

      <TabsContent value="history" class="mt-4">
        <ProgressPlanUploadsListView embedded />
      </TabsContent>
    </Tabs>

    <Dialog v-model:open="baselineDialogOpen">
      <DialogContent class="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>上傳 Excel 建立原始計畫</DialogTitle>
        </DialogHeader>
        <div class="space-y-3 py-2 text-sm text-muted-foreground">
          <p>
            請使用<strong class="text-foreground">第一個工作表</strong>，欄位順序：
            <span class="text-foreground">時間區間（日期）</span>、
            <span class="text-foreground">預定進度（本期 %）</span>、
            <span class="text-foreground">累計預定進度（%）</span
            >（可省略；若無本期則由累計差分推算）。
          </p>
          <p>第一列可為表頭（含「日期」「時間」等字樣時會自動略過）。</p>
        </div>
        <div class="space-y-2">
          <Label for="baseline-label">版本名稱</Label>
          <Input
            id="baseline-label"
            v-model="baselinePlanLabel"
            class="border-border bg-background"
            placeholder="原始計畫"
          />
        </div>
        <input
          ref="baselineFileInputRef"
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          class="sr-only"
          @change="onBaselineFileInputChange"
        />
        <div class="flex flex-wrap items-center gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            :disabled="baselineUploading"
            @click="triggerBaselineFilePick"
          >
            <Upload class="size-4" />
            選擇檔案
          </Button>
          <span v-if="baselineSelectedFileName" class="text-xs text-muted-foreground">{{
            baselineSelectedFileName
          }}</span>
        </div>
        <div v-if="baselineParsedRows?.length" class="space-y-2 pt-3">
          <Label>計畫生效日期（對應 Excel 時間區間）</Label>
          <Select v-model="baselineEffectiveDate">
            <SelectTrigger class="w-full border-border bg-background">
              <SelectValue placeholder="選擇日期" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="r in baselineParsedRows" :key="r.periodDate" :value="r.periodDate">
                {{ r.periodDate }}（{{ shortDate(r.periodDate) }}）
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button
            variant="outline"
            :disabled="baselineUploading"
            @click="baselineDialogOpen = false"
          >
            取消
          </Button>
          <Button
            :disabled="baselineUploading || !baselineParsedRows?.length"
            @click="submitBaselineConfirm"
          >
            確認建立
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="changeDialogOpen">
      <DialogContent class="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新增變更時間點</DialogTitle>
        </DialogHeader>
        <div class="space-y-3 py-2 text-sm text-muted-foreground">
          <p>
            請上傳與原始計畫<strong class="text-foreground">相同格式</strong>之
            Excel（第一個工作表：日期、本期預定 %、累計預定 % 可選）。
          </p>
          <p>第一列可為表頭（含「日期」「時間」等字樣時會自動略過）。</p>
        </div>
        <div class="space-y-2">
          <Label for="pv-label">版本名稱</Label>
          <Input
            id="pv-label"
            v-model="newVersionLabel"
            class="border-border bg-background"
            placeholder="例如：第一次變更"
          />
        </div>
        <input
          ref="changeFileInputRef"
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          class="sr-only"
          @change="onChangeFileInputChange"
        />
        <div class="flex flex-wrap items-center gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            :disabled="changeUploading || !newVersionLabel.trim()"
            @click="triggerChangeFilePick"
          >
            <Upload class="size-4" />
            選擇 Excel
          </Button>
          <span v-if="changeSelectedFileName" class="text-xs text-muted-foreground">{{
            changeSelectedFileName
          }}</span>
        </div>
        <div v-if="changeParsedRows?.length" class="space-y-2 pt-3">
          <Label>變更生效日期（虛線對齊此欄）</Label>
          <Select v-model="changeEffectiveDate">
            <SelectTrigger class="w-full border-border bg-background">
              <SelectValue placeholder="選擇日期" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="r in changeParsedRows" :key="r.periodDate" :value="r.periodDate">
                {{ r.periodDate }}（{{ shortDate(r.periodDate) }}）
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" :disabled="changeUploading" @click="changeDialogOpen = false">
            取消
          </Button>
          <Button
            :disabled="changeUploading || !changeParsedRows?.length || !newVersionLabel.trim()"
            @click="submitChangeConfirm"
          >
            確認建立
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
