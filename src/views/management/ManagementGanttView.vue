<script setup lang="ts">
import { ref, computed, unref, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import GanttToolbar from '@/components/management/GanttToolbar.vue'
import GanttChart from '@/components/management/GanttChart.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Trash2 } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { listProjectWbs, updateWbsNode, moveWbsNode } from '@/api/wbs'
import {
  syncLeafStartDatesToFsConstraints,
  hasAnyTaskDependencies,
} from '@/lib/wbs-fs-schedule'
import { wbsEndDateInclusive, wbsDurationInclusiveDays } from '@/lib/wbs-schedule-dates'
import { useGantt } from '@/composables/useGantt'
import type { GanttTask, GanttLeftColumnItem, GanttMilestoneLine, GanttScaleMode } from '@/types/gantt'
import type { WbsNode } from '@/types/wbs'

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const STORAGE_KEY_LEFT_WIDTH = 'gantt-left-width'
const STORAGE_KEY_TOOLBAR = 'gantt-toolbar'
const STORAGE_KEY_MILESTONES = 'gantt-milestone-lines'

/** 左側任務列寬度（可拖曳分隔線調整，會寫入 localStorage） */
const leftWidthVal = ref(280)

/** WBS 樹（與 WBS 頁面同源，用於收合／拖移） */
const wbsTree = ref<WbsNode[]>([])
/** 展開的節點 id 集合（收合結構） */
const expandedIds = ref<Set<string>>(new Set())

/** 依展開狀態將樹扁平化（與 WBS 頁面相同邏輯） */
function flattenTree(
  nodes: WbsNode[],
  expanded: Set<string>,
  depth: number,
  parentId: string | null = null
): { node: WbsNode; depth: number; hasChildren: boolean; parentId: string | null }[] {
  const result: { node: WbsNode; depth: number; hasChildren: boolean; parentId: string | null }[] = []
  for (const node of nodes) {
    const hasChildren = Boolean(node.children?.length)
    result.push({ node, depth, hasChildren, parentId })
    if (hasChildren && expanded.has(node.id)) {
      result.push(...flattenTree(node.children!, expanded, depth + 1, node.id))
    }
  }
  return result
}

const flattenedList = computed(() => flattenTree(wbsTree.value, expandedIds.value, 0))

const defaultStart = '2025-01-06'
const STORAGE_KEY_DEPS = 'gantt-dependencies'

/** 前置任務對應：taskId -> 前置任務 id 陣列（僅前端儲存，可改存後端） */
const taskDependencies = ref<Record<string, string[]>>({})

function loadDependenciesFromStorage() {
  const pid = projectId.value
  if (!pid) return
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_DEPS}-${pid}`)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string[]>
      if (parsed && typeof parsed === 'object') taskDependencies.value = parsed
    }
  } catch {
    // ignore
  }
}

function saveDependenciesToStorage() {
  const pid = projectId.value
  if (!pid) return
  try {
    localStorage.setItem(`${STORAGE_KEY_DEPS}-${pid}`, JSON.stringify(taskDependencies.value))
  } catch {
    // ignore
  }
}

function nodeToGanttTask(node: WbsNode, depth: number, leafIds?: Set<string>): GanttTask {
  const start = node.startDate ?? defaultStart
  const dur = node.durationDays ?? 14
  const end = node.endDate ?? wbsEndDateInclusive(start, dur)
  let deps = [...(taskDependencies.value[node.id] ?? [])]
  if (leafIds) deps = deps.filter((d) => leafIds.has(d))
  return {
    id: node.id,
    name: node.name,
    wbsCode: node.code,
    plannedStart: start,
    plannedEnd: end,
    progress: 0,
    assignee: node.resources?.[0]?.name,
    depth,
    dependencies: deps,
    isProjectRoot: node.isProjectRoot ?? false,
  }
}

/** 葉節點 id（前置關係僅在葉節點間有效） */
const leafIdSet = computed(
  () => new Set(flattenedList.value.filter((i) => !i.hasChildren).map((i) => i.node.id))
)

/** 父層列為子項時間包絡（isRollup）；葉節點排程以 API 儲存為準，不因前置自動改寫顯示 */
function buildDisplayTask(
  node: WbsNode,
  depth: number,
  memo: Map<string, GanttTask>
): GanttTask {
  if (!node.children?.length) {
    return nodeToGanttTask(node, depth, leafIdSet.value)
  }
  if (memo.has(node.id)) {
    const c = memo.get(node.id)!
    return { ...c, depth }
  }
  const childTasks = node.children!.map((ch) => buildDisplayTask(ch, depth + 1, memo))
  let minStart = ''
  let maxEnd = ''
  for (const ct of childTasks) {
    if (ct.plannedStart && (!minStart || ct.plannedStart < minStart)) minStart = ct.plannedStart
    if (ct.plannedEnd && (!maxEnd || ct.plannedEnd > maxEnd)) maxEnd = ct.plannedEnd
  }
  if (!minStart) minStart = defaultStart
  if (!maxEnd) {
    const d = new Date(minStart)
    d.setDate(d.getDate() + 1)
    maxEnd = d.toISOString().slice(0, 10)
  }
  const t: GanttTask = {
    id: node.id,
    name: node.name,
    wbsCode: node.code,
    plannedStart: minStart,
    plannedEnd: maxEnd,
    progress: 0,
    depth,
    dependencies: [],
    isRollup: true,
  }
  memo.set(node.id, { ...t })
  return t
}

const tasks = computed<GanttTask[]>(() => {
  const memo = new Map<string, GanttTask>()
  return flattenedList.value.map((item) => buildDisplayTask(item.node, item.depth, memo))
})

/** 左欄列項目（任務用排程後日期，與圖表一致） */
const leftColumnItems = computed<GanttLeftColumnItem[]>(() =>
  flattenedList.value.map((item, i) => ({
    task: tasks.value[i] ?? nodeToGanttTask(item.node, item.depth),
    hasChildren: item.hasChildren,
    isExpanded: expandedIds.value.has(item.node.id),
    parentId: item.parentId,
  }))
)

const loading = ref(false)
const scaleMode = ref<GanttScaleMode>('week')
const gantt = useGantt(tasks, { scaleMode })

const showActualPlan = ref(true)
const showCriticalPath = ref(false)
const showTodayLine = ref(true)
const showMilestoneLines = ref(true)
const showAssignee = ref(true)
const showProgress = ref(true)

const milestoneLines = ref<GanttMilestoneLine[]>([
  { id: 'm1', label: '主體完成', date: '2025-05-30' },
  { id: 'm2', label: '竣工', date: '2025-10-13' },
])

function loadToolbarFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TOOLBAR)
    if (raw) {
      const data = JSON.parse(raw) as Record<string, unknown>
      if (typeof data.scaleMode === 'string' && ['day', 'week', 'month', 'year'].includes(data.scaleMode)) {
        scaleMode.value = data.scaleMode as GanttScaleMode
      }
      if (typeof data.showActualPlan === 'boolean') showActualPlan.value = data.showActualPlan
      if (typeof data.showCriticalPath === 'boolean') showCriticalPath.value = data.showCriticalPath
      if (typeof data.showTodayLine === 'boolean') showTodayLine.value = data.showTodayLine
      if (typeof data.showMilestoneLines === 'boolean') showMilestoneLines.value = data.showMilestoneLines
      if (typeof data.showAssignee === 'boolean') showAssignee.value = data.showAssignee
      if (typeof data.showProgress === 'boolean') showProgress.value = data.showProgress
    }
    const ms = localStorage.getItem(STORAGE_KEY_MILESTONES)
    if (ms) {
      const arr = JSON.parse(ms) as GanttMilestoneLine[]
      if (Array.isArray(arr) && arr.length > 0) {
        milestoneLines.value = arr.filter((m) => m?.id && m?.label && m?.date)
      }
    }
  } catch {
    // ignore
  }
}

onMounted(() => {
  const v = localStorage.getItem(STORAGE_KEY_LEFT_WIDTH)
  leftWidthVal.value = v ? Math.max(200, Math.min(520, parseInt(v, 10))) : 280
  loadToolbarFromStorage()
})

watch(leftWidthVal, (w) => {
  try {
    localStorage.setItem(STORAGE_KEY_LEFT_WIDTH, String(w))
  } catch {
    // ignore
  }
})

watch(
  () => ({
    scaleMode: scaleMode.value,
    showActualPlan: showActualPlan.value,
    showCriticalPath: showCriticalPath.value,
    showTodayLine: showTodayLine.value,
    showMilestoneLines: showMilestoneLines.value,
    showAssignee: showAssignee.value,
    showProgress: showProgress.value,
  }),
  (data) => {
    try {
      localStorage.setItem(STORAGE_KEY_TOOLBAR, JSON.stringify(data))
    } catch {
      // ignore
    }
  },
  { deep: true }
)

watch(
  milestoneLines,
  (list) => {
    try {
      localStorage.setItem(STORAGE_KEY_MILESTONES, JSON.stringify(list))
    } catch {
      // ignore
    }
  },
  { deep: true }
)

function expandAll() {
  const ids = new Set<string>()
  function collect(nodes: WbsNode[]) {
    for (const n of nodes) {
      if (n.children?.length) {
        ids.add(n.id)
        collect(n.children)
      }
    }
  }
  collect(wbsTree.value)
  expandedIds.value = ids
}

function toggleExpand(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

/** 拖移後呼叫 API 移動節點（與 WBS 頁面相同） */
async function moveNodeToFlatIndex(nodeId: string, insertBeforeIndex: number) {
  if (!projectId.value) return
  const flat = flattenedList.value
  const currentIndex = flat.findIndex((it) => it.node.id === nodeId)
  if (currentIndex === -1 || currentIndex === insertBeforeIndex) return
  if (insertBeforeIndex === 0 && flat[0]?.node.isProjectRoot) {
    const rootId = flat[0].node.id
    const nextRow = flat[1]
    const insertBeforeId =
      nextRow?.parentId === rootId ? nextRow.node.id : undefined
    try {
      const tree = await moveWbsNode(projectId.value, nodeId, {
        parentId: rootId,
        insertBeforeId,
      })
      wbsTree.value = tree
    } catch {
      // ignore
    }
    return
  }
  const refItem = insertBeforeIndex < flat.length ? flat[insertBeforeIndex] : flat[flat.length - 1]
  if (!refItem) return
  try {
    const tree = await moveWbsNode(projectId.value, nodeId, {
      parentId: refItem.parentId,
      insertBeforeId: insertBeforeIndex < flat.length ? refItem.node.id : undefined,
    })
    wbsTree.value = tree
  } catch {
    // 錯誤由 api client 或 toast 處理
  }
}

function patchWbsNodeSchedule(
  nodes: WbsNode[],
  nodeId: string,
  startDate: string,
  durationDays: number
): WbsNode[] {
  const endDate = wbsEndDateInclusive(startDate, durationDays)
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, startDate, durationDays, endDate }
    }
    if (node.children?.length) {
      return {
        ...node,
        children: patchWbsNodeSchedule(node.children, nodeId, startDate, durationDays),
      }
    }
    return node
  })
}

async function fetchWbs(options?: { silent?: boolean }) {
  const id = projectId.value
  if (!id) return
  const silent = options?.silent === true
  if (!silent) loading.value = true
  try {
    const tree = await listProjectWbs(id)
    wbsTree.value = tree
    expandAll()
  } catch {
    if (!silent) wbsTree.value = []
  } finally {
    if (!silent) loading.value = false
  }
}

async function runFsSyncLeaves() {
  const id = projectId.value
  if (!id || !wbsTree.value.length) return
  await syncLeafStartDatesToFsConstraints(
    id,
    wbsTree.value,
    taskDependencies.value,
    defaultStart,
    updateWbsNode,
    async () => fetchWbs({ silent: true })
  )
}

/**
 * 僅在「使用者變更前置關係」時寫回 API：後續開始日 = 前置完成日 +1。
 * 勿在重整／進頁時跑，否則每次載入 localStorage 都會觸發、日期被一再往後推。
 */
const debouncedSyncOnDepsChange = useDebounceFn(runFsSyncLeaves, 500)

onMounted(async () => {
  loadDependenciesFromStorage()
  await fetchWbs()
})
/** 僅首次載入後捲到今天（每次 fetchWbs 都 goToToday 會像一直重整） */
const ganttInitialScrollDone = ref(false)
watch(loading, (isLoading) => {
  if (!isLoading && wbsTree.value.length > 0 && !ganttInitialScrollDone.value) {
    ganttInitialScrollDone.value = true
    nextTick(() => goToToday())
  }
})
watch(projectId, async (id) => {
  ganttInitialScrollDone.value = false
  if (id) {
    loadDependenciesFromStorage()
    await fetchWbs()
  }
})

const chartWidthVal = computed(() => unref(gantt.chartWidth))
const panXVal = computed(() => unref(gantt.panX))
const criticalPathMapVal = computed(() => unref(gantt.criticalPathMap))
const scaleTicksVal = computed(() => unref(gantt.scaleTicks))
const weekendRangesVal = computed(() => unref(gantt.weekendRanges))

const milestoneDialogOpen = ref(false)
const newMilestoneLabel = ref('')
const newMilestoneDate = ref('2025-06-01')

function addMilestoneLine() {
  milestoneDialogOpen.value = true
  newMilestoneLabel.value = ''
  newMilestoneDate.value = new Date().toISOString().slice(0, 10)
}

function confirmAddMilestone() {
  if (!newMilestoneLabel.value.trim()) return
  milestoneLines.value = [
    ...milestoneLines.value,
    {
      id: 'm' + Date.now(),
      label: newMilestoneLabel.value.trim(),
      date: newMilestoneDate.value,
    },
  ]
  newMilestoneLabel.value = ''
  newMilestoneDate.value = new Date().toISOString().slice(0, 10)
}

function removeMilestoneLine(id: string) {
  milestoneLines.value = milestoneLines.value.filter((m) => m.id !== id)
}

function updateDependencies(taskId: string, predecessorIds: string[]) {
  const copy = { ...taskDependencies.value }
  if (predecessorIds.length === 0) delete copy[taskId]
  else copy[taskId] = predecessorIds
  taskDependencies.value = copy
  saveDependenciesToStorage()
  debouncedSyncOnDepsChange()
}

function addDependency(fromTaskId: string, toTaskId: string) {
  if (fromTaskId === toTaskId) return
  if (!leafIdSet.value.has(fromTaskId) || !leafIdSet.value.has(toTaskId)) return
  const current = taskDependencies.value[toTaskId] ?? []
  if (current.includes(fromTaskId)) return
  taskDependencies.value = {
    ...taskDependencies.value,
    [toTaskId]: [...current, fromTaskId],
  }
  saveDependenciesToStorage()
  debouncedSyncOnDepsChange()
}

async function updateTask(updated: GanttTask) {
  if (updated.isRollup) return
  const id = projectId.value
  if (!id) return
  const startDate = updated.plannedStart
  const durationDays = wbsDurationInclusiveDays(updated.plannedStart, updated.plannedEnd)
  try {
    await updateWbsNode(id, updated.id, { startDate, durationDays })
    wbsTree.value = patchWbsNodeSchedule(wbsTree.value, updated.id, startDate, durationDays)
    if (hasAnyTaskDependencies(taskDependencies.value)) {
      await runFsSyncLeaves()
    }
  } catch {
    await fetchWbs({ silent: true })
  }
}

function handleLeftWidthChange(newWidth: number) {
  leftWidthVal.value = newWidth
}

const ganttChartRef = ref<InstanceType<typeof GanttChart> | null>(null)

function goToToday() {
  showTodayLine.value = true
  ganttChartRef.value?.scrollToToday?.()
}

function goToPrevPeriod() {
  const w = ganttChartRef.value?.getViewportWidth?.() ?? 400
  ganttChartRef.value?.scrollBy?.(-w)
}

function goToNextPeriod() {
  const w = ganttChartRef.value?.getViewportWidth?.() ?? 400
  ganttChartRef.value?.scrollBy?.(w)
}

function handlePan(dx: number) {
  gantt.pan(dx)
}

function setScaleMode(v: GanttScaleMode) {
  scaleMode.value = v
}

function setShowActualPlan(v: boolean) {
  showActualPlan.value = v
}
function setShowCriticalPath(v: boolean) {
  showCriticalPath.value = v
}
function setShowTodayLine(v: boolean) {
  showTodayLine.value = v
}
function setShowMilestoneLines(v: boolean) {
  showMilestoneLines.value = v
}
function setShowAssignee(v: boolean) {
  showAssignee.value = v
}
function setShowProgress(v: boolean) {
  showProgress.value = v
}

/** 以當前可見範圍的「中間時間」為中心縮放，縮放後該時間仍保持在視窗中央 */
function zoomInAroundCenter() {
  const chart = ganttChartRef.value
  const scrollLeft = chart?.getScrollLeft?.() ?? 0
  const viewportW = chart?.getViewportWidth?.() ?? 400
  const centerMs = gantt.pxToDate(scrollLeft + viewportW / 2)
  gantt.zoomIn()
  nextTick(() => {
    const newScrollLeft = gantt.dateToPx(centerMs) - viewportW / 2
    chart?.setScrollLeft?.(newScrollLeft)
  })
}

function zoomOutAroundCenter() {
  const chart = ganttChartRef.value
  const scrollLeft = chart?.getScrollLeft?.() ?? 0
  const viewportW = chart?.getViewportWidth?.() ?? 400
  const centerMs = gantt.pxToDate(scrollLeft + viewportW / 2)
  gantt.zoomOut()
  nextTick(() => {
    const newScrollLeft = gantt.dateToPx(centerMs) - viewportW / 2
    chart?.setScrollLeft?.(newScrollLeft)
  })
}

</script>

<template>
  <div
    class="flex h-[calc(100dvh-11.5rem)] min-h-[20rem] flex-col gap-3 overflow-hidden md:h-[calc(100dvh-10.25rem)] md:gap-4"
  >
    <header class="flex shrink-0 flex-wrap items-center justify-between gap-4">
      <h1 class="text-xl font-semibold text-foreground">甘特圖</h1>
    </header>
    <p class="max-w-3xl shrink-0 text-xs text-muted-foreground">
      <strong class="text-foreground">虛線橫條</strong>為父層由子項彙總之區間，不可拖曳或改期；排程與前置請在<strong
        class="text-foreground"
        >葉節點</strong
      >（無子項）操作。
    </p>

    <p v-if="loading" class="shrink-0 text-sm text-muted-foreground">載入 WBS…</p>

    <!-- 第二行：開關與新增里程碑靠右（年月、尺度、縮放、今天已移至圖表時間軸上方） -->
    <div class="flex shrink-0 flex-wrap items-center justify-end">
      <GanttToolbar
        :show-actual-plan="showActualPlan"
        :show-critical-path="showCriticalPath"
        :show-today-line="showTodayLine"
        :show-milestone-lines="showMilestoneLines"
        :show-assignee="showAssignee"
        :show-progress="showProgress"
        @update:show-actual-plan="setShowActualPlan"
        @update:show-critical-path="setShowCriticalPath"
        @update:show-today-line="setShowTodayLine"
        @update:show-milestone-lines="setShowMilestoneLines"
        @update:show-assignee="setShowAssignee"
        @update:show-progress="setShowProgress"
        @add-milestone-line="addMilestoneLine"
      />
    </div>

    <!-- 佔滿主內容剩餘高度，底部不留空 -->
    <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <GanttChart
        ref="ganttChartRef"
        v-show="!loading"
        class="min-h-0 flex-1"
        :tasks="tasks"
        :left-column-items="leftColumnItems"
        :date-to-px="gantt.dateToPx"
        :px-to-date="gantt.pxToDate"
        :chart-width="chartWidthVal"
        :pan-x="panXVal"
        :left-width="leftWidthVal"
        :px-per-day="gantt.pxPerDay"
        :weekend-ranges="weekendRangesVal"
        :critical-path-map="criticalPathMapVal"
        :scale-ticks="scaleTicksVal"
        :scale-mode="gantt.scaleMode"
        :show-actual-plan="showActualPlan"
        :show-critical-path="showCriticalPath"
        :show-today-line="showTodayLine"
        :show-milestone-lines="showMilestoneLines"
        :milestone-lines="milestoneLines"
        :show-assignee="showAssignee"
        :show-progress="showProgress"
        @pan="handlePan"
        @update:scale-mode="setScaleMode"
        @zoom-in="zoomInAroundCenter"
        @zoom-out="zoomOutAroundCenter"
        @go-to-today="goToToday"
        @go-to-prev-period="goToPrevPeriod"
        @go-to-next-period="goToNextPeriod"
        @toggle-expand="toggleExpand"
        @move-node="moveNodeToFlatIndex"
        @update:left-width="handleLeftWidthChange"
        @update:task="updateTask"
        @update:dependencies="updateDependencies"
        @add-dependency="addDependency"
        @update:show-critical-path="setShowCriticalPath"
        @update:show-milestone-lines="setShowMilestoneLines"
        @update:show-assignee="setShowAssignee"
      />
    </div>

    <Dialog v-model:open="milestoneDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>里程碑線</DialogTitle>
          <DialogDescription>
            在指定日期顯示垂直線與標籤。工具列可開關「里程碑線」顯示。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <!-- 目前列表：可刪除 -->
          <div v-if="milestoneLines.length > 0" class="grid gap-2">
            <Label class="text-muted-foreground text-xs">目前里程碑線</Label>
            <ul class="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
              <li
                v-for="ml in milestoneLines"
                :key="ml.id"
                class="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm"
              >
                <span class="min-w-0 truncate text-foreground">{{ ml.label }}</span>
                <span class="shrink-0 text-xs text-muted-foreground">{{ ml.date }}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="刪除此里程碑線"
                  @click="removeMilestoneLine(ml.id)"
                >
                  <Trash2 class="size-4" />
                </Button>
              </li>
            </ul>
          </div>
          <!-- 新增 -->
          <div class="grid gap-2">
            <Label for="ml-label" class="text-xs">新增一筆</Label>
            <div class="flex gap-2">
              <Input
                id="ml-label"
                v-model="newMilestoneLabel"
                placeholder="標籤"
                class="flex-1"
              />
              <Input
                v-model="newMilestoneDate"
                type="date"
                class="w-[140px]"
              />
            </div>
            <Button class="w-full" @click="confirmAddMilestone">
              新增里程碑線
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="milestoneDialogOpen = false">
            關閉
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
