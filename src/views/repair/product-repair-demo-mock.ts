/** 商品報修表（前端範本用假資料） */

export type DemoRepairStatus = 'todo' | 'in_progress' | 'done' | 'canceled'
export type DemoRepairPriority = 'low' | 'medium' | 'high'

export interface ProductRepairDemoRow {
  id: string
  /** 報修主旨／品項描述 */
  title: string
  status: DemoRepairStatus
  priority: DemoRepairPriority
  /** 預估處理工時（小時） */
  estHours: number
  /** 工時區間（分面用） */
  estHoursBucket: '0-2' | '3-5' | '6-8' | '9+'
  createdAt: Date
  /** 客戶／聯絡窗口（示意） */
  customerName: string
}

const PRODUCT_NAMES = [
  '變頻冷氣',
  '商用除濕機',
  '熱泵熱水器',
  '抽油煙機',
  '洗碗機',
  '洗衣機',
  '乾衣機',
  '空氣清淨機',
  '電熱水器',
  '凍藏展示櫃',
]

const ISSUES = [
  '異音',
  '不製冷',
  '漏水',
  '面板無顯示',
  '無法開機',
  '異味',
  '震動過大',
  '溫度異常',
  '遙控失效',
  '排水異常',
]

const STATUSES: DemoRepairStatus[] = ['todo', 'in_progress', 'done', 'canceled']
const PRIORITIES: DemoRepairPriority[] = ['low', 'medium', 'high']

const FAMILY_NAMES = ['王', '李', '張', '陳', '林', '黃', '吳', '劉', '蔡', '許']

function estHoursToBucket(h: number): ProductRepairDemoRow['estHoursBucket'] {
  if (h <= 2) return '0-2'
  if (h <= 5) return '3-5'
  if (h <= 8) return '6-8'
  return '9+'
}

/** 固定種子 pseudo random（列表穩定可重現） */
function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

/**
 * 產生指定筆數的假資料（預設 150）
 */
export function generateProductRepairDemoRows(count = 150): ProductRepairDemoRow[] {
  const rows: ProductRepairDemoRow[] = []
  const now = Date.now()
  const dayMs = 86400000

  for (let i = 0; i < count; i++) {
    const r1 = seeded(i, 1)
    const r2 = seeded(i, 2)
    const r3 = seeded(i, 3)
    const r4 = seeded(i, 4)
    const est = [1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12][Math.floor(r3 * 10)] ?? 4
    const daysAgo = Math.floor(r4 * 120)
    const createdAt = new Date(now - daysAgo * dayMs - Math.floor(seeded(i, 5) * dayMs))

    const product = PRODUCT_NAMES[i % PRODUCT_NAMES.length]
    const issue = ISSUES[Math.floor(r1 * ISSUES.length)]
    const fn = FAMILY_NAMES[i % FAMILY_NAMES.length]

    rows.push({
      id: `demo-pr-${String(i + 1).padStart(4, '0')}`,
      title: `${product} — ${issue}（單號 ${i + 1}）`,
      status: STATUSES[Math.floor(r2 * STATUSES.length)],
      priority: PRIORITIES[Math.floor(seeded(i, 6) * PRIORITIES.length)],
      estHours: est,
      estHoursBucket: estHoursToBucket(est),
      createdAt,
      customerName: `${fn}先生／小姐`,
    })
  }

  return rows
}
