import type { WbsNode } from '@/types/wbs'
import { isWbsLeaf, rollupWbsSchedule } from '@/lib/wbs-rollup'
import { wbsEndDateInclusive } from '@/lib/wbs-schedule-dates'

/** 日曆字串正規化為 YYYY-MM-DD（勿用 toISOString，UTC+ 時區會差一天） */
export function toDateKey(isoOrDate: string | null | undefined): string {
  if (isoOrDate == null || String(isoOrDate).trim() === '') return ''
  const s = String(isoOrDate).trim()
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return s.slice(0, 10)
}

/** 日曆加減（依日期字串的年月日，輸出本地語意的 YYYY-MM-DD） */
export function addCalendarDays(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function findWbsNodeById(nodes: WbsNode[], id: string): WbsNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children?.length) {
      const f = findWbsNodeById(n.children, id)
      if (f) return f
    }
  }
  return null
}

export function collectLeafNodes(tree: WbsNode[]): { id: string; node: WbsNode }[] {
  const out: { id: string; node: WbsNode }[] = []
  function walk(nodes: WbsNode[]) {
    for (const n of nodes) {
      if (isWbsLeaf(n)) out.push({ id: n.id, node: n })
      else if (n.children?.length) walk(n.children)
    }
  }
  walk(tree)
  return out
}

function initialLeafRange(node: WbsNode, defaultStart: string): {
  start: string
  end: string
  durationDays: number
} {
  const start = node.startDate ?? defaultStart
  const durationDays = Math.max(1, node.durationDays ?? 14)
  let end = node.endDate ? toDateKey(node.endDate) : null
  if (!end) {
    end = wbsEndDateInclusive(start, durationDays)
  }
  return { start, end, durationDays }
}

/** 前置任務「完成日」（用於比較誰較晚）：取該節點右緣／結束邊界日 */
function predecessorEndDate(
  depId: string,
  wbsTree: WbsNode[],
  scheduled: Map<string, { start: string; end: string }>
): string | null {
  const done = scheduled.get(depId)
  if (done) return done.end

  const n = findWbsNodeById(wbsTree, depId)
  if (!n) return null
  if (isWbsLeaf(n)) {
    return initialLeafRange(n, '2000-01-01').end
  }
  return rollupWbsSchedule(n).endDate
}

/**
 * FS（完成→開始）：後續開始日 = 所有前置完成日之最晚者 + 1 日曆天；工期不變。
 */
export function computeForwardScheduleForLeaves(
  wbsTree: WbsNode[],
  leafNodes: { id: string; node: WbsNode }[],
  taskDeps: Record<string, string[]>,
  defaultStart: string
): Map<string, { plannedStart: string; plannedEnd: string; durationDays: number }> {
  const leafIdSet = new Set(leafNodes.map((x) => x.id))
  const initial = new Map<string, { start: string; end: string; durationDays: number }>()
  for (const { id, node } of leafNodes) {
    initial.set(id, initialLeafRange(node, defaultStart))
  }

  const remaining = new Set(leafIdSet)
  const order: string[] = []
  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) => {
      const deps = taskDeps[id] ?? []
      return deps.every((d) => !leafIdSet.has(d) || !remaining.has(d))
    })
    const pick = ready[0] ?? [...remaining][0]
    remaining.delete(pick)
    order.push(pick)
  }

  const scheduled = new Map<string, { start: string; end: string }>()
  const out = new Map<string, { plannedStart: string; plannedEnd: string; durationDays: number }>()

  for (const id of order) {
    const deps = taskDeps[id] ?? []
    const init = initial.get(id)!
    const { durationDays } = init

    if (deps.length === 0) {
      scheduled.set(id, { start: init.start, end: init.end })
      out.set(id, {
        plannedStart: init.start,
        plannedEnd: init.end,
        durationDays,
      })
      continue
    }

    let maxEnd: string | null = null
    for (const depId of deps) {
      const e = predecessorEndDate(depId, wbsTree, scheduled)
      if (e && (!maxEnd || e > maxEnd)) maxEnd = e
    }

    if (!maxEnd) {
      scheduled.set(id, { start: init.start, end: init.end })
      out.set(id, {
        plannedStart: init.start,
        plannedEnd: init.end,
        durationDays,
      })
      continue
    }

    const plannedStart = addCalendarDays(maxEnd, 1)
    const plannedEnd = wbsEndDateInclusive(plannedStart, durationDays)
    scheduled.set(id, { start: plannedStart, end: plannedEnd })
    out.set(id, { plannedStart, plannedEnd, durationDays })
  }

  return out
}

let fsSyncBusy = false

/** 專案是否有任一任務設定了前置（localStorage 圖） */
export function hasAnyTaskDependencies(taskDeps: Record<string, string[]>): boolean {
  return Object.values(taskDeps).some((arr) => Array.isArray(arr) && arr.length > 0)
}

/**
 * 將有前置之葉節點寫回 API：開始日 = max(前置完成日)+1 日曆天、工期不變。
 * 應在：(1) 使用者變更前置關係 (2) 使用者儲存某葉節點之開始／工期後 各呼叫一次；
 * 勿在 onMounted／每次進頁自動呼叫，否則會反覆改寫或迴圈。
 */
export async function syncLeafStartDatesToFsConstraints(
  projectId: string,
  wbsTree: WbsNode[],
  taskDeps: Record<string, string[]>,
  defaultStart: string,
  updateWbsNode: (
    projectId: string,
    nodeId: string,
    body: { startDate: string; durationDays: number }
  ) => Promise<unknown>,
  reloadTree: () => Promise<void>
): Promise<void> {
  if (fsSyncBusy) return
  if (!wbsTree.length) return
  fsSyncBusy = true
  try {
  const leaves = collectLeafNodes(wbsTree)
  const map = computeForwardScheduleForLeaves(wbsTree, leaves, taskDeps, defaultStart)
  const tasks: Promise<unknown>[] = []
  for (const { id, node } of leaves) {
    const sch = map.get(id)
    if (!sch) continue
    const deps = taskDeps[id] ?? []
    if (deps.length === 0) continue
    const nodeStart = toDateKey(node.startDate)
    const durOk =
      node.durationDays == null || Number(node.durationDays) === sch.durationDays
    if (nodeStart === sch.plannedStart && durOk) continue
    tasks.push(
      updateWbsNode(projectId, id, {
        startDate: sch.plannedStart,
        durationDays: sch.durationDays,
      })
    )
  }
  if (tasks.length === 0) return
  await Promise.all(tasks)
  await reloadTree()
  } finally {
    fsSyncBusy = false
  }
}
