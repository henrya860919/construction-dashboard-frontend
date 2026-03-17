<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
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
import {
  listProjectWbs,
  createWbsNode,
  updateWbsNode,
  deleteWbsNode,
  moveWbsNode,
} from '@/api/wbs'
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
} from 'lucide-vue-next'

/** 目前展開的節點 id 集合（未在集合內則視為收合） */
const expandedIds = ref<Set<string>>(new Set())

/** 已勾選的節點 id 集合（階層勾選：勾選父會勾選所有子，取消勾選同理） */
const selectedIds = ref<Set<string>>(new Set())

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

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
  const next = { ...levelColors.value }
  if (value) {
    next[depth] = value
  } else {
    delete next[depth]
  }
  levelColors.value = next
}

async function fetchWbs() {
  if (!projectId.value) return
  loading.value = true
  listError.value = null
  try {
    const tree = await listProjectWbs(projectId.value)
    wbsTree.value = tree
  } catch (e: unknown) {
    listError.value = e instanceof Error ? e.message : '無法載入 WBS'
  } finally {
    loading.value = false
  }
}

/** 執行拖放：呼叫 API 移動節點後重載 */
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
const createSubmitting = ref(false)
const createError = ref<string | null>(null)

function openCreateRoot() {
  createParentId.value = null
  createName.value = ''
  createError.value = null
  createDialogOpen.value = true
}

function openCreateChild(parentNode: WbsNode) {
  createParentId.value = parentNode.id
  createName.value = ''
  createError.value = null
  createDialogOpen.value = true
}

async function submitCreate() {
  if (!projectId.value || !createName.value.trim()) return
  createSubmitting.value = true
  createError.value = null
  try {
    await createWbsNode(projectId.value, {
      parentId: createParentId.value,
      name: createName.value.trim(),
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

const editDialogOpen = ref(false)
const editNode = ref<WbsNode | null>(null)
const editName = ref('')
const editSubmitting = ref(false)
const editError = ref<string | null>(null)

function openEdit(node: WbsNode) {
  editNode.value = node
  editName.value = node.name
  editError.value = null
  editDialogOpen.value = true
}

async function submitEdit() {
  if (!projectId.value || !editNode.value || !editName.value.trim()) return
  editSubmitting.value = true
  editError.value = null
  try {
    await updateWbsNode(projectId.value, editNode.value.id, { name: editName.value.trim() })
    editDialogOpen.value = false
    await fetchWbs()
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

onMounted(() => {
  fetchWbs().then(() => expandAll())
})
watch(projectId, (id) => {
  if (id) fetchWbs().then(() => expandAll())
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">WBS清單</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        工作分解結構，支援多層樹狀展開／收合、拖移排序。項目名稱欄顯示「編號 ＋ 項目名稱」。拖曳左側把手可調整群組順序。
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
      <Button variant="outline" size="sm" @click="expandAll">全部展開</Button>
      <Button variant="outline" size="sm" @click="collapseAll">全部收合</Button>
      <Dialog v-model:open="settingsOpen">
        <DialogTrigger as-child>
          <Button variant="outline" size="sm" class="gap-1.5">
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
            <div
              v-for="d in maxDepth + 1"
              :key="d - 1"
              class="flex items-center gap-3"
            >
              <Label class="w-24 shrink-0 text-foreground">第 {{ d }} 層</Label>
              <div class="flex items-center gap-2 flex-1">
                <input
                  :value="levelColors[d - 1]"
                  type="color"
                  class="h-9 w-14 cursor-pointer rounded border border-border bg-background"
                  @input="setLevelColor(d - 1, (($event.target as HTMLInputElement).value))"
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
                :checked="
                  isHeaderIndeterminate ? 'indeterminate' : isHeaderChecked
                "
                aria-label="全選"
                @update:checked="toggleHeaderSelect"
              />
            </TableHead>
            <TableHead>項目名稱</TableHead>
            <TableHead class="w-12 px-1" aria-label="操作" />
          </TableRow>
        </TableHeader>
        <TableBody ref="tableBodyRef">
          <template v-if="flattenedList.length === 0">
            <TableRow>
              <TableCell colspan="4" class="text-center text-muted-foreground py-8">
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
              <td colspan="4" class="h-0 p-0 align-top">
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
              </TableCell>
              <TableCell class="w-10">
              <Checkbox
                :checked="
                  isRowIndeterminate(item.node)
                    ? 'indeterminate'
                    : isRowChecked(item.node)
                "
                :aria-label="`勾選 ${item.node.name}`"
                @update:checked="toggleSelect(item.node)"
              />
            </TableCell>
            <TableCell
              class="text-foreground"
              :style="getParentLevelStyle(item)"
            >
              <div
                class="flex items-center gap-1 min-w-0"
                :style="{ paddingLeft: `${item.depth * 20}px` }"
              >
                <!-- 展開/收合按鈕（有子節點時顯示） -->
                <Button
                  v-if="item.hasChildren"
                  variant="ghost"
                  size="icon"
                  class="size-6 shrink-0 rounded"
                  @click="toggleExpand(item.node.id)"
                >
                  <ChevronDown
                    v-if="expandedIds.has(item.node.id)"
                    class="size-4 text-muted-foreground"
                  />
                  <ChevronRight
                    v-else
                    class="size-4 text-muted-foreground"
                  />
                </Button>
                <span v-else class="size-6 shrink-0" aria-hidden="true" />
                <span
                  class="truncate"
                  :class="{ 'font-semibold': item.hasChildren }"
                >
                  {{ item.node.code }} {{ item.node.name }}
                </span>
              </div>
            </TableCell>
            <TableCell class="w-12 p-1">
              <DropdownMenu>
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
                  <DropdownMenuItem @click="openEdit(item.node)">
                    <Pencil class="size-4" />
                    編輯
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    class="text-destructive focus:text-destructive"
                    @click="openDelete(item.node)"
                  >
                    <Trash2 class="size-4" />
                    刪除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <!-- 新增節點對話框 -->
    <Dialog v-model:open="createDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ createParentId ? '新增子節點' : '新增根節點' }}</DialogTitle>
          <DialogDescription>輸入項目名稱，編號將由系統自動產生。</DialogDescription>
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
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>編輯項目</DialogTitle>
          <DialogDescription>修改項目名稱，編號由系統維護。</DialogDescription>
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
            確定要刪除「{{ deleteNode?.code }} {{ deleteNode?.name }}」嗎？若有子節點將一併刪除，此操作無法復原。
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
            <span
              class="truncate text-sm"
              :class="{ 'font-semibold': draggingItem.hasChildren }"
            >
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
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.ghost-enter-from,
.ghost-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.96);
}
</style>
