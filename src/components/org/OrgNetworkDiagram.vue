<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { VueFlow, ConnectionMode } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import type { Node, Edge } from '@vue-flow/core'
import type { OrgDeptTreeNode } from '@/api/organization'
import OrgTenantFlowNode from '@/components/org/OrgTenantFlowNode.vue'
import type { OrgTenantFlowData } from '@/components/org/OrgTenantFlowNode.vue'
import OrgDeptFlowNode from '@/components/org/OrgDeptFlowNode.vue'
import { cn } from '@/lib/utils'

const TENANT_NODE_ID = '__org_tenant_root__'

const TENANT_W = 280
const TENANT_H = 120
const DEPT_W = 260
/** 節點實際高度隨字級／是否列出成員變化，用於分層排版避免重疊 */
const DEPT_H_WITH_MEMBERS = 168
const DEPT_H_NO_MEMBERS = 96

type FlowNodeUnion =
  | Node<{ kind: 'tenant'; tenant: OrgTenantFlowData }>
  | Node<{ kind: 'dept'; node: OrgDeptTreeNode }>

const props = withDefaults(
  defineProps<{
    departments: OrgDeptTreeNode[]
    /** 顯示於頂層的租戶名稱；空字串則不建立虛擬根，改以多部門並列為根 */
    tenantLabel?: string
    memberCount?: number
    departmentCount?: number
    /** true：外層由父層與詳情並排，填滿高度、不畫外框（父層統一邊框） */
    embedded?: boolean
    /** 部門節點是否列出成員（職稱） */
    showDeptMembers?: boolean
  }>(),
  {
    tenantLabel: '',
    memberCount: 0,
    departmentCount: 0,
    embedded: false,
    showDeptMembers: true,
  }
)

function flattenDepartments(nodes: OrgDeptTreeNode[]): OrgDeptTreeNode[] {
  const out: OrgDeptTreeNode[] = []
  function walk(arr: OrgDeptTreeNode[]) {
    for (const n of arr) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

type EdgePair = { v: string; w: string }

function buildEdgePairs(
  roots: OrgDeptTreeNode[],
  flat: OrgDeptTreeNode[],
  useTenantRoot: boolean
): EdgePair[] {
  const seen = new Set<string>()
  const pairs: EdgePair[] = []
  function add(v: string, w: string) {
    const k = `${v}->${w}`
    if (seen.has(k)) return
    seen.add(k)
    pairs.push({ v, w })
  }
  if (useTenantRoot) {
    for (const r of roots) add(TENANT_NODE_ID, r.id)
  }
  for (const n of flat) {
    if (n.parentId) add(n.parentId, n.id)
  }
  return pairs
}

/** 同層節點左右間距、層與層之間垂直間距 */
const LAYER_H_GAP = 56
const LAYER_V_GAP = 64

function sortSiblings(nodes: OrgDeptTreeNode[]): OrgDeptTreeNode[] {
  return [...nodes].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-Hant')
  )
}

/**
 * 依樹狀深度分層（BFS）：上→下為層級；同層由左至右依兄弟 sortOrder／名稱排序。
 */
function layersByDepth(
  roots: OrgDeptTreeNode[],
  useTenantRoot: boolean
): Map<number, string[]> {
  const layers = new Map<number, string[]>()
  if (useTenantRoot) layers.set(0, [TENANT_NODE_ID])

  type Q = { node: OrgDeptTreeNode; depth: number }
  const queue: Q[] = sortSiblings(roots).map((n) => ({
    node: n,
    depth: useTenantRoot ? 1 : 0,
  }))

  let qi = 0
  while (qi < queue.length) {
    const { node, depth } = queue[qi++]!
    if (!layers.has(depth)) layers.set(depth, [])
    layers.get(depth)!.push(node.id)
    for (const c of sortSiblings(node.children)) {
      queue.push({ node: c, depth: depth + 1 })
    }
  }
  return layers
}

function computeStratifiedLayout(
  roots: OrgDeptTreeNode[],
  flat: OrgDeptTreeNode[],
  useTenantRoot: boolean,
  sizes: Map<string, { w: number; h: number }>
): Record<string, { x: number; y: number }> {
  const posById: Record<string, { x: number; y: number }> = {}
  if (flat.length === 0 && !useTenantRoot) return posById

  const layers = layersByDepth(roots, useTenantRoot)
  const depths = [...layers.keys()].sort((a, b) => a - b)
  let yCursor = 0

  for (const d of depths) {
    const ids = layers.get(d) ?? []
    if (!ids.length) continue

    const widths = ids.map((id) => sizes.get(id)?.w ?? DEPT_W)
    const heights = ids.map((id) => sizes.get(id)?.h ?? DEPT_H_NO_MEMBERS)
    const totalW = widths.reduce((a, w) => a + w, 0) + Math.max(0, ids.length - 1) * LAYER_H_GAP
    const rowH = Math.max(...heights)

    let xLeft = -totalW / 2
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]
      const w = widths[i]
      const h = heights[i]
      posById[id] = {
        x: xLeft,
        y: yCursor + (rowH - h) / 2,
      }
      xLeft += w + LAYER_H_GAP
    }
    yCursor += rowH + LAYER_V_GAP
  }

  return posById
}

