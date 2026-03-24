<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { VueFlow, ConnectionMode, defaultEdgeTypes } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import dagre from 'dagre'
import type { Node, Edge, Connection, EdgeChange, EdgeTypesObject } from '@vue-flow/core'
import type { WbsNode } from '@/types/wbs'
import WorkPackageNode from '@/components/management/WorkPackageNode.vue'
import type { WorkPackageData } from '@/components/management/WorkPackageNode.vue'
import ChannelSmoothStepEdge from '@/components/management/ChannelSmoothStepEdge.vue'
import { Button } from '@/components/ui/button'

const channelEdgeTypes = {
  ...defaultEdgeTypes,
  channelSmoothstep: ChannelSmoothStepEdge,
} as EdgeTypesObject
import { LayoutGrid } from 'lucide-vue-next'

/** 與 Node<WorkPackageData> 結構相容的節點型別，避免 Vue Flow 泛型過深觸發 TS2589 */
type FlowNodeItem = {
  id: string
  position: { x: number; y: number }
  type: string
  data: WorkPackageData
}

const NODE_WIDTH = 200
const NODE_HEIGHT = 100
const STORAGE_KEY_POSITIONS = 'wbs-network-positions'
const props = withDefaults(
  defineProps<{
    wbsTree: WbsNode[]
    workPackageIds: string[]
    taskDependencies: Record<string, string[]>
    /** 專案 id，有值時會依此儲存／還原任務節點位置 */
    projectId?: string
  }>(),
  { projectId: '' }
)
/** 從 localStorage 讀取已儲存的節點位置 */
function loadSavedPositions(): Record<string, { x: number; y: number }> {
  if (!props.projectId) return {}
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_POSITIONS}-${props.projectId}`)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, { x: number; y: number }>
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    // ignore
  }
  return {}
}
/** 將目前節點位置寫入 localStorage */
function savePositionsToStorage() {
  if (!props.projectId) return
  try {
    const pos: Record<string, { x: number; y: number }> = {}
    flowNodes.value.forEach((n) => {
      pos[n.id] = { x: n.position.x, y: n.position.y }
    })
    localStorage.setItem(`${STORAGE_KEY_POSITIONS}-${props.projectId}`, JSON.stringify(pos))
  } catch {
    // ignore
  }
}
function collectAllNodes(nodes: WbsNode[]): WbsNode[] {
  const out: WbsNode[] = []
  for (const n of nodes) {
    out.push(n)
    if (n.children?.length) out.push(...collectAllNodes(n.children))
  }
  return out
}
const nodeMap = computed(() => {
  const all = collectAllNodes(props.wbsTree)
  return new Map(all.map((n) => [n.id, n]))
})
const MS_PER_DAY = 24 * 60 * 60 * 1000
function parseDate(d: string): number {
  return new Date(d).setHours(0, 0, 0, 0)
}
export type ScheduleEntry = {
  es: number
  ef: number
  ls: number
  lf: number
  slack: number
  isCritical: boolean
}
/** 要徑與浮時（僅針對任務），即時依 workPackageIds / taskDependencies / wbsTree 重算 */
function computeSchedule(): Map<string, ScheduleEntry> {
  const ids = props.workPackageIds
  const deps = props.taskDependencies
  const nodes = ids.map((id) => nodeMap.value.get(id)).filter(Boolean) as WbsNode[]
  if (nodes.length === 0) return new Map()
  const getDuration = (n: WbsNode) => Math.max(1, n.durationDays ?? 0)
  const projectStart =
    Math.min(...nodes.map((n) => (n.startDate ? parseDate(n.startDate) : 0))) || Date.now()
  const toDay = (ms: number) => Math.round((ms - projectStart) / MS_PER_DAY)
  const schedule = new Map<string, ScheduleEntry>()
  const sorted: WbsNode[] = []
  const visited = new Set<string>()
  function visit(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    for (const predId of deps[id] ?? []) {
      if (ids.includes(predId)) visit(predId)
    }
    const n = nodeMap.value.get(id)
    if (n) sorted.push(n)
  }
  nodes.forEach((n) => visit(n.id))
  for (const n of sorted) {
    const preds = (deps[n.id] ?? []).filter((id) => ids.includes(id))
    const es =
      preds.length > 0
        ? Math.max(0, ...preds.map((id) => schedule.get(id)?.ef ?? 0))
        : Math.max(0, n.startDate ? toDay(parseDate(n.startDate)) : 0)
    const dur = getDuration(n)
    const ef = es + dur
    schedule.set(n.id, { es, ef, ls: 0, lf: 0, slack: 0, isCritical: false })
  }
  const projectEnd = Math.max(0, ...Array.from(schedule.values()).map((s) => s.ef))
  for (let i = sorted.length - 1; i >= 0; i--) {
    const n = sorted[i]
    const s = schedule.get(n.id)!
    const successors = nodes.filter((x) => (deps[x.id] ?? []).includes(n.id))
    const lf =
      successors.length > 0
        ? Math.min(...successors.map((x) => schedule.get(x.id)?.ls ?? projectEnd))
        : projectEnd
    const dur = getDuration(n)
    const ls = lf - dur
    s.lf = lf
    s.ls = ls
    s.slack = s.ls - s.es
    s.isCritical = s.slack <= 0
  }
  return schedule
}
const scheduleMap = computed(() => computeSchedule())
const flowNodes = ref<FlowNodeItem[]>([])
const flowEdges = ref<Edge[]>([])
const flowNodesForFlow = computed(() => flowNodes.value as Node<WorkPackageData>[])
const flowEdgesForFlow = computed(() => flowEdges.value)
/** 網格備援版面（dagre 在含環或部分圖形會拋錯） */
function gridPositionsForNodes(nodeList: WbsNode[]): Record<string, { x: number; y: number }> {
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodeList.length)))
  const out: Record<string, { x: number; y: number }> = {}
  nodeList.forEach((n, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    out[n.id] = {
      x: col * (NODE_WIDTH + 100),
      y: row * (NODE_HEIGHT + 80),
    }
  })
  return out
}

type EdgePair = { v: string; w: string }
function getNodesAndEdges(): { nodes: WbsNode[]; edgePairs: EdgePair[] } {
  const ids = props.workPackageIds
  const nodes = ids.map((id) => nodeMap.value.get(id)).filter(Boolean) as WbsNode[]
  const edgePairs: EdgePair[] = []
  const edgeKey = new Set<string>()
  for (const n of nodes) {
    for (const predId of props.taskDependencies[n.id] ?? []) {
      if (!ids.includes(predId)) continue
      const k = `${predId}->${n.id}`
      if (edgeKey.has(k)) continue
      edgeKey.add(k)
      edgePairs.push({ v: predId, w: n.id })
    }
  }
  return { nodes, edgePairs }
}

/** 節點間距：預留間距讓正交連線有空間繞開方框、不穿越圖形元素（參考流程圖正交連線原則） */
const LAYOUT_H_GAP = 88
const LAYOUT_V_GAP = 56

/**
 * 排版邏輯：
 * - 水平（X）：依開始時間升冪（ES 小→大，左→右）
 * - 垂直（Y）：依名稱升冪（A→Z，上→下）
 * 形成網格，搭配預留間距使連線有空間、少壓到方框
 */
function computeTimeBasedLayout(
  nodes: WbsNode[],
  schedule: Map<string, ScheduleEntry>
): Record<string, { x: number; y: number }> {
  if (nodes.length === 0) return {}
  const byName = [...nodes].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh'))
  const nameToRow = new Map<string, number>()
  byName.forEach((n, i) => nameToRow.set(n.id, i))
  const esValues = [...new Set(nodes.map((n) => schedule.get(n.id)?.es ?? 0))].sort((a, b) => a - b)
  const esToCol = new Map(esValues.map((es, i) => [es, i]))
  const posById: Record<string, { x: number; y: number }> = {}
  for (const n of nodes) {
    const col = esToCol.get(schedule.get(n.id)?.es ?? 0) ?? 0
    const row = nameToRow.get(n.id) ?? 0
    posById[n.id] = {
      x: col * (NODE_WIDTH + LAYOUT_H_GAP),
      y: row * (NODE_HEIGHT + LAYOUT_V_GAP),
    }
  }
  return posById
}

/**
 * 排版：有排程時依任務時間（ES/EF）排序；否則用 dagre 依依賴關係排版
 */
function computeDagreLayout(
  nodes: WbsNode[],
  edgePairs: EdgePair[],
  schedule: Map<string, ScheduleEntry>
): Record<string, { x: number; y: number }> {
  if (nodes.length === 0) return {}
  const hasSchedule = nodes.some((n) => schedule.has(n.id) && schedule.get(n.id) != null)
  if (hasSchedule) return computeTimeBasedLayout(nodes, schedule)

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', ranksep: 48, nodesep: 32 })
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edgePairs.forEach((e) => g.setEdge(e.v, e.w))
  try {
    dagre.layout(g)
    const posById: Record<string, { x: number; y: number }> = {}
    let layoutOk = true
    for (const n of nodes) {
      const meta = g.node(n.id)
      if (
        !meta ||
        typeof meta.x !== 'number' ||
        Number.isNaN(meta.x) ||
        typeof meta.y !== 'number' ||
        Number.isNaN(meta.y)
      ) {
        layoutOk = false
        break
      }
      posById[n.id] = {
        x: meta.x - NODE_WIDTH / 2,
        y: meta.y - NODE_HEIGHT / 2,
      }
    }
    return layoutOk ? posById : gridPositionsForNodes(nodes)
  } catch {
    return gridPositionsForNodes(nodes)
  }
}

function buildGraph() {
  const { nodes, edgePairs } = getNodesAndEdges()
  if (nodes.length === 0) {
    flowNodes.value = []
    flowEdges.value = []
    return
  }
  const savedPos = loadSavedPositions()
  const schedule = scheduleMap.value
  const posById = computeDagreLayout(nodes, edgePairs, schedule)

  const list: FlowNodeItem[] = []
  for (const n of nodes) {
    const node = nodeMap.value.get(n.id)
    if (!node) continue
    const dagrePos = posById[n.id] ?? { x: 0, y: 0 }
    const position = savedPos[n.id] ?? dagrePos
    const s = schedule.get(n.id)
    list.push({
      id: n.id,
      type: 'workPackage',
      position,
      data: {
        node,
        isCritical: s?.isCritical ?? false,
        slack: s?.slack,
      } as WorkPackageData,
    })
  }

  /** 正交連線、轉彎圓角：垂直段固定在來源節點右側通道（centerX），不穿過任務框 */
  const edges: Edge[] = []
  for (const e of edgePairs) {
    const sourceS = schedule.get(e.v)
    const targetS = schedule.get(e.w)
    const isCriticalEdge =
      Boolean(sourceS?.isCritical && targetS?.isCritical) && targetS?.es === sourceS?.ef
    const srcPos = posById[e.v]
    const bendX = srcPos ? srcPos.x + NODE_WIDTH + LAYOUT_H_GAP / 2 : undefined
    edges.push({
      id: `e-${e.v}-${e.w}`,
      source: e.v,
      target: e.w,
      type: 'channelSmoothstep',
      pathOptions: bendX != null ? { centerX: bendX, borderRadius: 8 } : { borderRadius: 8 },
      style: isCriticalEdge ? { stroke: 'var(--destructive)', strokeWidth: 2.5 } : undefined,
      class: isCriticalEdge ? 'critical-edge' : undefined,
    } as Edge)
  }
  flowNodes.value = list
  flowEdges.value = edges
}

/** 一鍵排好：依任務時間（ES）與依賴關係以 dagre 重新排版，寫入位置並儲存 */
function arrangeLayout() {
  const { nodes, edgePairs } = getNodesAndEdges()
  if (nodes.length === 0) return
  const posById = computeDagreLayout(nodes, edgePairs, scheduleMap.value)
  flowNodes.value = flowNodes.value.map((n) => ({
    ...n,
    position: posById[n.id] ?? n.position,
  }))
  savePositionsToStorage()
  nextTick(() => {
    vueFlowRef.value?.fitView?.({ padding: 0.2, duration: 200 })
  })
}

const vueFlowRef = ref<InstanceType<typeof VueFlow> | null>(null)

defineExpose({ arrangeLayout })

const emit = defineEmits<{
  /** 從 source 拖到 target：target 新增 source 為前置 */
  'add-dependency': [sourceNodeId: string, targetNodeId: string]
  /** 使用者刪除連線（選取連線後按 Delete）：從 target 的前置移除 source */
  'remove-dependency': [sourceNodeId: string, targetNodeId: string]
}>()

/** 切換任務／樹變動時 Vue Flow 可能送出 remove，勿當成使用者刪除前置 */
let ignoreEdgeRemoveUntil = 0
function scheduleIgnoreEdgeRemoves(ms: number) {
  ignoreEdgeRemoveUntil = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + ms
}

watch(
  () => [props.wbsTree, props.workPackageIds] as const,
  () => scheduleIgnoreEdgeRemoves(180),
  { deep: true }
)

watch(
  () => [props.wbsTree, props.workPackageIds, props.taskDependencies] as const,
  () => buildGraph(),
  { immediate: true, deep: true }
)

/** 使用者拖曳節點結束時寫入目前位置 */
function onNodeDragStop(ev: { node: { id: string; position: { x: number; y: number } } }) {
  const { id, position } = ev.node
  const idx = flowNodes.value.findIndex((n) => n.id === id)
  if (idx >= 0) {
    flowNodes.value = flowNodes.value.map((n, i) => (i === idx ? { ...n, position } : n))
    savePositionsToStorage()
  }
}

/** 使用者從節點 A 的 source handle 拖到節點 B 的 target handle 時：B 的前置加入 A */
function onConnect(ev: Connection | null) {
  if (!ev?.source || !ev?.target || ev.source === ev.target) return
  emit('add-dependency', ev.source, ev.target)
}

function onEdgesChange(changes: EdgeChange[]) {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (now < ignoreEdgeRemoveUntil) return
  for (const ch of changes) {
    if (ch.type !== 'remove') continue
    if (!('source' in ch) || !ch.source || !ch.target) continue
    const preds = props.taskDependencies[ch.target] ?? []
    if (!preds.includes(ch.source)) continue
    emit('remove-dependency', ch.source, ch.target)
  }
}
</script>
<template>
  <div class="flex w-full flex-col gap-2">
    <div v-if="flowNodes.length > 0" class="flex items-center justify-end">
      <Button variant="outline" size="sm" class="gap-1.5" @click="arrangeLayout">
        <LayoutGrid class="size-4" />
        一鍵排好
      </Button>
    </div>
    <div class="relative h-[560px] w-full rounded-lg border border-border bg-muted/30">
      <template v-if="flowNodes.length > 0">
        <VueFlow
          ref="vueFlowRef"
          :nodes="flowNodesForFlow"
          :edges="flowEdgesForFlow"
          :edge-types="channelEdgeTypes"
          :nodes-draggable="true"
          :nodes-connectable="true"
          :connection-mode="ConnectionMode.Strict"
          :elements-selectable="true"
          :fit-view-on-init="true"
          class="rounded-lg"
          @node-drag-stop="onNodeDragStop"
          @connect="onConnect"
          @edges-change="onEdgesChange"
        >
          <template #node-workPackage="props">
            <WorkPackageNode v-bind="props" />
          </template>
          <Background pattern-color="var(--border)" :gap="16" />
        </VueFlow>
      </template>
      <div
        v-else
        class="flex h-full items-center justify-center rounded-lg text-center text-sm text-muted-foreground"
      >
        <p>
          請在「列表」分頁勾選「任務」，網路圖將只顯示任務及其前後關係。<br />
          前置與甘特圖共用；<strong class="text-foreground">點選連線後按 Delete</strong
          >可移除並會儲存。
        </p>
      </div>
    </div>
  </div>
</template>
