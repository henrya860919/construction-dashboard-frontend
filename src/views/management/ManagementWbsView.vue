<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useRoute } from 'vue-router'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { WbsNode, WbsFlatItem } from '@/types/wbs'
import type { GanttTask } from '@/types/gantt'
import GanttPredecessorCell from '@/components/management/GanttPredecessorCell.vue'
import { listProjectWbs, createWbsNode, updateWbsNode, deleteWbsNode, moveWbsNode } from '@/api/wbs'
import { getAllProjectResources } from '@/api/resources'
import type { ProjectResourceItem } from '@/types/resource'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChevronRight,
  ChevronDown,
  Settings,
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MoreHorizontal,
  List,
  Network,
} from 'lucide-vue-next'
import WbsNetworkDiagram from '@/components/management/WbsNetworkDiagram.vue'
import { isWbsLeaf, rollupWbsSchedule, rollupResourceLabels } from '@/lib/wbs-rollup'
import { syncLeafStartDatesToFsConstraints, hasAnyTaskDependencies } from '@/lib/wbs-fs-schedule'
import { wbsEndDateInclusive } from '@/lib/wbs-schedule-dates'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { ensureProjectPermission } from '@/lib/permission-toast'

const STORAGE_KEY_WORK_PACKAGES = 'gantt-work-packages'
const STORAGE_KEY_DEPS = 'gantt-dependencies'
const defaultWbsStart = '2025-01-06'

/** 任務 id 列表（勾選的工項才會在網路圖顯示） */
const workPackageIds = ref<string[]>([])

/** 前置任務（與甘特圖共用，key = taskId, value = 前置 id 陣列） */
const taskDependencies = ref<Record<string, string[]>>({})

