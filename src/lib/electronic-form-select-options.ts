/**
 * 電子表單「下拉選單」欄位：支援扁平選項與 `{ type: 'group', label, options }` 分組（與後端契約一致）。
 */

export type SelectFlatOption = { value: string; label: string }

/** `label === null` 表示無群組標題（連續的頂層選項合併為一區） */
export type SelectOptionRenderGroup = {
  label: string | null
  options: SelectFlatOption[]
}

function isGroupEntry(x: Record<string, unknown>): boolean {
  return x.type === 'group' && Array.isArray(x.options)
}

function mapOptionRow(x: Record<string, unknown>): SelectFlatOption {
  return {
    value: String(x.value ?? ''),
    label: String(x.label ?? x.value ?? ''),
  }
}

/**
 * 將 `config.options` 轉成帶群組標題的結構，供 Select / Popover 渲染。
 */
export function getSelectOptionsGrouped(raw: unknown): SelectOptionRenderGroup[] {
  if (!Array.isArray(raw) || raw.length === 0) return []

  const groups: SelectOptionRenderGroup[] = []
  let root: SelectFlatOption[] = []

  const flushRoot = () => {
    if (root.length > 0) {
      groups.push({ label: null, options: root })
      root = []
    }
  }

  for (const el of raw) {
    if (el === null || typeof el !== 'object') continue
    const o = el as Record<string, unknown>
    if (isGroupEntry(o)) {
      flushRoot()
      const title = String(o.label ?? '')
      const opts = (o.options as unknown[])
        .filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object')
        .map(mapOptionRow)
        .filter((x) => x.value.length > 0)
      if (opts.length > 0) {
        groups.push({ label: title || null, options: opts })
      }
    } else if ('value' in o) {
      const row = mapOptionRow(o)
      if (row.value.length > 0) root.push(row)
    }
  }
  flushRoot()
  return groups
}

/** 扁平化所有選項（條件顯示、唯一性檢查等） */
export function flattenSelectOptions(raw: unknown): SelectFlatOption[] {
  const out: SelectFlatOption[] = []
  for (const g of getSelectOptionsGrouped(raw)) {
    out.push(...g.options)
  }
  return out
}

export function isSelectMultipleConfig(config: Record<string, unknown> | undefined): boolean {
  return config?.multiple === true
}
