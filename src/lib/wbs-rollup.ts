import type { WbsNode } from '@/types/wbs'
import { wbsEndDateInclusive } from '@/lib/wbs-schedule-dates'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function parseYmd(s: string): number {
  return new Date(s + 'T12:00:00').getTime()
}

/** 是否為葉節點（無子項）；排程／前置／任務僅適用於葉節點 */
export function isWbsLeaf(node: WbsNode): boolean {
  return !node.children?.length
}

function leafEffectiveEnd(n: WbsNode): string | null {
  if (n.endDate) return n.endDate
  if (n.startDate && n.durationDays != null && n.durationDays >= 1) {
    return wbsEndDateInclusive(String(n.startDate), n.durationDays)
  }
  return n.startDate ?? null
}

/**
 * 父層彙總排程（遞迴子樹）：
 * - 開始日＝所有子項（含子父層彙總後）之**最早**開始
 * - 結束日＝**最晚**結束
 * - 工期＝上述區間之日曆天數（與後端「開始＋工期→結束」一致），**絕非**把子項工期數字相加
 */
export interface WbsRollupSchedule {
  startDate: string | null
  endDate: string | null
  durationDays: number | null
}

export function rollupWbsSchedule(node: WbsNode): WbsRollupSchedule {
  if (isWbsLeaf(node)) {
    const start = node.startDate ?? null
    const end = leafEffectiveEnd(node)
    let dur = node.durationDays ?? null
    if (start && end) {
      const span = Math.max(1, Math.ceil((parseYmd(end) - parseYmd(start)) / MS_PER_DAY) + 1)
      if (dur == null || dur < 1) dur = span
    }
    return { startDate: start, endDate: end, durationDays: dur }
  }
  const rollups = node.children!.map(rollupWbsSchedule)
  const starts = rollups.map((r) => r.startDate).filter(Boolean) as string[]
  const ends = rollups.map((r) => r.endDate).filter(Boolean) as string[]
  if (starts.length === 0) {
    return { startDate: null, endDate: null, durationDays: null }
  }
  const minStart = starts.reduce((a, b) => (parseYmd(a) <= parseYmd(b) ? a : b))
  const maxEnd = ends.length
    ? ends.reduce((a, b) => (parseYmd(a) >= parseYmd(b) ? a : b))
    : minStart
  /** 包絡工期：最早開始～最晚結束之**含首尾**日數，非 Σ 子項 durationDays */
  const dur = Math.max(1, Math.ceil((parseYmd(maxEnd) - parseYmd(minStart)) / MS_PER_DAY) + 1)
  return { startDate: minStart, endDate: maxEnd, durationDays: dur }
}

/** 彙總子孫葉節點的資源名稱（去重） */
export function rollupResourceLabels(node: WbsNode): string {
  if (isWbsLeaf(node)) {
    return node.resources?.length ? node.resources.map((r) => r.name).join('、') : ''
  }
  const set = new Set<string>()
  function walk(n: WbsNode) {
    if (isWbsLeaf(n)) {
      n.resources?.forEach((r) => set.add(r.name))
    } else n.children?.forEach(walk)
  }
  node.children?.forEach(walk)
  return [...set].join('、')
}
