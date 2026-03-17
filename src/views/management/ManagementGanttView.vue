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
import { listProjectWbs, updateWbsNode, moveWbsNode } from '@/api/wbs'
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
function nodeToGanttTask(node: WbsNode, depth: number): GanttTask {
  const start = node.startDate ?? defaultStart
  const dur = node.durationDays ?? 14
  const end = node.endDate ?? (() => {
    const d = new Date(start)
    d.setDate(d.getDate() + dur)
    return d.toISOString().slice(0, 10)
  })()
  return {
    id: node.id,
    name: node.name,
    plannedStart: start,
    plannedEnd: end,
    progress: 0,
    assignee: node.resources?.[0]?.name,
    depth,
    dependencies: [],
  }
}

/** 甘特圖用的任務列表（依收合狀態扁平化） */
const tasks = computed<GanttTask[]>(() =>
  flattenedList.value.map((item) => nodeToGanttTask(item.node, item.depth))
)

/** 左欄列項目（任務 + 收合／拖移用） */
const leftColumnItems = computed<GanttLeftColumnItem[]>(() =>
  flattenedList.value.map((item) => ({
    task: nodeToGanttTask(item.node, item.depth),
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

async function fetchWbs() {
  const id = projectId.value
  if (!id) return
  loading.value = true
  try {
    const tree = await listProjectWbs(id)
    wbsTree.value = tree
    expandAll()
  } catch {
    wbsTree.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchWbs()
})
watch(projectId, (id) => {
  if (id) fetchWbs()
})

/** 重整或載入完成後自動捲動至今天並顯示今日線 */
watch(loading, (isLoading) => {
  if (!isLoading) {
    nextTick(() => goToToday())
  }
}, { immediate: true })

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

async function updateTask(updated: GanttTask) {
  const i = tasks.value.findIndex((t) => t.id === updated.id)
  if (i >= 0) tasks.value[i] = { ...updated }
  const id = projectId.value
  if (!id) return
  const startDate = updated.plannedStart
  const durationDays = Math.max(
    1,
    Math.ceil(
      (new Date(updated.plannedEnd).getTime() - new Date(updated.plannedStart).getTime()) /
        (24 * 60 * 60 * 1000)
    )
  )
  try {
    await updateWbsNode(id, updated.id, { startDate, durationDays })
  } catch {
    // 可選：toast 錯誤，並還原 tasks
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
  <div class="space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-xl font-semibold text-foreground">甘特圖</h1>
    </header>

    <p v-if="loading" class="text-sm text-muted-foreground">載入 WBS…</p>

    <!-- 第二行：開關與新增里程碑靠右（年月、尺度、縮放、今天已移至圖表時間軸上方） -->
    <div class="flex flex-wrap items-center justify-end">
      <GanttToolbar
        :show-actual-plan="showActualPlan"
        :show-critical-path="showCriticalPath"
        :show-today-line="showTodayLine"
        :show-milestone-lines="showMilestoneLines"
        :show-assignee="showAssignee"
        :show-progress="showProgress"
        @update:show-actual-plan="(v: boolean) => (showActualPlan = v)"
        @update:show-critical-path="(v: boolean) => (showCriticalPath = v)"
        @update:show-today-line="(v: boolean) => (showTodayLine = v)"
        @update:show-milestone-lines="(v: boolean) => (showMilestoneLines = v)"
        @update:show-assignee="(v: boolean) => (showAssignee = v)"
        @update:show-progress="(v: boolean) => (showProgress = v)"
        @add-milestone-line="addMilestoneLine"
      />
    </div>

    <!-- 甘特圖固定寬度容器，橫向捲動僅發生在圖表區內 -->
    <div class="min-w-0 overflow-hidden">
      <GanttChart
        ref="ganttChartRef"
        v-show="!loading"
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
