<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { isAxiosError } from 'axios'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buildProjectPath, ROUTE_PATH, ROUTE_NAME } from '@/constants/routes'
import { parseLocaleNumber, formatThousands } from '@/lib/format-number'
import { computePlannedProgressPreview } from '@/lib/construction-daily-log-plan'
import {
  CONSTRUCTION_DAILY_LOG_BREADCRUMB_STATE_KEY,
  formatLogDateForBreadcrumb,
  persistDailyLogBreadcrumbDateToSession,
} from '@/lib/construction-daily-log-breadcrumb'
import {
  createConstructionDailyLog,
  deleteConstructionDailyLog,
  getConstructionDailyLog,
  getConstructionDailyLogDefaults,
  getConstructionDailyLogProgressPlanKnots,
  getConstructionDailyLogPccesWorkItems,
  previewConstructionDailyLogPccesActualProgress,
  updateConstructionDailyLog,
  type ConstructionDailyLogDto,
  type ConstructionDailyLogPccesPickerImport,
  type ConstructionDailyLogProgressPlanKnot,
  type ConstructionDailyLogUpsertPayload,
} from '@/api/construction-daily-logs'
import {
  Dialog,
  DialogScrollContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { useConstructionDailyLogBreadcrumbStore } from '@/stores/constructionDailyLogBreadcrumb'
import { toast } from '@/components/ui/sonner'
import { Loader2, Plus, Trash2 } from 'lucide-vue-next'

/** general 或空字串視為可填本日完成量；其餘 kind 僅能 0（與後端一致） */
function pccesDailyQtyEditable(itemKind: string | null | undefined): boolean {
  if (itemKind == null || itemKind === '') return true
  return itemKind === 'general'
}

type WorkDraft = {
  /** 綁定最新核定 PCCES 末層列時使用 */
  pccesItemId?: string | null
  /** 綁定 PCCES 時之 XML itemKind */
  pccesItemKind?: string | null
  /** 與 modal `isStructuralLeaf` 一致；主表單價僅末層顯示 */
  pccesStructuralLeaf?: boolean | null
  itemNo?: string | null
  workItemName: string
  unit: string
  contractQty: string
  /** 綁定 PCCES 時自 API／快照帶入，送出時一併寫回 */
  unitPrice?: string
  dailyQty: string
  accumulatedQty: string
  remark: string
}

/** 與 API `rows` 對齊；目錄列不填量 */
type WorkModalTableRow = {
  pccesItemId: string
  itemKey: number
  parentItemKey: number | null
  itemNo: string
  workItemName: string
  unit: string
  itemKind: string
  contractQty: string
  unitPrice: string
  isStructuralLeaf: boolean
  priorAccumulatedQty: string
  dailyQty: string
  remark: string
}

type MatDraft = {
  materialName: string
  unit: string
  contractQty: string
  dailyUsedQty: string
  accumulatedQty: string
  remark: string
}

type PeDraft = {
  workType: string
  dailyWorkers: string
  accumulatedWorkers: string
  equipmentName: string
  dailyEquipmentQty: string
  accumulatedEquipmentQty: string
}

const route = useRoute()
const router = useRouter()
const projectId = computed(() => (route.params.projectId as string) ?? '')
const logId = computed(() => (route.params.logId as string) ?? '')
const isNew = computed(() => route.name === ROUTE_NAME.PROJECT_CONSTRUCTION_DIARY_LOG_NEW)
const perm = useProjectModuleActions(projectId, 'construction.diary')
const dailyLogBreadcrumbStore = useConstructionDailyLogBreadcrumbStore()

function syncDailyLogBreadcrumbTitle() {
  if (isNew.value || !logId.value) {
    dailyLogBreadcrumbStore.setCurrentTitle(null)
    return
  }
  if (!form.logDate?.trim()) {
    dailyLogBreadcrumbStore.setCurrentTitle(null)
    return
  }
  const ymd = form.logDate.trim()
  dailyLogBreadcrumbStore.setCurrentTitle(formatLogDateForBreadcrumb(ymd))
  persistDailyLogBreadcrumbDateToSession(projectId.value, logId.value, ymd)
}

const canEditDiary = computed(() =>
  isNew.value ? perm.canCreate.value : perm.canUpdate.value
)

const listPath = computed(() =>
  buildProjectPath(projectId.value, ROUTE_PATH.PROJECT_CONSTRUCTION_DIARY)
)

const loading = ref(true)
const saving = ref(false)
const pccesActualLoading = ref(false)
const deleteOpen = ref(false)
const deleteLoading = ref(false)

const form = reactive({
  reportNo: '',
  weatherAm: '',
  weatherPm: '',
  logDate: '',
  projectName: '',
  contractorName: '',
  approvedDurationDays: '',
  accumulatedDays: '',
  remainingDays: '',
  extendedDays: '',
  startDate: '',
  completionDate: '',
  actualProgress: '',
  specialItemA: '',
  specialItemB: '',
  hasTechnician: false,
  preWorkEducation: 'no' as 'yes' | 'no',
  newWorkerInsurance: 'no_new' as 'yes' | 'no' | 'no_new',
  ppeCheck: 'no' as 'yes' | 'no',
  otherSafetyNotes: '',
  sampleTestRecord: '',
  subcontractorNotice: '',
  importantNotes: '',
  siteManagerSigned: false,
})

const workItems = ref<WorkDraft[]>([])
const materials = ref<MatDraft[]>([])
const personnelRows = ref<PeDraft[]>([])

/** 進度管理主計畫節點（累計預定 %），供預定進度依日內插預覽 */
const progressPlanKnots = ref<ConstructionDailyLogProgressPlanKnot[]>([])

const workModalOpen = ref(false)
const workModalLoading = ref(false)
const workModalError = ref('')
const modalTableRows = ref<WorkModalTableRow[]>([])
/** 最近一次成功載入之「契約欄位所依版本」摘要（填表日變更時清空） */
const lastPccesPickerImport = ref<ConstructionDailyLogPccesPickerImport | null>(null)

const modalHasStructuralLeaves = computed(() =>
  modalTableRows.value.some((r) => r.isStructuralLeaf)
)

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

watch(
  () => form.logDate,
  () => {
    lastPccesPickerImport.value = null
  }
)

function emptyWork(): WorkDraft {
  return {
    workItemName: '',
    unit: '',
    contractQty: '0',
    dailyQty: '0',
    accumulatedQty: '0',
    remark: '',
  }
}

function workRowAccumulatedPreview(row: WorkModalTableRow): number {
  const prior = parseLocaleNumber(row.priorAccumulatedQty) ?? 0
  const daily = parseLocaleNumber(row.dailyQty) ?? 0
  return prior + daily
}

function workModalRowExceedsContract(row: WorkModalTableRow): boolean {
  if (!row.isStructuralLeaf) return false
  const cap = parseLocaleNumber(row.contractQty)
  if (cap == null) return false
  return workRowAccumulatedPreview(row) > cap + 1e-9
}

/** 與主表／後端一致：已存在日誌列時以快照為準，不換成最新核定版欄位 */
function preferPccesSnapshotField(
  existing: string | null | undefined,
  latest: string
): string {
  if (existing != null && String(existing).trim() !== '') return String(existing).trim()
  return latest
}

async function openWorkItemsModal() {
  if (!form.logDate) {
    toast.error('請先選擇填表日期')
    return
  }
  if (!projectId.value) return
  workModalError.value = ''
  workModalLoading.value = true
  workModalOpen.value = true
  try {
    const res = await getConstructionDailyLogPccesWorkItems(projectId.value, {
      logDate: form.logDate,
      ...(isNew.value || !logId.value ? {} : { excludeLogId: logId.value }),
    })
    const hasLeaf = res.rows.some((r) => r.isStructuralLeaf)
    if (!res.pccesImport || !hasLeaf || res.rows.length === 0) {
      modalTableRows.value = []
      lastPccesPickerImport.value = null
      workModalError.value =
        '專案尚無已核定之 PCCES 版本，或該版無可填寫之明細工項。請至「PCCES 匯入紀錄」核定其中一版後再試。'
      return
    }
    lastPccesPickerImport.value = res.pccesImport
    const existingByPcces = new Map(
      workItems.value.filter((w) => w.pccesItemId).map((w) => [w.pccesItemId as string, w])
    )
    modalTableRows.value = res.rows.map((it) => {
      const ex = existingByPcces.get(it.pccesItemId)
      const prior = it.priorAccumulatedQty ?? ''
      return {
        pccesItemId: it.pccesItemId,
        itemKey: it.itemKey,
        parentItemKey: it.parentItemKey,
        itemNo: preferPccesSnapshotField(ex?.itemNo, it.itemNo),
        workItemName: preferPccesSnapshotField(ex?.workItemName, it.workItemName),
        unit: preferPccesSnapshotField(ex?.unit, it.unit),
        itemKind: it.itemKind,
        contractQty: preferPccesSnapshotField(ex?.contractQty, it.contractQty),
        unitPrice: preferPccesSnapshotField(ex?.unitPrice, it.unitPrice),
        isStructuralLeaf: it.isStructuralLeaf,
        priorAccumulatedQty: prior,
        dailyQty: it.isStructuralLeaf ? (ex?.dailyQty ?? '0') : '',
        remark: it.isStructuralLeaf ? (ex?.remark ?? '') : '',
      }
    })
  } catch {
    workModalError.value = '無法載入核定工項'
    modalTableRows.value = []
    lastPccesPickerImport.value = null
  } finally {
    workModalLoading.value = false
  }
}

function confirmWorkItemsModal() {
  for (const r of modalTableRows.value) {
    if (workModalRowExceedsContract(r)) {
      toast.error(`項次 ${r.itemNo}：累計完成不可超過契約數量`)
      return
    }
  }
  const manual = workItems.value.filter((w) => !w.pccesItemId)
  const next: WorkDraft[] = [...manual]
  for (const r of modalTableRows.value) {
    if (!r.isStructuralLeaf) continue
    const dailyN = parseLocaleNumber(r.dailyQty) ?? 0
    if (dailyN === 0 && !r.remark.trim()) continue
    const acc = workRowAccumulatedPreview(r)
    next.push({
      pccesItemId: r.pccesItemId,
      pccesItemKind: r.itemKind,
      pccesStructuralLeaf: r.isStructuralLeaf,
      itemNo: r.itemNo,
      workItemName: r.workItemName,
      unit: r.unit,
      contractQty: r.contractQty,
      unitPrice: r.unitPrice,
      dailyQty: r.dailyQty.trim() || '0',
      accumulatedQty: String(acc),
      remark: r.remark,
    })
  }
  workItems.value = next
  workModalOpen.value = false
}

function clearPccesLinkedWorkItems() {
  workItems.value = workItems.value.filter((w) => !w.pccesItemId)
}

function emptyMat(): MatDraft {
  return {
    materialName: '',
    unit: '',
    contractQty: '0',
    dailyUsedQty: '0',
    accumulatedQty: '0',
    remark: '',
  }
}

function emptyPe(): PeDraft {
  return {
    workType: '',
    dailyWorkers: '0',
    accumulatedWorkers: '0',
    equipmentName: '',
    dailyEquipmentQty: '0',
    accumulatedEquipmentQty: '0',
  }
}

const plannedPreview = computed(() => {
  const ap = form.approvedDurationDays.trim()
  const ad = ap === '' ? null : Number(ap)
  return computePlannedProgressPreview(
    form.logDate || todayIso(),
    form.startDate.trim() || null,
    ad != null && Number.isFinite(ad) ? ad : null,
    progressPlanKnots.value.length > 0 ? progressPlanKnots.value : null
  )
})

const plannedDisplay = computed(() => {
  const p = plannedPreview.value
  if (p == null) return '—（請填開工日與核定工期）'
  return `${formatThousands(p, { maximumFractionDigits: 2 })}%`
})

/** 填表日變更時改抓「該日已生效」進度計畫之累計節點（含變更版），供預定進度內插與後端一致 */
async function syncProgressPlanKnotsToLogDate() {
  if (!projectId.value) return
  const ymd = form.logDate?.trim()
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return
  try {
    const { progressPlanKnots: k } = await getConstructionDailyLogProgressPlanKnots(
      projectId.value,
      ymd
    )
    progressPlanKnots.value = k ?? []
  } catch {
    // 預覽失敗不阻斷；儲存後仍由 API 回傳正確 plannedProgress
  }
}

const debouncedSyncProgressPlanKnots = useDebounceFn(syncProgressPlanKnotsToLogDate, 350)

watch(
  () => form.logDate,
  (next, prev) => {
    if (!next?.trim() || next === prev) return
    debouncedSyncProgressPlanKnots()
  }
)

function parseOptionalInt(s: string): number | null {
  const t = s.trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

function parseOptionalDec(s: string): number | null {
  const t = s.trim()
  if (t === '') return null
  const n = parseFloat(t.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function buildPayload(): ConstructionDailyLogUpsertPayload {
  const work = workItems.value.filter((w) => w.workItemName.trim() !== '')
  const mats = materials.value.filter((m) => m.materialName.trim() !== '')
  const pe = personnelRows.value.filter(
    (p) =>
      p.workType.trim() !== '' ||
      p.equipmentName.trim() !== '' ||
      Number(p.dailyWorkers) > 0 ||
      Number(p.accumulatedWorkers) > 0 ||
      parseFloat(p.dailyEquipmentQty) > 0 ||
      parseFloat(p.accumulatedEquipmentQty) > 0
  )

  return {
    reportNo: form.reportNo.trim() || null,
    weatherAm: form.weatherAm.trim() || null,
    weatherPm: form.weatherPm.trim() || null,
    logDate: form.logDate,
    projectName: form.projectName.trim(),
    contractorName: form.contractorName.trim(),
    approvedDurationDays: parseOptionalInt(form.approvedDurationDays),
    accumulatedDays: parseOptionalInt(form.accumulatedDays),
    remainingDays: parseOptionalInt(form.remainingDays),
    extendedDays: parseOptionalInt(form.extendedDays),
    startDate: form.startDate.trim() || null,
    completionDate: form.completionDate.trim() || null,
    actualProgress: parseOptionalDec(form.actualProgress),
    specialItemA: form.specialItemA,
    specialItemB: form.specialItemB,
    hasTechnician: form.hasTechnician,
    preWorkEducation: form.preWorkEducation,
    newWorkerInsurance: form.newWorkerInsurance,
    ppeCheck: form.ppeCheck,
    otherSafetyNotes: form.otherSafetyNotes,
    sampleTestRecord: form.sampleTestRecord,
    subcontractorNotice: form.subcontractorNotice,
    importantNotes: form.importantNotes,
    siteManagerSigned: form.siteManagerSigned,
    workItems: work.map((w) => ({
      ...(w.pccesItemId ? { pccesItemId: w.pccesItemId } : {}),
      ...(w.pccesItemId &&
      w.unitPrice != null &&
      String(w.unitPrice).replace(/,/g, '').trim() !== ''
        ? { unitPrice: String(w.unitPrice).replace(/,/g, '').trim() }
        : {}),
      workItemName: w.workItemName.trim(),
      unit: w.unit.trim(),
      contractQty: w.contractQty.trim() || '0',
      dailyQty: w.dailyQty.trim() || '0',
      accumulatedQty: w.accumulatedQty.trim() || '0',
      remark: w.remark,
    })),
    materials: mats.map((m) => ({
      materialName: m.materialName.trim(),
      unit: m.unit.trim(),
      contractQty: m.contractQty.trim() || '0',
      dailyUsedQty: m.dailyUsedQty.trim() || '0',
      accumulatedQty: m.accumulatedQty.trim() || '0',
      remark: m.remark,
    })),
    personnelEquipmentRows: pe.map((p) => ({
      workType: p.workType.trim(),
      dailyWorkers: Math.max(0, parseInt(p.dailyWorkers, 10) || 0),
      accumulatedWorkers: Math.max(0, parseInt(p.accumulatedWorkers, 10) || 0),
      equipmentName: p.equipmentName.trim(),
      dailyEquipmentQty: p.dailyEquipmentQty.trim() || '0',
      accumulatedEquipmentQty: p.accumulatedEquipmentQty.trim() || '0',
    })),
  }
}

function applyDto(d: ConstructionDailyLogDto) {
  form.reportNo = d.reportNo ?? ''
  form.weatherAm = d.weatherAm ?? ''
  form.weatherPm = d.weatherPm ?? ''
  form.logDate = d.logDate
  form.projectName = d.projectName
  form.contractorName = d.contractorName
  form.approvedDurationDays = d.approvedDurationDays != null ? String(d.approvedDurationDays) : ''
  form.accumulatedDays = d.accumulatedDays != null ? String(d.accumulatedDays) : ''
  form.remainingDays = d.remainingDays != null ? String(d.remainingDays) : ''
  form.extendedDays = d.extendedDays != null ? String(d.extendedDays) : ''
  form.startDate = d.startDate ?? ''
  form.completionDate = d.completionDate ?? ''
  form.actualProgress = d.actualProgress ?? ''
  form.specialItemA = d.specialItemA
  form.specialItemB = d.specialItemB
  form.hasTechnician = d.hasTechnician
  form.preWorkEducation = d.preWorkEducation === 'yes' ? 'yes' : 'no'
  form.newWorkerInsurance =
    d.newWorkerInsurance === 'yes' || d.newWorkerInsurance === 'no'
      ? d.newWorkerInsurance
      : 'no_new'
  form.ppeCheck = d.ppeCheck === 'yes' ? 'yes' : 'no'
  form.otherSafetyNotes = d.otherSafetyNotes
  form.sampleTestRecord = d.sampleTestRecord
  form.subcontractorNotice = d.subcontractorNotice
  form.importantNotes = d.importantNotes
  form.siteManagerSigned = d.siteManagerSigned

  workItems.value =
    d.workItems.length > 0
      ? d.workItems.map((w) => ({
          pccesItemId: w.pccesItemId ?? undefined,
          pccesItemKind: w.pccesItemKind ?? undefined,
          pccesStructuralLeaf: w.pccesStructuralLeaf ?? undefined,
          itemNo: w.itemNo ?? undefined,
          workItemName: w.workItemName,
          unit: w.unit,
          contractQty: w.contractQty,
          unitPrice: w.unitPrice ?? '',
          dailyQty: w.dailyQty,
          accumulatedQty: w.accumulatedQty,
          remark: w.remark,
        }))
      : []
  materials.value =
    d.materials.length > 0
      ? d.materials.map((m) => ({
          materialName: m.materialName,
          unit: m.unit,
          contractQty: m.contractQty,
          dailyUsedQty: m.dailyUsedQty,
          accumulatedQty: m.accumulatedQty,
          remark: m.remark,
        }))
      : []
  personnelRows.value =
    d.personnelEquipmentRows.length > 0
      ? d.personnelEquipmentRows.map((p) => ({
          workType: p.workType,
          dailyWorkers: String(p.dailyWorkers),
          accumulatedWorkers: String(p.accumulatedWorkers),
          equipmentName: p.equipmentName,
          dailyEquipmentQty: p.dailyEquipmentQty,
          accumulatedEquipmentQty: p.accumulatedEquipmentQty,
        }))
      : []
}

async function init() {
  if (!projectId.value) return
  if (!isNew.value && !logId.value) {
    await router.replace(listPath.value)
    return
  }
  loading.value = true
  try {
    if (isNew.value) {
      if (!perm.canCreate.value) {
        toast.error('您沒有新增權限')
        await router.replace(listPath.value)
        return
      }
      form.logDate = todayIso()
      const defs = await getConstructionDailyLogDefaults(projectId.value, {
        logDate: form.logDate,
      })
      form.projectName = defs.projectName
      form.contractorName = defs.contractorName
      form.startDate = defs.startDate ?? ''
      form.approvedDurationDays =
        defs.approvedDurationDays != null ? String(defs.approvedDurationDays) : ''
      progressPlanKnots.value = defs.progressPlanKnots ?? []
      workItems.value = []
      materials.value = []
      personnelRows.value = []
    } else {
      if (!perm.canRead.value) {
        toast.error('您沒有檢視權限')
        await router.replace(listPath.value)
        return
      }
      const d = await getConstructionDailyLog(projectId.value, logId.value)
      applyDto(d)
      progressPlanKnots.value = d.progressPlanKnots ?? []
      syncDailyLogBreadcrumbTitle()
    }
  } catch {
    toast.error('無法載入資料')
    await router.replace(listPath.value)
  } finally {
    loading.value = false
  }
}

async function onSubmit() {
  if (!form.logDate) {
    toast.error('請選擇填表日期')
    return
  }
  if (!form.projectName.trim() || !form.contractorName.trim()) {
    toast.error('請填工程名稱與承攬廠商')
    return
  }
  saving.value = true
  try {
    const payload = buildPayload()
    if (isNew.value) {
      const created = await createConstructionDailyLog(projectId.value, payload)
      toast.success('已建立施工日誌')
      await router.replace({
        name: ROUTE_NAME.PROJECT_CONSTRUCTION_DIARY_LOG_DETAIL,
        params: { projectId: projectId.value, logId: created.id },
        state: { [CONSTRUCTION_DAILY_LOG_BREADCRUMB_STATE_KEY]: form.logDate.trim() },
      })
    } else {
      await updateConstructionDailyLog(projectId.value, logId.value, payload)
      toast.success('已儲存')
      await init()
    }
  } catch (e) {
    const msg = isAxiosError(e)
      ? (e.response?.data as { error?: { message?: string } })?.error?.message
      : null
    toast.error(msg ?? '儲存失敗')
  } finally {
    saving.value = false
  }
}

async function fillActualProgressFromPcces() {
  if (!canEditDiary.value) return
  if (!form.logDate?.trim()) {
    toast.error('請先選擇填表日期')
    return
  }
  pccesActualLoading.value = true
  try {
    const overlayWorkItems = workItems.value
      .filter((w) => w.pccesItemId)
      .map((w) => ({
        pccesItemId: w.pccesItemId as string,
        dailyQty: w.dailyQty ?? '0',
      }))
    const result = await previewConstructionDailyLogPccesActualProgress(projectId.value, {
      logDate: form.logDate,
      excludeLogId: isNew.value ? undefined : logId.value,
      overlayWorkItems,
    })
    form.actualProgress = result.actualProgress
  } catch (e) {
    const msg = isAxiosError(e)
      ? (e.response?.data as { error?: { message?: string } })?.error?.message
      : null
    toast.error(msg ?? '無法計算實際進度')
  } finally {
    pccesActualLoading.value = false
  }
}

async function confirmDelete() {
  if (!perm.canDelete.value) {
    toast.error('您沒有刪除權限')
    return
  }
  deleteLoading.value = true
  try {
    await deleteConstructionDailyLog(projectId.value, logId.value)
    toast.success('已刪除')
    deleteOpen.value = false
    await router.push(listPath.value)
  } catch (e) {
    const msg = isAxiosError(e)
      ? (e.response?.data as { error?: { message?: string } })?.error?.message
      : null
    toast.error(msg ?? '刪除失敗')
  } finally {
    deleteLoading.value = false
  }
}

watch(
  () => [route.name, route.params.projectId, route.params.logId] as const,
  () => {
    void init()
  },
  { immediate: true }
)

watch(
  () => form.logDate,
  () => {
    if (!isNew.value && logId.value) syncDailyLogBreadcrumbTitle()
  }
)

onUnmounted(() => {
  dailyLogBreadcrumbStore.setCurrentTitle(null)
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <Button variant="outline" as-child>
        <RouterLink :to="listPath">返回列表</RouterLink>
      </Button>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Loader2 class="size-8 animate-spin" />
      <p class="mt-2 text-sm">載入中…</p>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold text-foreground">
            {{ isNew ? '新增施工日誌' : '編輯施工日誌' }}
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            公共工程依附表四；若專案已有進度管理主計畫，預定進度依各期<strong class="text-foreground">累計預定
            %</strong>對填表日<strong class="text-foreground">線性內插</strong>；否則依開工日與核定工期推算（儲存後與列表以伺服器計算為準）。
          </p>
        </div>
        <div v-if="!isNew && perm.canDelete.value" class="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            class="text-destructive hover:text-destructive"
            @click="deleteOpen = true"
          >
            <Trash2 class="mr-2 size-4" />
            刪除
          </Button>
        </div>
      </div>
      <!-- 表頭 -->
      <Card class="border-border bg-card">
        <CardHeader>
          <CardTitle class="text-lg">表頭資訊</CardTitle>
          <CardDescription>表報編號、天氣、填表日期</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="space-y-2">
            <Label for="reportNo">表報編號</Label>
            <Input id="reportNo" v-model="form.reportNo" class="bg-background" />
          </div>
          <div class="space-y-2">
            <Label for="logDate">填表日期</Label>
            <Input id="logDate" v-model="form.logDate" type="date" class="bg-background" />
          </div>
          <div class="space-y-2">
            <Label for="weatherAm">天氣（上午）</Label>
            <Input id="weatherAm" v-model="form.weatherAm" class="bg-background" />
          </div>
          <div class="space-y-2">
            <Label for="weatherPm">天氣（下午）</Label>
            <Input id="weatherPm" v-model="form.weatherPm" class="bg-background" />
          </div>
        </CardContent>
      </Card>

      <!-- 工程基本資料 -->
      <Card class="border-border bg-card">
        <CardHeader>
          <CardTitle class="text-lg">工程基本資料</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="projectName">工程名稱</Label>
              <Input id="projectName" v-model="form.projectName" class="bg-background" />
            </div>
            <div class="space-y-2">
              <Label for="contractorName">承攬廠商名稱</Label>
              <Input id="contractorName" v-model="form.contractorName" class="bg-background" />
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="space-y-2">
              <Label for="approvedDurationDays">核定工期（天）</Label>
              <Input
                id="approvedDurationDays"
                v-model="form.approvedDurationDays"
                type="number"
                min="0"
                class="bg-background"
              />
            </div>
            <div class="space-y-2">
              <Label for="accumulatedDays">累計工期（天）</Label>
              <Input
                id="accumulatedDays"
                v-model="form.accumulatedDays"
                type="number"
                class="bg-background"
              />
            </div>
            <div class="space-y-2">
              <Label for="remainingDays">剩餘工期（天）</Label>
              <Input
                id="remainingDays"
                v-model="form.remainingDays"
                type="number"
                class="bg-background"
              />
            </div>
            <div class="space-y-2">
              <Label for="extendedDays">工期展延天數</Label>
              <Input
                id="extendedDays"
                v-model="form.extendedDays"
                type="number"
                min="0"
                class="bg-background"
              />
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="startDate">開工日期</Label>
              <Input id="startDate" v-model="form.startDate" type="date" class="bg-background" />
            </div>
            <div class="space-y-2">
              <Label for="completionDate">完工日期</Label>
              <Input
                id="completionDate"
                v-model="form.completionDate"
                type="date"
                class="bg-background"
              />
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label>預定進度（%）</Label>
              <div
                class="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
              >
                {{ plannedDisplay }}
              </div>
            </div>
            <div class="space-y-2">
              <Label for="actualProgress">實際進度（%）</Label>
              <div class="flex flex-wrap items-center gap-2">
                <Input
                  id="actualProgress"
                  v-model="form.actualProgress"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  class="min-w-0 flex-1 bg-background"
                  placeholder="人工填寫或由工項帶入"
                />
                <Button
                  v-if="canEditDiary"
                  type="button"
                  variant="outline"
                  :disabled="pccesActualLoading"
                  @click="fillActualProgressFromPcces"
                >
                  <Loader2 v-if="pccesActualLoading" class="mr-1 size-4 animate-spin" />
                  由工項帶入
                </Button>
              </div>
              <p class="text-xs text-muted-foreground">
                依最新核定 PCCES 一般葉節點：累計完成×單價加總／總工程費（頂層壹／發包金額）；納入表上核定工項之本日完成量，可再手改。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 一、施工項目 -->
      <Card class="border-border bg-card">
        <CardHeader class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle class="text-lg">一、施工項目</CardTitle>
            <CardDescription class="space-y-1">
              <p>
                核定工項請以視窗填寫（本日完成、備註）；累計由系統依歷史推算並於儲存時由伺服器覆核。可另增手動列。
              </p>
              <p class="text-xs text-muted-foreground">
                契約數量／單價等會依<strong class="text-foreground">填表日期</strong>，對應「該日已生效」的
                PCCES 版次（詳見匯入紀錄的「核定生效時間」；未填則以核定當日日曆為準）。
              </p>
              <p
                v-if="lastPccesPickerImport"
                class="text-xs text-muted-foreground"
              >
                最近一次開啟選單：契約欄位依第
                <span class="text-foreground">{{ lastPccesPickerImport.version }}</span>
                版；生效基準：
                <span class="text-foreground">{{
                  lastPccesPickerImport.approvalEffectiveAt
                    ? new Date(lastPccesPickerImport.approvalEffectiveAt).toLocaleString('zh-TW')
                    : '核定操作時間（日曆日）'
                }}</span>
              </p>
            </CardDescription>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button type="button" variant="default" size="sm" @click="openWorkItemsModal">
              填寫核定工項
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              :disabled="!workItems.some((w) => w.pccesItemId)"
              @click="clearPccesLinkedWorkItems"
            >
              清除核定工項
            </Button>
            <Button type="button" variant="outline" size="sm" @click="workItems.push(emptyWork())">
              <Plus class="mr-1 size-4" />
              新增手動列
            </Button>
          </div>
        </CardHeader>
        <CardContent class="overflow-x-auto">
          <p v-if="workItems.length === 0" class="text-sm text-muted-foreground">
            尚無列：請開啟「填寫核定工項」或新增手動列。
          </p>
          <div v-else class="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-14 whitespace-nowrap">項次</TableHead>
                  <TableHead class="min-w-[12rem]">工程項目</TableHead>
                  <TableHead class="w-16">單位</TableHead>
                  <TableHead class="w-24 text-end">契約數量</TableHead>
                  <TableHead class="w-24 text-end">單價</TableHead>
                  <TableHead class="w-24 text-end">本日完成</TableHead>
                  <TableHead class="w-24 text-end">累計完成</TableHead>
                  <TableHead class="min-w-[8rem]">備註</TableHead>
                  <TableHead class="w-20 text-end">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(row, idx) in workItems" :key="'w' + idx">
                  <TableCell class="text-muted-foreground tabular-nums">
                    {{ row.itemNo?.trim() ? row.itemNo : '—' }}
                  </TableCell>
                  <TableCell>
                    <Input
                      v-if="!row.pccesItemId"
                      v-model="row.workItemName"
                      class="bg-background"
                    />
                    <span v-else class="text-sm">{{ row.workItemName }}</span>
                  </TableCell>
                  <TableCell>
                    <Input v-if="!row.pccesItemId" v-model="row.unit" class="bg-background" />
                    <span v-else class="text-sm text-muted-foreground">{{ row.unit }}</span>
                  </TableCell>
                  <TableCell class="text-end tabular-nums text-sm">
                    <Input
                      v-if="!row.pccesItemId"
                      v-model="row.contractQty"
                      class="bg-background text-end"
                    />
                    <span v-else>{{
                      formatThousands(row.contractQty, { maximumFractionDigits: 4 })
                    }}</span>
                  </TableCell>
                  <TableCell class="text-end tabular-nums text-sm">
                    <span v-if="!row.pccesItemId" class="text-muted-foreground">—</span>
                    <span
                      v-else-if="row.pccesStructuralLeaf === false"
                      class="text-muted-foreground"
                    >—</span>
                    <span v-else-if="row.unitPrice != null && String(row.unitPrice).trim() !== ''">{{
                      formatThousands(row.unitPrice, { maximumFractionDigits: 4 })
                    }}</span>
                    <span v-else class="text-muted-foreground">—</span>
                  </TableCell>
                  <TableCell class="text-end">
                    <Input
                      v-if="!row.pccesItemId || pccesDailyQtyEditable(row.pccesItemKind)"
                      v-model="row.dailyQty"
                      class="bg-background text-end"
                    />
                    <span v-else class="tabular-nums text-sm">{{
                      formatThousands(row.dailyQty, { maximumFractionDigits: 4 })
                    }}</span>
                  </TableCell>
                  <TableCell class="text-end tabular-nums text-sm">
                    <Input
                      v-if="!row.pccesItemId"
                      v-model="row.accumulatedQty"
                      class="bg-background text-end"
                    />
                    <span v-else>{{
                      formatThousands(row.accumulatedQty, { maximumFractionDigits: 4 })
                    }}</span>
                  </TableCell>
                  <TableCell>
                    <Input v-if="!row.pccesItemId" v-model="row.remark" class="bg-background" />
                    <span v-else class="line-clamp-2 text-sm text-muted-foreground">{{
                      row.remark || '—'
                    }}</span>
                  </TableCell>
                  <TableCell class="text-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      @click="workItems.splice(idx, 1)"
                    >
                      移除
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <!-- 營造業特定項目 -->
      <Card class="border-border bg-card">
        <CardHeader>
          <CardTitle class="text-lg">營造業專業工程特定施工項目</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label for="specialA">A 項</Label>
            <textarea
              id="specialA"
              v-model="form.specialItemA"
              rows="3"
              class="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <div class="space-y-2">
            <Label for="specialB">B 項</Label>
            <textarea
              id="specialB"
              v-model="form.specialItemB"
              rows="3"
              class="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        </CardContent>
      </Card>

      <!-- 二、材料 -->
      <Card class="border-border bg-card">
        <CardHeader class="flex flex-row items-end justify-between gap-4">
          <div>
            <CardTitle class="text-lg">二、材料</CardTitle>
            <CardDescription>可新增多列</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" @click="materials.push(emptyMat())">
            <Plus class="mr-1 size-4" />
            新增列
          </Button>
        </CardHeader>
        <CardContent class="space-y-4 overflow-x-auto">
          <p v-if="materials.length === 0" class="text-sm text-muted-foreground">
            尚無列，請新增。
          </p>
          <div
            v-for="(row, idx) in materials"
            :key="'m' + idx"
            class="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-6 lg:grid-cols-12"
          >
            <div class="md:col-span-3 lg:col-span-3">
              <Label class="text-xs text-muted-foreground">材料名稱</Label>
              <Input v-model="row.materialName" class="mt-1 bg-background" />
            </div>
            <div class="md:col-span-1 lg:col-span-1">
              <Label class="text-xs text-muted-foreground">單位</Label>
              <Input v-model="row.unit" class="mt-1 bg-background" />
            </div>
            <div class="md:col-span-1 lg:col-span-2">
              <Label class="text-xs text-muted-foreground">契約數量</Label>
              <Input v-model="row.contractQty" class="mt-1 bg-background" />
            </div>
            <div class="md:col-span-1 lg:col-span-2">
              <Label class="text-xs text-muted-foreground">本日使用</Label>
              <Input v-model="row.dailyUsedQty" class="mt-1 bg-background" />
            </div>
            <div class="md:col-span-1 lg:col-span-2">
              <Label class="text-xs text-muted-foreground">累計使用</Label>
              <Input v-model="row.accumulatedQty" class="mt-1 bg-background" />
            </div>
            <div class="md:col-span-6 lg:col-span-2">
              <Label class="text-xs text-muted-foreground">備註</Label>
              <Input v-model="row.remark" class="mt-1 bg-background" />
            </div>
            <div class="flex items-end md:col-span-6 lg:col-span-12">
              <Button type="button" variant="ghost" size="sm" @click="materials.splice(idx, 1)">
                移除此列
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 三、人員及機具 -->
      <Card class="border-border bg-card">
        <CardHeader class="flex flex-row items-end justify-between gap-4">
          <div>
            <CardTitle class="text-lg">三、人員及機具</CardTitle>
            <CardDescription>一列可同時記錄工別／人數與機具</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" @click="personnelRows.push(emptyPe())">
            <Plus class="mr-1 size-4" />
            新增列
          </Button>
        </CardHeader>
        <CardContent class="space-y-4 overflow-x-auto">
          <p v-if="personnelRows.length === 0" class="text-sm text-muted-foreground">
            尚無列，請新增。
          </p>
          <div
            v-for="(row, idx) in personnelRows"
            :key="'p' + idx"
            class="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-6 lg:grid-cols-12"
          >
            <div class="md:col-span-2 lg:col-span-2">
              <Label class="text-xs text-muted-foreground">工別</Label>
              <Input v-model="row.workType" class="mt-1 bg-background" />
            </div>
            <div class="md:col-span-1 lg:col-span-2">
              <Label class="text-xs text-muted-foreground">本日人數</Label>
              <Input v-model="row.dailyWorkers" type="number" min="0" class="mt-1 bg-background" />
            </div>
            <div class="md:col-span-1 lg:col-span-2">
              <Label class="text-xs text-muted-foreground">累計人數</Label>
              <Input
                v-model="row.accumulatedWorkers"
                type="number"
                min="0"
                class="mt-1 bg-background"
              />
            </div>
            <div class="md:col-span-2 lg:col-span-2">
              <Label class="text-xs text-muted-foreground">機具名稱</Label>
              <Input v-model="row.equipmentName" class="mt-1 bg-background" />
            </div>
            <div class="md:col-span-1 lg:col-span-2">
              <Label class="text-xs text-muted-foreground">本日機具量</Label>
              <Input v-model="row.dailyEquipmentQty" class="mt-1 bg-background" />
            </div>
            <div class="md:col-span-1 lg:col-span-2">
              <Label class="text-xs text-muted-foreground">累計機具量</Label>
              <Input v-model="row.accumulatedEquipmentQty" class="mt-1 bg-background" />
            </div>
            <div class="flex items-end md:col-span-6 lg:col-span-12">
              <Button type="button" variant="ghost" size="sm" @click="personnelRows.splice(idx, 1)">
                移除此列
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 四～八 -->
      <Card class="border-border bg-card">
        <CardHeader>
          <CardTitle class="text-lg">四、技術士與職安衛</CardTitle>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="flex items-center gap-2">
            <Checkbox
              id="hasTechnician"
              :checked="form.hasTechnician"
              @update:checked="(v) => (form.hasTechnician = v === true)"
            />
            <Label for="hasTechnician" class="cursor-pointer font-normal">是否需設置技術士</Label>
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            <div class="space-y-2">
              <Label>勤前教育</Label>
              <Select v-model="form.preWorkEducation">
                <SelectTrigger class="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">有</SelectItem>
                  <SelectItem value="no">無</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label>新進勞工保險</Label>
              <Select v-model="form.newWorkerInsurance">
                <SelectTrigger class="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">有</SelectItem>
                  <SelectItem value="no">無</SelectItem>
                  <SelectItem value="no_new">無新進勞工</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label>個人防護具檢查</Label>
              <Select v-model="form.ppeCheck">
                <SelectTrigger class="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">有</SelectItem>
                  <SelectItem value="no">無</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="space-y-2">
            <Label for="otherSafety">其他事項（職安衛）</Label>
            <textarea
              id="otherSafety"
              v-model="form.otherSafetyNotes"
              rows="3"
              class="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        </CardContent>
      </Card>

      <Card class="border-border bg-card">
        <CardHeader>
          <CardTitle class="text-lg">六～八、備查與簽章</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label for="sampleTest">施工取樣試驗紀錄</Label>
            <textarea
              id="sampleTest"
              v-model="form.sampleTestRecord"
              rows="3"
              class="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <div class="space-y-2">
            <Label for="subNotice">通知協力廠商事項</Label>
            <textarea
              id="subNotice"
              v-model="form.subcontractorNotice"
              rows="3"
              class="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <div class="space-y-2">
            <Label for="impNotes">重要事項紀錄</Label>
            <textarea
              id="impNotes"
              v-model="form.importantNotes"
              rows="3"
              class="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <div class="flex items-center gap-2">
            <Checkbox
              id="siteSigned"
              :checked="form.siteManagerSigned"
              @update:checked="(v) => (form.siteManagerSigned = v === true)"
            />
            <Label for="siteSigned" class="cursor-pointer font-normal">工地主任簽章</Label>
          </div>
        </CardContent>
      </Card>

      <div class="flex flex-wrap gap-3">
        <Button
          v-if="isNew ? perm.canCreate.value : perm.canUpdate.value"
          type="button"
          :disabled="saving"
          @click="onSubmit"
        >
          <Loader2 v-if="saving" class="mr-2 size-4 animate-spin" />
          儲存
        </Button>
        <Button type="button" variant="outline" as-child>
          <RouterLink :to="listPath">取消</RouterLink>
        </Button>
      </div>
    </template>

    <Dialog :open="workModalOpen" @update:open="(v: boolean) => (workModalOpen = v)">
      <DialogScrollContent
        class="flex max-h-[90vh] max-w-[min(96rem,calc(100vw-2rem))] flex-col gap-0 sm:max-w-[min(96rem,calc(100vw-2rem))]"
      >
        <DialogHeader>
          <DialogTitle>施工項目（核定 PCCES）</DialogTitle>
          <DialogDescription>
            與 PCCES 明細（全部類型）相同順序（itemKey 升序）；目錄列與末層同欄位，目錄列不填本日完成與備註。累計不可超過契約數量。
          </DialogDescription>
        </DialogHeader>
        <div class="min-h-0 flex-1 overflow-auto py-2">
          <div
            v-if="workModalLoading"
            class="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 class="size-4 animate-spin" />
            載入工項…
          </div>
          <p v-else-if="workModalError" class="text-sm text-destructive">{{ workModalError }}</p>
          <div v-else class="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-14 whitespace-nowrap">項次</TableHead>
                  <TableHead class="min-w-[10rem]">工程項目</TableHead>
                  <TableHead class="w-14">單位</TableHead>
                  <TableHead class="w-24 text-end">契約數量</TableHead>
                  <TableHead class="w-24 text-end">單價</TableHead>
                  <TableHead class="w-28 text-end">累計（迄前日）</TableHead>
                  <TableHead class="w-28 text-end">本日完成</TableHead>
                  <TableHead class="w-28 text-end">累計（預覽）</TableHead>
                  <TableHead class="min-w-[10rem]">備註</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="row in modalTableRows"
                  :key="row.pccesItemId"
                  :class="[
                    !row.isStructuralLeaf ? 'bg-muted/50 hover:bg-muted/50' : '',
                    workModalRowExceedsContract(row) ? 'bg-destructive/10' : '',
                  ]"
                >
                  <TableCell class="tabular-nums text-sm text-muted-foreground">
                    {{ row.itemNo }}
                  </TableCell>
                  <TableCell
                    class="max-w-[min(24rem,40vw)] text-sm"
                    :class="row.isStructuralLeaf ? '' : 'font-medium text-foreground'"
                  >
                    {{ row.workItemName }}
                  </TableCell>
                  <TableCell class="text-sm text-muted-foreground">{{ row.unit }}</TableCell>
                  <TableCell class="text-end tabular-nums text-sm">
                    {{ formatThousands(row.contractQty, { maximumFractionDigits: 4 }) }}
                  </TableCell>
                  <TableCell class="text-end tabular-nums text-sm text-muted-foreground">
                    <template v-if="row.isStructuralLeaf">
                      {{
                        row.unitPrice != null && String(row.unitPrice).trim() !== ''
                          ? formatThousands(row.unitPrice, { maximumFractionDigits: 4 })
                          : '—'
                      }}
                    </template>
                    <span v-else>—</span>
                  </TableCell>
                  <TableCell class="text-end tabular-nums text-sm text-muted-foreground">
                    {{
                      row.isStructuralLeaf
                        ? formatThousands(row.priorAccumulatedQty, { maximumFractionDigits: 4 })
                        : '—'
                    }}
                  </TableCell>
                  <TableCell class="text-end">
                    <Input
                      v-if="row.isStructuralLeaf"
                      v-model="row.dailyQty"
                      class="bg-background text-end tabular-nums"
                      :disabled="!pccesDailyQtyEditable(row.itemKind)"
                      :title="
                        !pccesDailyQtyEditable(row.itemKind)
                          ? '此 PCCES 類型不開放填寫本日完成量'
                          : undefined
                      "
                    />
                    <span v-else class="text-sm text-muted-foreground">—</span>
                  </TableCell>
                  <TableCell
                    class="text-end tabular-nums text-sm"
                    :class="
                      workModalRowExceedsContract(row) ? 'font-medium text-destructive' : ''
                    "
                  >
                    {{
                      row.isStructuralLeaf
                        ? formatThousands(workRowAccumulatedPreview(row), {
                            maximumFractionDigits: 4,
                          })
                        : '—'
                    }}
                  </TableCell>
                  <TableCell>
                    <textarea
                      v-if="row.isStructuralLeaf"
                      v-model="row.remark"
                      rows="2"
                      class="flex min-h-[52px] w-full min-w-[8rem] rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                    <span v-else class="text-sm text-muted-foreground">—</span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button type="button" variant="outline" @click="workModalOpen = false">取消</Button>
          <Button
            type="button"
            :disabled="workModalLoading || !!workModalError || !modalHasStructuralLeaves"
            @click="confirmWorkItemsModal"
          >
            套用至表單
          </Button>
        </DialogFooter>
      </DialogScrollContent>
    </Dialog>

    <AlertDialog :open="deleteOpen" @update:open="(v: boolean) => !v && (deleteOpen = false)">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>刪除此筆施工日誌？</AlertDialogTitle>
          <AlertDialogDescription>將軟刪除此日誌（無法從前台復原）。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleteLoading">取消</AlertDialogCancel>
          <Button variant="destructive" :disabled="deleteLoading" @click="confirmDelete">
            <Loader2 v-if="deleteLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