const flowNodes = ref<FlowNodeUnion[]>([])
const flowEdges = ref<Edge[]>([])
const vueFlowRef = ref<InstanceType<typeof VueFlow> | null>(null)

/** 有租戶名稱時顯示頂層節點（無部門時僅顯示該節點） */
const useTenantRoot = computed(() => Boolean(props.tenantLabel?.trim()))

function buildGraph() {
  const roots = props.departments
  const flat = flattenDepartments(roots)
  const pairs = buildEdgePairs(roots, flat, useTenantRoot.value)

  const sizes = new Map<string, { w: number; h: number }>()
  if (useTenantRoot.value) {
    sizes.set(TENANT_NODE_ID, { w: TENANT_W, h: TENANT_H })
  }
  const deptH = props.showDeptMembers ? DEPT_H_WITH_MEMBERS : DEPT_H_NO_MEMBERS
  for (const d of flat) {
    sizes.set(d.id, { w: DEPT_W, h: deptH })
  }

  // 僅租戶、無部門
  if (useTenantRoot.value && flat.length === 0) {
    flowNodes.value = [
      {
        id: TENANT_NODE_ID,
        type: 'orgTenant',
        position: { x: 0, y: 0 },
        data: {
          kind: 'tenant',
          tenant: {
            name: props.tenantLabel.trim(),
            memberCount: props.memberCount,
            departmentCount: props.departmentCount,
          },
        },
      },
    ]
    flowEdges.value = []
    nextTick(() => vueFlowRef.value?.fitView?.({ padding: 0.25, duration: 200 }))
    return
  }

  if (flat.length === 0 && !useTenantRoot.value) {
    flowNodes.value = []
    flowEdges.value = []
    return
  }

  const posById = computeStratifiedLayout(roots, flat, useTenantRoot.value, sizes)
  const list: FlowNodeUnion[] = []

  if (useTenantRoot.value) {
    list.push({
      id: TENANT_NODE_ID,
      type: 'orgTenant',
      position: posById[TENANT_NODE_ID] ?? { x: 0, y: 0 },
      data: {
        kind: 'tenant',
        tenant: {
          name: props.tenantLabel.trim(),
          memberCount: props.memberCount,
          departmentCount: props.departmentCount,
        },
      },
    })
  }

  for (const d of flat) {
    list.push({
      id: d.id,
      type: 'orgDept',
      position: posById[d.id] ?? { x: 0, y: 0 },
      data: { kind: 'dept', node: d },
    })
  }

  const edges: Edge[] = pairs.map((e) => ({
    id: `e-${e.v}-${e.w}`,
    source: e.v,
    target: e.w,
    type: 'smoothstep',
    style: { stroke: 'var(--border)', strokeWidth: 2 },
  }))

  flowNodes.value = list
  flowEdges.value = edges
  nextTick(() => vueFlowRef.value?.fitView?.({ padding: 0.2, duration: 200 }))
}

watch(
  () =>
    [
      props.departments,
      props.tenantLabel,
      props.memberCount,
      props.departmentCount,
      props.showDeptMembers,
    ] as const,
  () => buildGraph(),
  { deep: true, immediate: true }
)

defineExpose({
  fitView: () => vueFlowRef.value?.fitView?.({ padding: 0.2, duration: 200 }),
})
</script>

<template>
  <div class="w-full" :class="embedded ? 'flex h-full min-h-0 flex-col' : ''">
    <div
      :class="
        cn(
          'relative w-full bg-muted/30',
          embedded
            ? 'min-h-[12rem] flex-1 rounded-none border-0'
            : 'h-[min(70vh,640px)] min-h-[420px] rounded-lg border border-border'
        )
      "
    >
      <VueFlow
        v-if="flowNodes.length > 0"
        ref="vueFlowRef"
        :nodes="flowNodes"
        :edges="flowEdges"
        :nodes-draggable="false"
        :nodes-connectable="false"
        :connection-mode="ConnectionMode.Strict"
        :elements-selectable="true"
        :fit-view-on-init="true"
        :delete-key-code="null"
        :class="embedded ? 'rounded-none' : 'rounded-lg'"
      >
        <template #node-orgTenant="slotProps">
          <OrgTenantFlowNode :data="slotProps.data.tenant" />
        </template>
        <template #node-orgDept="slotProps">
          <OrgDeptFlowNode
            :data="{ node: slotProps.data.node }"
            :show-members="showDeptMembers"
          />
        </template>
        <Background pattern-color="var(--border)" :gap="16" />
      </VueFlow>
      <div
        v-else
        :class="[
          'flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground',
          embedded ? 'rounded-none' : 'rounded-lg',
        ]"
      >
        <p>尚無部門可繪製網路圖，請先建立部門。</p>
      </div>
    </div>
  </div>
</template>
