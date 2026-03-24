/**
 * 從 WBS 葉節點彙總「資源 × 日期」用量，供排班表圖表使用。
 * 人：任務工期內「每一天」都是 8 時數/人（quantity = 人數時，每日時數 = quantity * 8）
 * 機、料：任務工期內「每一天」都是該數量（每日數量 = quantity）
 * 不做「總量÷工期」的平分。
 */

import type { WbsNode } from '@/types/wbs'
import type { ProjectResourceType } from '@/types/resource'
import { wbsDurationInclusiveDays } from '@/lib/wbs-schedule-dates'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function toDateKey(ymd: string): string {
  return String(ymd).slice(0, 10)
}

function parseYmd(s: string): number {
  return new Date(s + 'T12:00:00').getTime()
}

function addDays(ymd: string, days: number): string {
  const d = new Date(ymd + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 遞迴收集所有葉節點 */
function collectLeaves(nodes: WbsNode[]): WbsNode[] {
  const out: WbsNode[] = []
  for (const n of nodes) {
    if (!n.children?.length) out.push(n)
    else out.push(...collectLeaves(n.children))
  }
  return out
}

export type ResourceUsageMap = Map<string, Map<string, number>>
// resourceId -> dateKey (YYYY-MM-DD) -> value (時數 for labor, 數量 for equipment/material)

/**
 * 依資源類型回傳當日顯示用的單位說明
 */
export function getScheduleUnitLabel(type: ProjectResourceType): string {
  switch (type) {
    case 'labor':
      return '時數'
    case 'equipment':
      return '數量'
    case 'material':
      return '數量'
    default:
      return '用量'
  }
}

/**
 * 從 WBS 樹彙總指定類型資源的「每日用量」
 * - labor: 工期內每一天都是 8 時數/人（每日時數 = (quantity ?? 1) * 8）
 * - equipment / material: 工期內每一天都是該數量（每日 = quantity ?? 1）
 */
export function aggregateResourceUsageByDay(
  wbsTree: WbsNode[],
  resourceType: ProjectResourceType
): ResourceUsageMap {
  const result: ResourceUsageMap = new Map()
  const leaves = collectLeaves(wbsTree)

  for (const node of leaves) {
    const start = node.startDate ?? null
    const end = node.endDate ?? null
    const durationDays = node.durationDays ?? null
    if (!start) continue
    const endDate =
      end ||
      (durationDays != null && durationDays >= 1
        ? addDays(start, durationDays - 1)
        : start)
    const days = wbsDurationInclusiveDays(start, endDate)
    if (days < 1) continue

    const resources = node.resources?.filter((r) => r.type === resourceType) ?? []
    for (const res of resources) {
      const resourceId = res.id
      const qty = res.quantity ?? 1
      const valuePerDay =
        resourceType === 'labor' ? qty * 8 : qty // 人：每天 8 時數/人；機料：每天該數量

      if (!result.has(resourceId)) result.set(resourceId, new Map())
      const byDate = result.get(resourceId)!

      let t = parseYmd(start)
      const endMs = parseYmd(endDate)
      while (t <= endMs) {
        const d = new Date(t)
        const key = toDateKey(d.toISOString().slice(0, 10))
        byDate.set(key, (byDate.get(key) ?? 0) + valuePerDay)
        t += MS_PER_DAY
      }
    }
  }

  return result
}