function loadWorkPackagesFromStorage() {
  const pid = projectId.value
  if (!pid) return
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_WORK_PACKAGES}-${pid}`)
    if (raw) {
      const parsed = JSON.parse(raw) as string[]
      if (Array.isArray(parsed)) workPackageIds.value = parsed
    }
  } catch {
    // ignore
  }
}

function saveWorkPackagesToStorage() {
  const pid = projectId.value
  if (!pid) return
  try {
    localStorage.setItem(
      `${STORAGE_KEY_WORK_PACKAGES}-${pid}`,
      JSON.stringify(workPackageIds.value)
    )
  } catch {
    // ignore
  }
}

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

function setWorkPackageChecked(node: WbsNode, checked: boolean) {
  if (!isWbsLeaf(node)) return
  const id = node.id
  const has = workPackageIds.value.includes(id)
  if (checked && !has) {
    workPackageIds.value = [...workPackageIds.value, id]
    saveWorkPackagesToStorage()
  } else if (!checked && has) {
    workPackageIds.value = workPackageIds.value.filter((x) => x !== id)
    saveWorkPackagesToStorage()
  }
}

const activeWbsTab = ref('list')
const networkDiagramRef = ref<InstanceType<typeof WbsNetworkDiagram> | null>(null)
watch(activeWbsTab, (v) => {
  if (v === 'network') loadDependenciesFromStorage()
})

/** 目前展開的節點 id 集合（未在集合內則視為收合） */
const expandedIds = ref<Set<string>>(new Set())

/** 已勾選的節點 id 集合（階層勾選：勾選父會勾選所有子，取消勾選同理） */
const selectedIds = ref<Set<string>>(new Set())

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)
const wbsPerm = useProjectModuleActions(projectId, 'project.wbs')
/** 模板 v-if / :disabled 須用頂層 ref，避免 wbsPerm.canX 巢狀 Computed 未解包 */
const canCreateWbs = wbsPerm.canCreate
const canUpdateWbs = wbsPerm.canUpdate
const canDeleteWbs = wbsPerm.canDelete

/** WBS 樹狀資料（由 API 取得） */
const wbsTree = ref<WbsNode[]>([])
const loading = ref(false)
const listError = ref<string | null>(null)

/** 依展開狀態將樹扁平化，供表格逐列渲染（含 parentId 供拖移 API） */
function flattenTree(
  nodes: WbsNode[],
  expanded: Set<string>,
  depth: number,
  parentId: string | null = null
): WbsFlatItem[] {
  const result: WbsFlatItem[] = []
  for (const node of nodes) {
    const hasChildren = Boolean(node.children?.length)
    result.push({ node, depth, hasChildren, parentId })
    if (hasChildren && expanded.has(node.id)) {
      result.push(...flattenTree(node.children!, expanded, depth + 1, node.id))
    }
  }
  return result
}

const flattenedList = computed<WbsFlatItem[]>(() =>
  flattenTree(wbsTree.value, expandedIds.value, 0)
)

function flattenAllWbsNodes(nodes: WbsNode[]): WbsNode[] {
  const out: WbsNode[] = []
  for (const n of nodes) {
    out.push(n)
    if (n.children?.length) out.push(...flattenAllWbsNodes(n.children))
  }
  return out
}

/** 整棵樹所有節點：供前置欄用 id 對應編號（與父層收合／展開無關） */
const wbsAllNodesAsGanttTasks = computed<GanttTask[]>(() =>
  flattenAllWbsNodes(wbsTree.value).map((node) => {
    const r = rollupWbsSchedule(node)
    return {
      id: node.id,
      name: node.name,
      wbsCode: node.code,
      dependencies: isWbsLeaf(node) ? (taskDependencies.value[node.id] ?? []) : [],
      plannedStart: r.startDate ?? '',
      plannedEnd: r.endDate ?? '',
      progress: 0,
    }
  })
)

function collectAllLeafWbsNodes(nodes: WbsNode[]): WbsNode[] {
  const out: WbsNode[] = []
  for (const n of nodes) {
    if (isWbsLeaf(n)) out.push(n)
    else if (n.children?.length) out.push(...collectAllLeafWbsNodes(n.children))
  }
  return out
}

/** 全部葉節點：前置下拉可選對象（含收合在父層下的葉節點） */
const wbsAllLeavesAsGanttTasks = computed<GanttTask[]>(() =>
  collectAllLeafWbsNodes(wbsTree.value).map((node) => {
    const r = rollupWbsSchedule(node)
    return {
      id: node.id,
      name: node.name,
      wbsCode: node.code,
      dependencies: taskDependencies.value[node.id] ?? [],
      plannedStart: r.startDate ?? '',
      plannedEnd: r.endDate ?? '',
      progress: 0,
    }
  })
)

/** 扁平節點轉成 GanttPredecessorCell 目前列之 task（含 dependencies） */
const wbsAsGanttTasks = computed<GanttTask[]>(() =>
  flattenedList.value.map(({ node }) => {
    const r = rollupWbsSchedule(node)
    return {
      id: node.id,
      name: node.name,
      wbsCode: node.code,
      dependencies: isWbsLeaf(node) ? (taskDependencies.value[node.id] ?? []) : [],
      plannedStart: r.startDate ?? '',
      plannedEnd: r.endDate ?? '',
      progress: 0,
    }
  })
)

function setNodeDependencies(nodeId: string, predecessorIds: string[]) {
  const copy = { ...taskDependencies.value }
  if (predecessorIds.length === 0) delete copy[nodeId]
  else copy[nodeId] = predecessorIds
  taskDependencies.value = copy
  saveDependenciesToStorage()
  debouncedSyncOnDepsChange()
}

/** 網路圖從節點 A 拖到節點 B 連線：B 的前置加入 A；連線後自動重排版面 */
function onNetworkAddDependency(sourceNodeId: string, targetNodeId: string) {
  if (sourceNodeId === targetNodeId) return
  const current = taskDependencies.value[targetNodeId] ?? []
  if (current.includes(sourceNodeId)) return
  taskDependencies.value = {
    ...taskDependencies.value,
    [targetNodeId]: [...current, sourceNodeId],
  }
  saveDependenciesToStorage()
  debouncedSyncOnDepsChange()
  nextTick(() => networkDiagramRef.value?.arrangeLayout?.())
}

/** 網路圖選取連線後按 Delete：從 target 前置移除 source 並寫入 localStorage */
function onNetworkRemoveDependency(sourceNodeId: string, targetNodeId: string) {
  const preds = taskDependencies.value[targetNodeId] ?? []
  if (!preds.includes(sourceNodeId)) return
  const next = preds.filter((id) => id !== sourceNodeId)
  const copy = { ...taskDependencies.value }
  if (next.length === 0) delete copy[targetNodeId]
  else copy[targetNodeId] = next
  taskDependencies.value = copy
  saveDependenciesToStorage()
  debouncedSyncOnDepsChange()
}

/** 取得該節點與所有子孫的 id 集合（用於階層勾選） */
function collectNodeAndDescendantIds(node: WbsNode): Set<string> {
  const ids = new Set<string>([node.id])
  if (node.children?.length) {
    for (const child of node.children) {
      for (const id of collectNodeAndDescendantIds(child)) {
        ids.add(id)
      }
    }
  }
  return ids
}

/** 該節點在目前勾選狀態下是否為「全選」（自己與所有子孫皆勾選） */
function isRowChecked(node: WbsNode): boolean {
  const ids = collectNodeAndDescendantIds(node)
  return ids.size > 0 && [...ids].every((id) => selectedIds.value.has(id))
}

/** 該節點是否為半選（部分子孫已勾選） */
function isRowIndeterminate(node: WbsNode): boolean {
  const ids = collectNodeAndDescendantIds(node)
  if (ids.size <= 1) return false
  const selectedCount = [...ids].filter((id) => selectedIds.value.has(id)).length
  return selectedCount > 0 && selectedCount < ids.size
}

function toggleSelect(node: WbsNode) {
  const ids = collectNodeAndDescendantIds(node)
  const next = new Set(selectedIds.value)
  const allSelected = [...ids].every((id) => next.has(id))
  if (allSelected) {
    ids.forEach((id) => next.delete(id))
  } else {
    ids.forEach((id) => next.add(id))
  }
  selectedIds.value = next
}

/** 整棵樹的 id 集合（表頭全選用） */
const allNodeIds = computed<Set<string>>(() => {
  const ids = new Set<string>()
  for (const root of wbsTree.value) {
    for (const id of collectNodeAndDescendantIds(root)) {
      ids.add(id)
    }
  }
  return ids
})

const isHeaderChecked = computed(() => {
  const all = allNodeIds.value
  return all.size > 0 && [...all].every((id) => selectedIds.value.has(id))
})

const isHeaderIndeterminate = computed(() => {
  const all = allNodeIds.value
  if (all.size === 0) return false
  const n = [...all].filter((id) => selectedIds.value.has(id)).length
  return n > 0 && n < all.size
})

function toggleHeaderSelect() {
  const all = allNodeIds.value
  if (isHeaderChecked.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(all)
  }
}

function toggleExpand(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expandedIds.value = next
}

/** 預設全部展開（可選：初次載入時呼叫一次） */
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

function collapseAll() {
  expandedIds.value = new Set()
}

/** 各父層（深度）的顯示顏色，key 為 depth，value 為 hex（如 #3b82f6） */
const levelColors = ref<Record<number, string>>({})

/** 樹的最大深度（用於設定表單顯示幾層） */
const maxDepth = computed(() => {
  function getDepth(nodes: WbsNode[], d: number): number {
    let max = d
    for (const n of nodes) {
      if (n.children?.length) {
        max = Math.max(max, getDepth(n.children, d + 1))
      }
    }
    return max
  }
  return getDepth(wbsTree.value, 0)
})

/** 父層列的背景樣式（僅有子節點時套用該層顏色） */
function getParentLevelStyle(item: WbsFlatItem): Record<string, string> | undefined {
  if (!item.hasChildren) return undefined
  const hex = levelColors.value[item.depth]
  if (!hex) return undefined
  return { backgroundColor: `${hex}18` }
}

const settingsOpen = ref(false)

function setLevelColor(depth: number, value: string) {
  if (!canUpdateWbs.value) return
  const next = { ...levelColors.value }
  if (value) {
    next[depth] = value
  } else {
    delete next[depth]
  }
  levelColors.value = next
}

function pruneWorkPackageIdsToLeaves() {
  const leaf = new Set<string>()
  function walk(nodes: WbsNode[]) {
    for (const n of nodes) {
      if (!n.children?.length) leaf.add(n.id)
      else walk(n.children)
    }
  }
  walk(wbsTree.value)
  workPackageIds.value = workPackageIds.value.filter((id) => leaf.has(id))
}

async function fetchWbs() {
  if (!projectId.value) return
  loading.value = true
  listError.value = null
  try {
    const tree = await listProjectWbs(projectId.value)
    wbsTree.value = tree
    pruneWorkPackageIdsToLeaves()
    saveWorkPackagesToStorage()
  } catch (e: unknown) {
    listError.value = e instanceof Error ? e.message : '無法載入 WBS'
  } finally {
    loading.value = false
  }
}

async function runFsSyncLeaves() {
  if (!projectId.value || !wbsTree.value.length) return
  await syncLeafStartDatesToFsConstraints(
    projectId.value,
    wbsTree.value,
    taskDependencies.value,
    defaultWbsStart,
    updateWbsNode,
    fetchWbs
  )
}

/** 僅在使用者變更前置時寫回 FS（勿在進頁／重整時跑） */
const debouncedSyncOnDepsChange = useDebounceFn(runFsSyncLeaves, 500)

/** 執行拖放：呼叫 API 移動節點後重載 */
async function moveNodeToFlatIndex(nodeId: string, insertBeforeIndex: number) {
  if (!projectId.value) return
  const flat = flattenedList.value
  const currentIndex = flat.findIndex((it) => it.node.id === nodeId)
  if (currentIndex === -1 || currentIndex === insertBeforeIndex) return
  /** 插到專案根列「上方」＝改為專案根下第一筆子項 */
  if (insertBeforeIndex === 0 && flat[0]?.node.isProjectRoot) {
    const rootId = flat[0].node.id
    const nextRow = flat[1]
    const insertBeforeId = nextRow?.parentId === rootId ? nextRow.node.id : undefined
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

/** ----- 拖曳狀態（非傳統 DnD，用 pointer + 幽靈 + 插入線） ----- */
const draggingItem = ref<WbsFlatItem | null>(null)
const dropInsertBeforeIndex = ref<number | null>(null)
const ghostPosition = ref({ x: 0, y: 0 })
const tableBodyRef = ref<HTMLElement | null>(null)
const GHOST_OFFSET = { x: 12, y: 8 }

function getTableBodyEl(): HTMLElement | null {
  const ref = tableBodyRef.value
  if (!ref) return null
  return (ref as { $el?: HTMLElement }).$el ?? (ref as HTMLElement)
}

function getRowRects(): { index: number; top: number; height: number }[] {
  const el = getTableBodyEl()
  if (!el) return []
  const rows = el.querySelectorAll<HTMLElement>('tr[data-flat-index]')
  return Array.from(rows).map((tr) => ({
    index: Number(tr.dataset.flatIndex),
    top: tr.getBoundingClientRect().top,
    height: tr.getBoundingClientRect().height,
  }))
}

function hitTestInsertIndex(clientY: number): number | null {
  const rects = getRowRects()
  if (!rects.length) return null
  for (let i = 0; i < rects.length; i++) {
    const { top, height } = rects[i]
    const mid = top + height / 2
    if (clientY < mid) return rects[i].index
  }
  return rects[rects.length - 1].index + 1
}

function onDragHandlePointerDown(e: PointerEvent, item: WbsFlatItem) {
  if (item.node.isProjectRoot) return
  if ((e.target as HTMLElement).closest('button')) return
  e.preventDefault()
  const handleEl = e.currentTarget as HTMLElement
  handleEl.setPointerCapture(e.pointerId)
  draggingItem.value = item
  ghostPosition.value = { x: e.clientX + GHOST_OFFSET.x, y: e.clientY + GHOST_OFFSET.y }
  dropInsertBeforeIndex.value = null

  function onMove(ev: PointerEvent) {
    ghostPosition.value = { x: ev.clientX + GHOST_OFFSET.x, y: ev.clientY + GHOST_OFFSET.y }
    const idx = hitTestInsertIndex(ev.clientY)
    const flat = flattenedList.value
    const currentIdx = flat.findIndex((it) => it.node.id === item.node.id)
    if (idx !== null && idx !== currentIdx && idx !== currentIdx + 1) {
      dropInsertBeforeIndex.value = idx
    } else {
      dropInsertBeforeIndex.value = null
    }
  }
  function onUp(ev: PointerEvent) {
    const insertIdx = dropInsertBeforeIndex.value
    if (insertIdx !== null) {
      moveNodeToFlatIndex(item.node.id, insertIdx)
    }
    draggingItem.value = null
    dropInsertBeforeIndex.value = null
    handleEl.removeEventListener('pointermove', onMove as EventListener)
    handleEl.removeEventListener('pointerup', onUp as EventListener)
    handleEl.removeEventListener('pointercancel', onUp as EventListener)
    try {
      handleEl.releasePointerCapture(ev.pointerId)
    } catch {
      // ignore if already released
    }
  }
  handleEl.addEventListener('pointermove', onMove as EventListener)
  handleEl.addEventListener('pointerup', onUp as EventListener)
  handleEl.addEventListener('pointercancel', onUp as EventListener)
}

const createDialogOpen = ref(false)
const createParentId = ref<string | null>(null)
const createName = ref('')
const createStartDate = ref('')
const createDurationDays = ref<number | ''>('')
const createResourceIds = ref<string[]>([])
const createSubmitting = ref(false)
const createError = ref<string | null>(null)

const projectResources = ref<ProjectResourceItem[]>([])

function openCreateRoot() {
  if (!ensureProjectPermission(canCreateWbs.value, 'create')) return
  createParentId.value = null
  createName.value = ''
  createStartDate.value = ''
  createDurationDays.value = ''
  createResourceIds.value = []
  createError.value = null
  createDialogOpen.value = true
  if (projectId.value) loadProjectResources()
}

function openCreateChild(parentNode: WbsNode) {
  if (!ensureProjectPermission(canCreateWbs.value, 'create')) return
  createParentId.value = parentNode.id
  createName.value = ''
  createStartDate.value = ''
  createDurationDays.value = ''
  createResourceIds.value = []
  createError.value = null
  createDialogOpen.value = true
  if (projectId.value) loadProjectResources()
}

async function loadProjectResources() {
  if (!projectId.value) return
  try {
    projectResources.value = await getAllProjectResources(projectId.value)
  } catch {
    projectResources.value = []
  }
}

const createEndDate = computed(() => {
  if (
    !createStartDate.value ||
    createDurationDays.value === '' ||
    Number(createDurationDays.value) < 1
  )
    return ''
  return wbsEndDateInclusive(createStartDate.value, Number(createDurationDays.value))
})

async function submitCreate() {
  if (!ensureProjectPermission(canCreateWbs.value, 'create')) return
  if (!projectId.value || !createName.value.trim()) return
  createSubmitting.value = true
  createError.value = null
  try {
    await createWbsNode(projectId.value, {
      parentId: createParentId.value,
      name: createName.value.trim(),
      startDate: createStartDate.value || undefined,
      durationDays: createDurationDays.value === '' ? undefined : Number(createDurationDays.value),
      resourceIds: createResourceIds.value.length ? createResourceIds.value : undefined,
    })
    createDialogOpen.value = false
    await fetchWbs()
    expandAll()
  } catch (e: unknown) {
    createError.value = e instanceof Error ? e.message : '新增失敗'
  } finally {
    createSubmitting.value = false
  }
}

/** 試算表式內嵌編輯（點欄位進入） */
type WbsInlineField = 'name' | 'startDate' | 'durationDays'
const wbsInline = ref<{ nodeId: string; field: WbsInlineField } | null>(null)
const wbsInlineName = ref('')
const wbsInlineStart = ref('')
const wbsInlineDuration = ref<number | ''>('')
const wbsInlineSaving = ref(false)

function findWbsNodeByIdInTree(id: string): WbsNode | null {
  function walk(nodes: WbsNode[]): WbsNode | null {
    for (const n of nodes) {
      if (n.id === id) return n
      if (n.children?.length) {
        const f = walk(n.children)
        if (f) return f
      }
    }
    return null
  }
  return walk(wbsTree.value)
}

function isWbsInlineEditing(nodeId: string, field: WbsInlineField) {
  return wbsInline.value?.nodeId === nodeId && wbsInline.value?.field === field
}

function canWbsInlineEditName(node: WbsNode) {
  return !node.isProjectRoot
}

function canWbsInlineEditSchedule(node: WbsNode) {
  return isWbsLeaf(node) && !node.isProjectRoot
}

function beginWbsInlineEdit(node: WbsNode, field: WbsInlineField) {
  if (wbsInlineSaving.value) return
  if (field === 'name' && !canWbsInlineEditName(node)) return
  if ((field === 'startDate' || field === 'durationDays') && !canWbsInlineEditSchedule(node)) return
  wbsInline.value = { nodeId: node.id, field }
  wbsInlineName.value = node.name
  wbsInlineStart.value = node.startDate?.slice(0, 10) ?? ''
  wbsInlineDuration.value = node.durationDays ?? ''
  const key = `${node.id}-${field}`
  nextTick(() => {
    const el = document.querySelector(`[data-wbs-inline="${key}"]`) as HTMLInputElement | null
    el?.focus()
    if (field === 'name' && el) el.select()
  })
}

function cancelWbsInlineEdit() {
  wbsInline.value = null
}

async function commitWbsInlineEdit() {
  const cur = wbsInline.value
  if (!cur || !projectId.value || wbsInlineSaving.value) return
  const node = findWbsNodeByIdInTree(cur.nodeId)
  if (!node) {
    cancelWbsInlineEdit()
    return
  }
  const hasChildren = Boolean(node.children?.length)
  wbsInlineSaving.value = true
  try {
    if (cur.field === 'name') {
      const name = wbsInlineName.value.trim()
      if (!name) {
        cancelWbsInlineEdit()
        return
      }
      if (name === node.name) {
        cancelWbsInlineEdit()
        return
      }
      await updateWbsNode(projectId.value, node.id, { name })
    } else if (!hasChildren) {
      if (cur.field === 'startDate') {
        const s = wbsInlineStart.value.trim() || null
        const prev = node.startDate?.slice(0, 10) ?? ''
        const next = s?.slice(0, 10) ?? ''
        if (next === prev) {
          cancelWbsInlineEdit()
          return
        }
        await updateWbsNode(projectId.value, node.id, { startDate: s })
      } else {
        if (wbsInlineDuration.value === '') {
          cancelWbsInlineEdit()
          return
        }
        const d = Number(wbsInlineDuration.value)
        if (Number.isNaN(d) || d < 1) {
          cancelWbsInlineEdit()
          return
        }
        if (d === node.durationDays) {
          cancelWbsInlineEdit()
          return
        }
        await updateWbsNode(projectId.value, node.id, { durationDays: d })
      }
    }
    cancelWbsInlineEdit()
    await fetchWbs()
    if (
      !hasChildren &&
      hasAnyTaskDependencies(taskDependencies.value) &&
      (cur.field === 'startDate' || cur.field === 'durationDays')
    ) {
      await runFsSyncLeaves()
    }
  } catch {
    await fetchWbs()
    cancelWbsInlineEdit()
  } finally {
    wbsInlineSaving.value = false
  }
}

const editDialogOpen = ref(false)
const editNode = ref<WbsNode | null>(null)
const editName = ref('')
const editStartDate = ref('')
const editDurationDays = ref<number | ''>('')
const editResourceIds = ref<string[]>([])
const editSubmitting = ref(false)
const editError = ref<string | null>(null)

function openEdit(node: WbsNode) {
  cancelWbsInlineEdit()
  editNode.value = node
  editName.value = node.name
  editStartDate.value = node.startDate ?? ''
  editDurationDays.value = node.durationDays ?? ''
  editResourceIds.value = node.resources?.map((r) => r.id) ?? []
  editError.value = null
  editDialogOpen.value = true
  if (projectId.value) loadProjectResources()
}

function onWbsResourceCellClick(node: WbsNode) {
  if (!isWbsLeaf(node) || node.isProjectRoot) return
  openEdit(node)
}

const editEndDate = computed(() => {
  if (!editStartDate.value || editDurationDays.value === '' || Number(editDurationDays.value) < 1)
    return ''
  return wbsEndDateInclusive(editStartDate.value, Number(editDurationDays.value))
})

function toggleEditResource(id: string) {
  const next = editResourceIds.value.includes(id)
    ? editResourceIds.value.filter((r) => r !== id)
    : [...editResourceIds.value, id]
  editResourceIds.value = next
}

function toggleCreateResource(id: string) {
  const next = createResourceIds.value.includes(id)
    ? createResourceIds.value.filter((r) => r !== id)
    : [...createResourceIds.value, id]
  createResourceIds.value = next
}

const editIsParent = computed(() => Boolean(editNode.value?.children?.length))

async function submitEdit() {
  if (!projectId.value || !editNode.value || !editName.value.trim()) return
  editSubmitting.value = true
  editError.value = null
  const wasLeaf = !editIsParent.value
  try {
    if (editIsParent.value) {
      await updateWbsNode(projectId.value, editNode.value.id, {
        name: editName.value.trim(),
      })
    } else {
      await updateWbsNode(projectId.value, editNode.value.id, {
        name: editName.value.trim(),
        startDate: editStartDate.value || null,
        durationDays: editDurationDays.value === '' ? null : Number(editDurationDays.value),
        resourceIds: editResourceIds.value,
      })
    }
    editDialogOpen.value = false
    await fetchWbs()
    if (wasLeaf && hasAnyTaskDependencies(taskDependencies.value)) {
      await runFsSyncLeaves()
    }
  } catch (e: unknown) {
    editError.value = e instanceof Error ? e.message : '更新失敗'
  } finally {
    editSubmitting.value = false
  }
}

const deleteDialogOpen = ref(false)
const deleteNode = ref<WbsNode | null>(null)
const deleteLoading = ref(false)

function openDelete(node: WbsNode) {
  deleteNode.value = node
  deleteDialogOpen.value = true
}

async function confirmDelete() {
  if (!projectId.value || !deleteNode.value) return
  deleteLoading.value = true
  try {
    await deleteWbsNode(projectId.value, deleteNode.value.id)
    deleteDialogOpen.value = false
    deleteNode.value = null
    await fetchWbs()
  } finally {
    deleteLoading.value = false
  }
}

onMounted(async () => {
  loadWorkPackagesFromStorage()
  loadDependenciesFromStorage()
  await fetchWbs()
  expandAll()
})
watch(projectId, async (id) => {
  if (id) {
    loadWorkPackagesFromStorage()
    loadDependenciesFromStorage()
    await fetchWbs()
    expandAll()
  }
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">WBS清單</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        工作分解結構，支援多層樹狀展開／收合、拖移排序。項目名稱欄顯示「編號 ＋
        項目名稱」。拖曳左側把手可調整群組順序。
      </p>
    </div>

    <!-- 工具列 -->
    <div class="flex flex-wrap items-center justify-end gap-2">
      <Button
        variant="default"
        size="sm"
        class="gap-1.5"
        :disabled="!projectId || loading"
        @click="openCreateRoot"
      >
        <Plus class="size-4" />
        新增根節點
      </Button>
      <Button
        variant="default"
        size="sm"
        :disabled="!projectId || loading"
        @click="expandAll"
      >
        全部展開
      </Button>
      <Button
        variant="default"
        size="sm"
        :disabled="!projectId || loading"
        @click="collapseAll"
      >
        全部收合
      </Button>
      <Dialog v-if="canUpdateWbs" v-model:open="settingsOpen">
        <DialogTrigger as-child>
          <Button variant="default" size="sm" class="gap-1.5">
            <Settings class="size-4" />
            設定
          </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>父層顏色設定</DialogTitle>
          </DialogHeader>
          <p class="text-sm text-muted-foreground">
            依階層深度設定父層項目的背景色，僅套用於有子節點的列。
          </p>
          <div class="grid gap-4 py-2">
            <div v-for="d in maxDepth + 1" :key="d - 1" class="flex items-center gap-3">
              <Label class="w-24 shrink-0 text-foreground">第 {{ d }} 層</Label>
              <div class="flex items-center gap-2 flex-1">
                <input
                  :value="levelColors[d - 1]"
                  type="color"
                  class="h-9 w-14 cursor-pointer rounded border border-border bg-background"
                  @input="setLevelColor(d - 1, ($event.target as HTMLInputElement).value)"
                />
                <span class="text-sm text-muted-foreground">
                  {{ levelColors[d - 1] || '未設定' }}
                </span>
              </div>
              <Button
                v-if="levelColors[d - 1]"
                variant="ghost"
                size="sm"
                class="text-muted-foreground"
                @click="setLevelColor(d - 1, '')"
              >
                清除
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>

    <!-- 列表 / 網路圖 分頁（切到網路圖時會重載前置關係，即時反映甘特圖變更） -->
    <Tabs v-model="activeWbsTab" class="w-full">
      <TabsList class="grid w-full max-w-[280px] grid-cols-2">
        <TabsTrigger value="list" class="gap-1.5">
          <List class="size-4" />
          列表
        </TabsTrigger>
        <TabsTrigger value="network" class="gap-1.5">
          <Network class="size-4" />
          網路圖
        </TabsTrigger>
      </TabsList>
      <TabsContent value="list" class="mt-4">
        <p class="mb-3 text-xs text-muted-foreground max-w-3xl">
          <strong class="text-foreground">點欄位可內嵌編輯</strong>（類試算表）：可改<strong
            class="text-foreground"
            >名稱</strong
          >（專案根除外）；<strong class="text-foreground">開始／工期</strong>僅<strong
            class="text-foreground"
            >葉節點</strong
          >；<strong class="text-foreground">結束</strong>由系統推算；<strong
            class="text-foreground"
            >資源</strong
          >點欄位開啟編輯視窗。父層開始／工期／結束為子項彙總。
        </p>
        <!-- 樹狀表格 -->
        <div class="rounded-lg border border-border bg-card p-4">
          <div
            v-if="loading"
            class="flex items-center justify-center gap-2 py-12 text-muted-foreground"
          >
            <Loader2 class="size-5 animate-spin" />
            載入中…
          </div>
          <p v-else-if="listError" class="py-4 text-center text-sm text-destructive">
            {{ listError }}
          </p>
          <Table v-else>
            <TableHeader>
              <TableRow>
                <TableHead class="w-8 px-1" aria-label="拖移" />
                <TableHead class="w-10 px-2">
                  <Checkbox
                    :checked="isHeaderIndeterminate ? 'indeterminate' : isHeaderChecked"
                    aria-label="全選"
                    @update:checked="toggleHeaderSelect"
                  />
                </TableHead>
                <TableHead class="text-muted-foreground w-16 text-center">任務</TableHead>
                <TableHead>項目名稱</TableHead>
                <TableHead class="whitespace-nowrap text-muted-foreground">開始</TableHead>
                <TableHead class="whitespace-nowrap text-muted-foreground">工期(天)</TableHead>
                <TableHead class="whitespace-nowrap text-muted-foreground">結束</TableHead>
                <TableHead class="text-muted-foreground min-w-[100px]">前置</TableHead>
                <TableHead class="text-muted-foreground min-w-[120px]">資源</TableHead>
                <TableHead class="w-12 px-1" aria-label="操作" />
              </TableRow>
            </TableHeader>
            <TableBody ref="tableBodyRef">
              <template v-if="flattenedList.length === 0">
                <TableRow>
                  <TableCell colspan="10" class="text-center text-muted-foreground py-8">
                    尚無 WBS 項目
                  </TableCell>
                </TableRow>
              </template>
              <template v-for="(item, flatIndex) in flattenedList" :key="item.node.id">
                <!-- 插入線：拖曳時顯示在目標索引上方 -->
                <tr
                  v-if="dropInsertBeforeIndex === flatIndex"
                  class="pointer-events-none"
                  aria-hidden="true"
                >
                  <td colspan="10" class="h-0 p-0 align-top">
                    <div
                      class="mx-2 rounded-full bg-primary/90 h-0.5 min-h-[2px] shadow-sm"
                      style="margin-top: -1px"
                    />
                  </td>
                </tr>
                <TableRow
                  :data-flat-index="flatIndex"
                  class="group transition-colors"
                  :class="{
                    'opacity-40': draggingItem?.node.id === item.node.id,
                  }"
                >
                  <TableCell class="w-8 p-1 align-middle">
                    <div
                      v-if="!item.node.isProjectRoot && canUpdateWbs"
                      role="button"
                      tabindex="0"
                      class="flex cursor-grab touch-none items-center justify-center rounded p-1 text-muted-foreground/60 hover:bg-muted/80 hover:text-foreground active:cursor-grabbing"
                      aria-label="拖移排序"
                      @pointerdown="onDragHandlePointerDown($event, item)"
                      @keydown.enter.prevent=""
                      @keydown.space.prevent=""
                    >
                      <GripVertical class="size-4" />
                    </div>
                    <span v-else-if="item.node.isProjectRoot" class="block size-8" aria-hidden="true" />
                    <span v-else class="block size-4" aria-hidden="true" />
                  </TableCell>
                  <TableCell class="w-10">
                    <Checkbox
                      v-if="!item.node.isProjectRoot"
                      :checked="
                        isRowIndeterminate(item.node) ? 'indeterminate' : isRowChecked(item.node)
                      "
                      :aria-label="`勾選 ${item.node.name}`"
                      @update:checked="toggleSelect(item.node)"
                    />
                    <span v-else class="block w-10" aria-hidden="true" />
                  </TableCell>
                  <TableCell class="w-16 text-center">
                    <Checkbox
                      :disabled="item.hasChildren || !canUpdateWbs"
                      :checked="workPackageIds.includes(item.node.id)"
                      :aria-label="`設為任務：${item.node.name}`"
                      :title="item.hasChildren ? '僅葉節點可設為任務' : undefined"
                      @update:checked="
                        (v) => {
                          if (v === true || v === false) setWorkPackageChecked(item.node, v)
                        }
                      "
                    />
                  </TableCell>
                  <TableCell
                    class="text-foreground p-1 align-middle"
                    :style="getParentLevelStyle(item)"
                  >
                    <div
                      class="flex min-w-0 items-center gap-1"
                      :style="{ paddingLeft: `${item.depth * 20}px` }"
                    >
                      <Button
                        v-if="item.hasChildren"
                        variant="ghost"
                        size="icon"
                        class="size-6 shrink-0 rounded"
                        @click.stop="toggleExpand(item.node.id)"
                      >
                        <ChevronDown
                          v-if="expandedIds.has(item.node.id)"
                          class="size-4 text-muted-foreground"
                        />
                        <ChevronRight v-else class="size-4 text-muted-foreground" />
                      </Button>
                      <span v-else class="size-6 shrink-0" aria-hidden="true" />
                      <template v-if="item.node.isProjectRoot">
                        <span class="truncate font-semibold text-primary">
                          〔專案〕{{ item.node.name }}
                        </span>
                      </template>
                      <template v-else-if="isWbsInlineEditing(item.node.id, 'name')">
                        <span class="shrink-0 tabular-nums text-xs text-muted-foreground">{{
                          item.node.code
                        }}</span>
                        <Input
                          :data-wbs-inline="`${item.node.id}-name`"
                          v-model="wbsInlineName"
                          class="h-8 min-w-0 flex-1 text-sm"
                          placeholder="名稱"
                          @keydown.enter.prevent="commitWbsInlineEdit"
                          @keydown.escape.prevent="cancelWbsInlineEdit"
                          @blur="commitWbsInlineEdit"
                        />
                      </template>
                      <div
                        v-else
                        class="hover:bg-muted/50 -mx-1 flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded px-1 py-0.5"
                        title="點擊編輯名稱"
                        @click.stop="beginWbsInlineEdit(item.node, 'name')"
                      >
                        <span class="shrink-0 tabular-nums text-xs text-muted-foreground">{{
                          item.node.code
                        }}</span>
                        <span
                          class="min-w-0 truncate text-sm"
                          :class="{ 'font-semibold': item.hasChildren }"
                          >{{ item.node.name }}</span
                        >
                      </div>
                    </div>
                  </TableCell>
                  <TableCell
                    class="p-1 align-middle whitespace-nowrap text-sm"
                    :class="
                      canWbsInlineEditSchedule(item.node)
                        ? 'cursor-pointer text-foreground'
                        : 'text-muted-foreground'
                    "
                  >
                    <template v-if="item.hasChildren">
                      {{ rollupWbsSchedule(item.node).startDate ?? '—' }}
                      <span class="ml-0.5 text-[10px] text-muted-foreground/80">彙總</span>
                    </template>
                    <template v-else-if="isWbsInlineEditing(item.node.id, 'startDate')">
                      <Input
                        :data-wbs-inline="`${item.node.id}-startDate`"
                        v-model="wbsInlineStart"
                        type="date"
                        class="h-8 w-[9.5rem] text-xs"
                        @keydown.enter.prevent="commitWbsInlineEdit"
                        @keydown.escape.prevent="cancelWbsInlineEdit"
                        @blur="commitWbsInlineEdit"
                      />
                    </template>
                    <div
                      v-else-if="canWbsInlineEditSchedule(item.node)"
                      class="hover:bg-muted/50 rounded px-1 py-1 tabular-nums"
                      title="點擊編輯開始日"
                      @click.stop="beginWbsInlineEdit(item.node, 'startDate')"
                    >
                      {{ item.node.startDate ?? '—' }}
                    </div>
                    <template v-else>{{ item.node.startDate ?? '—' }}</template>
                  </TableCell>
                  <TableCell
                    class="p-1 align-middle whitespace-nowrap text-sm tabular-nums"
                    :class="
                      canWbsInlineEditSchedule(item.node)
                        ? 'cursor-pointer text-foreground'
                        : 'text-muted-foreground'
                    "
                  >
                    <template v-if="item.hasChildren">
                      {{ rollupWbsSchedule(item.node).durationDays ?? '—' }}
                      <span class="ml-0.5 text-[10px] text-muted-foreground/80">彙總</span>
                    </template>
                    <template v-else-if="isWbsInlineEditing(item.node.id, 'durationDays')">
                      <Input
                        :data-wbs-inline="`${item.node.id}-durationDays`"
                        v-model.number="wbsInlineDuration"
                        type="number"
                        min="1"
                        class="h-8 w-16 text-right text-xs"
                        @keydown.enter.prevent="commitWbsInlineEdit"
                        @keydown.escape.prevent="cancelWbsInlineEdit"
                        @blur="commitWbsInlineEdit"
                      />
                    </template>
                    <div
                      v-else-if="canWbsInlineEditSchedule(item.node)"
                      class="hover:bg-muted/50 rounded px-1 py-1"
                      title="點擊編輯工期（天）"
                      @click.stop="beginWbsInlineEdit(item.node, 'durationDays')"
                    >
                      {{ item.node.durationDays != null ? item.node.durationDays : '—' }}
                    </div>
                    <template v-else>{{
                      item.node.durationDays != null ? item.node.durationDays : '—'
                    }}</template>
                  </TableCell>
                  <TableCell class="whitespace-nowrap text-muted-foreground text-sm">
                    {{
                      (item.hasChildren
                        ? rollupWbsSchedule(item.node).endDate
                        : item.node.endDate) ?? '—'
                    }}
                    <span
                      v-if="item.hasChildren"
                      class="ml-0.5 text-[10px] text-muted-foreground/80"
                      >彙總</span
                    >
                  </TableCell>
                  <TableCell class="min-w-[100px] p-1 align-middle">
                    <GanttPredecessorCell
                      v-if="isWbsLeaf(item.node)"
                      :task="wbsAsGanttTasks[flatIndex]"
                      :all-tasks="wbsAllLeavesAsGanttTasks"
                      :lookup-tasks="wbsAllNodesAsGanttTasks"
                      @update:dependencies="(ids) => setNodeDependencies(item.node.id, ids)"
                    />
                    <span
                      v-else
                      class="text-xs text-muted-foreground"
                      title="前置任務僅適用於葉節點"
                      >—</span
                    >
                  </TableCell>
                  <TableCell
                    class="max-w-[180px] truncate p-1 align-middle text-sm text-muted-foreground"
                    :class="
                      isWbsLeaf(item.node) && !item.node.isProjectRoot
                        ? 'hover:bg-muted/50 cursor-pointer'
                        : ''
                    "
                    :title="
                      isWbsLeaf(item.node) && !item.node.isProjectRoot ? '點擊編輯資源' : undefined
                    "
                    @click.stop="onWbsResourceCellClick(item.node)"
                  >
                    <template v-if="item.hasChildren">
                      {{ rollupResourceLabels(item.node) || '—' }}
                      <span class="text-[10px] text-muted-foreground/80">（子項）</span>
                    </template>
                    <template v-else>
                      {{
                        item.node.resources?.length
                          ? item.node.resources.map((r) => r.name).join('、')
                          : '—'
                      }}
                    </template>
                  </TableCell>
                  <TableCell class="w-12 p-1">
                    <DropdownMenu
                      v-if="
                        canCreateWbs ||
                        (!item.node.isProjectRoot && (canUpdateWbs || canDeleteWbs))
                      "
                    >
                      <DropdownMenuTrigger as-child>
                        <Button variant="ghost" size="icon" class="size-8" aria-label="操作">
                          <MoreHorizontal class="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem @click="openCreateChild(item.node)">
                          <Plus class="size-4" />
                          新增子節點
                        </DropdownMenuItem>
                        <template v-if="!item.node.isProjectRoot">
                          <DropdownMenuItem v-if="canUpdateWbs" @click="openEdit(item.node)">
                            <Pencil class="size-4" />
                            編輯
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            v-if="canDeleteWbs"
                            class="text-destructive focus:text-destructive"
                            @click="openDelete(item.node)"
                          >
                            <Trash2 class="size-4" />
                            刪除
                          </DropdownMenuItem>
                        </template>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <span v-else class="text-xs text-muted-foreground">—</span>
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
        </div>
      </TabsContent>
      <TabsContent value="network" class="mt-4">
        <WbsNetworkDiagram
          ref="networkDiagramRef"
          :wbs-tree="wbsTree"
          :work-package-ids="workPackageIds"
          :task-dependencies="taskDependencies"
          :project-id="projectId"
          @add-dependency="onNetworkAddDependency"
          @remove-dependency="onNetworkRemoveDependency"
        />
      </TabsContent>
    </Tabs>

    <!-- 新增節點對話框 -->
    <Dialog v-model:open="createDialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ createParentId ? '新增子節點' : '新增根節點' }}</DialogTitle>
          <DialogDescription>輸入項目名稱與排程，編號由系統自動產生。</DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-2">
          <div class="grid gap-2">
            <Label for="create-name">項目名稱</Label>
            <Input
              id="create-name"
              v-model="createName"
              placeholder="請輸入項目名稱"
              @keydown.enter.prevent="submitCreate"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="grid gap-2">
              <Label for="create-start">開始日期</Label>
              <Input id="create-start" v-model="createStartDate" type="date" />
            </div>
            <div class="grid gap-2">
              <Label for="create-duration">工期（天）</Label>
              <Input
                id="create-duration"
                v-model.number="createDurationDays"
                type="number"
                min="0"
                placeholder="0"
              />
            </div>
          </div>
          <div v-if="createEndDate" class="grid gap-2">
            <Label>結束日期</Label>
            <span class="text-sm text-muted-foreground"
              >{{ createEndDate }}（依開始+工期推算）</span
            >
          </div>
          <div class="grid gap-2">
            <Label>資源（多選）</Label>
            <div class="max-h-32 overflow-y-auto rounded-md border border-border p-2 space-y-1">
              <label
                v-for="res in projectResources"
                :key="res.id"
                class="flex items-center gap-2 cursor-pointer text-sm"
              >
                <Checkbox
                  :checked="createResourceIds.includes(res.id)"
                  @update:checked="() => toggleCreateResource(res.id)"
                />
                <span>{{ res.name }}</span>
                <span class="text-muted-foreground text-xs">({{ res.type }})</span>
              </label>
              <p v-if="!projectResources.length" class="text-muted-foreground text-xs">
                尚無資源，請至資源庫新增。
              </p>
            </div>
          </div>
          <p v-if="createError" class="text-sm text-destructive">{{ createError }}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="createDialogOpen = false">取消</Button>
          <Button :disabled="!createName.trim() || createSubmitting" @click="submitCreate">
            <Loader2 v-if="createSubmitting" class="size-4 animate-spin" />
            新增
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 編輯節點對話框 -->
    <Dialog v-model:open="editDialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>編輯項目</DialogTitle>
          <DialogDescription v-if="editIsParent">
            此節點為<strong>父層</strong>：排程與資源由子項彙總，僅可修改名稱。
          </DialogDescription>
          <DialogDescription v-else>
            修改名稱、排程與資源，結束日期依開始+工期推算。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-2">
          <div class="grid gap-2">
            <Label for="edit-name">項目名稱</Label>
            <Input
              id="edit-name"
              v-model="editName"
              placeholder="請輸入項目名稱"
              @keydown.enter.prevent="submitEdit"
            />
          </div>
          <template v-if="!editIsParent">
            <div class="grid grid-cols-2 gap-4">
              <div class="grid gap-2">
                <Label for="edit-start">開始日期</Label>
                <Input id="edit-start" v-model="editStartDate" type="date" />
              </div>
              <div class="grid gap-2">
                <Label for="edit-duration">工期（天）</Label>
                <Input
                  id="edit-duration"
                  v-model.number="editDurationDays"
                  type="number"
                  min="0"
                  placeholder="0"
                />
              </div>
            </div>
            <div v-if="editEndDate" class="grid gap-2">
              <Label>結束日期</Label>
              <span class="text-sm text-muted-foreground"
                >{{ editEndDate }}（依開始+工期推算）</span
              >
            </div>
            <div class="grid gap-2">
              <Label>資源（多選）</Label>
              <div class="max-h-32 overflow-y-auto rounded-md border border-border p-2 space-y-1">
                <label
                  v-for="res in projectResources"
                  :key="res.id"
                  class="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <Checkbox
                    :checked="editResourceIds.includes(res.id)"
                    @update:checked="() => toggleEditResource(res.id)"
                  />
                  <span>{{ res.name }}</span>
                  <span class="text-muted-foreground text-xs">({{ res.type }})</span>
                </label>
                <p v-if="!projectResources.length" class="text-muted-foreground text-xs">
                  尚無資源，請至資源庫新增。
                </p>
              </div>
            </div>
          </template>
          <div
            v-else
            class="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
          >
            開始／工期／結束／資源請在各<strong class="text-foreground">子節點</strong>編輯。
          </div>
          <p v-if="editError" class="text-sm text-destructive">{{ editError }}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="editDialogOpen = false">取消</Button>
          <Button :disabled="!editName.trim() || editSubmitting" @click="submitEdit">
            <Loader2 v-if="editSubmitting" class="size-4 animate-spin" />
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 刪除確認對話框 -->
    <Dialog v-model:open="deleteDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>刪除項目</DialogTitle>
          <DialogDescription>
            確定要刪除「{{ deleteNode?.code }}
            {{ deleteNode?.name }}」嗎？若有子節點將一併刪除，此操作無法復原。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="deleteDialogOpen = false">取消</Button>
          <Button variant="destructive" :disabled="deleteLoading" @click="confirmDelete">
            <Loader2 v-if="deleteLoading" class="size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 拖曳幽靈：跟隨滑鼠，不擋住點擊 -->
    <Teleport to="body">
      <Transition name="ghost">
        <div
          v-if="draggingItem"
          class="fixed z-[100] max-w-[min(90vw,420px)] pointer-events-none rounded-lg border border-border bg-card px-3 py-2 shadow-lg ring-2 ring-primary/20"
          :style="{
            left: `${ghostPosition.x}px`,
            top: `${ghostPosition.y}px`,
            transform: 'translate(-50%, -50%)',
          }"
        >
          <div class="flex items-center gap-2">
            <GripVertical class="size-4 shrink-0 text-muted-foreground" />
            <span class="truncate text-sm" :class="{ 'font-semibold': draggingItem.hasChildren }">
              {{ draggingItem.node.code }} {{ draggingItem.node.name }}
            </span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.ghost-enter-active,
.ghost-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.ghost-enter-from,
.ghost-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.96);
}
</style>
