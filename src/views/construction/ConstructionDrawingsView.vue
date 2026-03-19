<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
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
import { ButtonGroup } from '@/components/ui/button-group'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DrawingNodeTree, DrawingFlatItem, DrawingRevisionItem } from '@/types/drawing-node'
import {
  listDrawingNodes,
  createDrawingNode,
  updateDrawingNode,
  deleteDrawingNode,
  moveDrawingNode,
  listDrawingRevisions,
  DRAWING_REVISION_CATEGORY,
} from '@/api/drawing-nodes'
import { uploadFile, getFileBlob } from '@/api/files'
import {
  ChevronRight,
  ChevronDown,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Upload,
  History,
  Download,
  FileText,
} from 'lucide-vue-next'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-TW', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const tree = ref<DrawingNodeTree[]>([])
const loading = ref(false)
const listError = ref<string | null>(null)

const expandedIds = ref<Set<string>>(new Set())
const selectedIds = ref<Set<string>>(new Set())

function flattenDrawingTree(
  nodes: DrawingNodeTree[],
  expanded: Set<string>,
  depth: number,
  parentId: string | null = null
): DrawingFlatItem[] {
  const result: DrawingFlatItem[] = []
  for (const node of nodes) {
    const hasChildren = node.kind === 'folder' && Boolean(node.children?.length)
    result.push({ node, depth, hasChildren, parentId })
    if (hasChildren && expanded.has(node.id) && node.children?.length) {
      result.push(...flattenDrawingTree(node.children, expanded, depth + 1, node.id))
    }
  }
  return result
}

const flattenedList = computed<DrawingFlatItem[]>(() =>
  flattenDrawingTree(tree.value, expandedIds.value, 0, null)
)

function collectNodeAndDescendantIds(node: DrawingNodeTree): Set<string> {
  const ids = new Set<string>([node.id])
  if (node.children?.length) {
    for (const c of node.children) {
      for (const id of collectNodeAndDescendantIds(c)) ids.add(id)
    }
  }
  return ids
}

function isRowChecked(node: DrawingNodeTree): boolean {
  const ids = collectNodeAndDescendantIds(node)
  return ids.size > 0 && [...ids].every((id) => selectedIds.value.has(id))
}

function isRowIndeterminate(node: DrawingNodeTree): boolean {
  const ids = collectNodeAndDescendantIds(node)
  if (ids.size <= 1) return false
  const n = [...ids].filter((id) => selectedIds.value.has(id)).length
  return n > 0 && n < ids.size
}

function toggleSelect(node: DrawingNodeTree) {
  const ids = collectNodeAndDescendantIds(node)
  const next = new Set(selectedIds.value)
  const all = [...ids].every((id) => next.has(id))
  if (all) ids.forEach((id) => next.delete(id))
  else ids.forEach((id) => next.add(id))
  selectedIds.value = next
}

const allNodeIds = computed(() => {
  const ids = new Set<string>()
  function walk(nodes: DrawingNodeTree[]) {
    for (const n of nodes) {
      for (const id of collectNodeAndDescendantIds(n)) ids.add(id)
    }
  }
  walk(tree.value)
  return ids
})

const isHeaderChecked = computed(
  () => allNodeIds.value.size > 0 && [...allNodeIds.value].every((id) => selectedIds.value.has(id))
)
const isHeaderIndeterminate = computed(() => {
  const all = allNodeIds.value
  if (all.size === 0) return false
  const n = [...all].filter((id) => selectedIds.value.has(id)).length
  return n > 0 && n < all.size
})

function toggleHeaderSelect() {
  if (isHeaderChecked.value) selectedIds.value = new Set()
  else selectedIds.value = new Set(allNodeIds.value)
}

function clearSelection() {
  selectedIds.value = new Set()
}

const selectedCount = computed(() => selectedIds.value.size)

function toggleExpand(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

function expandAll() {
  const ids = new Set<string>()
  function collect(nodes: DrawingNodeTree[]) {
    for (const n of nodes) {
      if (n.kind === 'folder' && n.children?.length) {
        ids.add(n.id)
        collect(n.children)
      }
    }
  }
  collect(tree.value)
  expandedIds.value = ids
}

function collapseAll() {
  expandedIds.value = new Set()
}

async function fetchTree() {
  if (!projectId.value) return
  loading.value = true
  listError.value = null
  try {
    tree.value = await listDrawingNodes(projectId.value)
    expandAll()
  } catch (e: unknown) {
    listError.value = e instanceof Error ? e.message : '無法載入圖說'
  } finally {
    loading.value = false
  }
}

onMounted(fetchTree)
watch(projectId, fetchTree)

/** ----- 拖曳（同 WBS：pointer + 插入線） ----- */
const draggingItem = ref<DrawingFlatItem | null>(null)
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

async function moveNodeToFlatIndex(nodeId: string, insertBeforeIndex: number) {
  if (!projectId.value) return
  const flat = flattenedList.value
  const currentIndex = flat.findIndex((it) => it.node.id === nodeId)
  if (currentIndex === -1 || currentIndex === insertBeforeIndex) return
  const refItem =
    insertBeforeIndex < flat.length ? flat[insertBeforeIndex] : flat[flat.length - 1]
  if (!refItem) return
  try {
    tree.value = await moveDrawingNode(projectId.value, nodeId, {
      parentId: refItem.parentId,
      insertBeforeId: insertBeforeIndex < flat.length ? refItem.node.id : undefined,
    })
  } catch {
    await fetchTree()
  }
}

function onDragHandlePointerDown(e: PointerEvent, item: DrawingFlatItem) {
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
      /* noop */
    }
  }
  handleEl.addEventListener('pointermove', onMove as EventListener)
  handleEl.addEventListener('pointerup', onUp as EventListener)
  handleEl.addEventListener('pointercancel', onUp as EventListener)
}

/** ----- 新增 ----- */
const createOpen = ref(false)
const createParentId = ref<string | null>(null)
const createKind = ref<'folder' | 'leaf'>('folder')
const createName = ref('')
const createSubmitting = ref(false)
const createError = ref<string | null>(null)

function openCreate(parentId: string | null, kind: 'folder' | 'leaf') {
  createParentId.value = parentId
  createKind.value = kind
  createName.value = ''
  createError.value = null
  createOpen.value = true
}

async function submitCreate() {
  if (!projectId.value || !createName.value.trim()) return
  createSubmitting.value = true
  createError.value = null
  try {
    tree.value = await createDrawingNode(projectId.value, {
      parentId: createParentId.value,
      name: createName.value.trim(),
      kind: createKind.value,
    })
    createOpen.value = false
    expandAll()
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    createError.value = ax.response?.data?.error?.message ?? '新增失敗'
  } finally {
    createSubmitting.value = false
  }
}

/** ----- 編輯名稱 ----- */
const editOpen = ref(false)
const editNode = ref<DrawingNodeTree | null>(null)
const editName = ref('')
const editSubmitting = ref(false)
const editError = ref<string | null>(null)

function openEdit(node: DrawingNodeTree) {
  editNode.value = node
  editName.value = node.name
  editError.value = null
  editOpen.value = true
}

async function submitEdit() {
  if (!projectId.value || !editNode.value || !editName.value.trim()) return
  editSubmitting.value = true
  editError.value = null
  try {
    tree.value = await updateDrawingNode(projectId.value, editNode.value.id, {
      name: editName.value.trim(),
    })
    editOpen.value = false
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    editError.value = ax.response?.data?.error?.message ?? '更新失敗'
  } finally {
    editSubmitting.value = false
  }
}

/** ----- 刪除單筆 ----- */
const deleteOpen = ref(false)
const deleteTarget = ref<DrawingNodeTree | null>(null)
const deleteSubmitting = ref(false)

function openDelete(node: DrawingNodeTree) {
  deleteTarget.value = node
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!projectId.value || !deleteTarget.value) return
  deleteSubmitting.value = true
  try {
    await deleteDrawingNode(projectId.value, deleteTarget.value.id)
    deleteOpen.value = false
    deleteTarget.value = null
    clearSelection()
    await fetchTree()
  } finally {
    deleteSubmitting.value = false
  }
}

/** ----- 批次刪除 ----- */
const batchDeleteOpen = ref(false)
const batchDeleteSubmitting = ref(false)

function openBatchDelete() {
  batchDeleteOpen.value = true
}

function sortSelectedIdsForDelete(): string[] {
  const depthById = new Map(flattenedList.value.map((it) => [it.node.id, it.depth]))
  return [...selectedIds.value].sort((a, b) => (depthById.get(b) ?? 0) - (depthById.get(a) ?? 0))
}

async function confirmBatchDelete() {
  if (!projectId.value || selectedIds.value.size === 0) return
  batchDeleteSubmitting.value = true
  try {
    const ordered = sortSelectedIdsForDelete()
    for (const id of ordered) {
      try {
        await deleteDrawingNode(projectId.value, id)
      } catch {
        /* 可能已被連帶刪除 */
      }
    }
    batchDeleteOpen.value = false
    clearSelection()
    await fetchTree()
  } finally {
    batchDeleteSubmitting.value = false
  }
}

/** ----- 上傳 ----- */
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadLeafId = ref<string | null>(null)
const uploading = ref(false)
const uploadError = ref<string | null>(null)

function openUpload(leafId: string) {
  uploadLeafId.value = leafId
  uploadError.value = null
  nextTick(() => fileInputRef.value?.click())
}

async function onFileInputChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  const leafId = uploadLeafId.value
  input.value = ''
  uploadLeafId.value = null
  if (!file || !projectId.value || !leafId) return
  uploading.value = true
  uploadError.value = null
  try {
    await uploadFile({
      file,
      projectId: projectId.value,
      category: DRAWING_REVISION_CATEGORY,
      businessId: leafId,
    })
    await fetchTree()
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    uploadError.value = ax.response?.data?.error?.message ?? '上傳失敗'
  } finally {
    uploading.value = false
  }
}

/** ----- 下載最新 ----- */
const downloadBusyId = ref<string | null>(null)

async function downloadLatest(node: DrawingNodeTree) {
  const f = node.latestFile
  if (!f) return
  downloadBusyId.value = node.id
  try {
    const { blob, fileName } = await getFileBlob(f.id, { download: true, fileName: f.fileName })
    downloadBlob(blob, fileName)
  } finally {
    downloadBusyId.value = null
  }
}

/** ----- 版本歷史 ----- */
const historyOpen = ref(false)
const historyNode = ref<DrawingNodeTree | null>(null)
const historyRows = ref<DrawingRevisionItem[]>([])
const historyLoading = ref(false)
const historyError = ref<string | null>(null)
const historyDownloadId = ref<string | null>(null)

async function openHistory(node: DrawingNodeTree) {
  historyNode.value = node
  historyRows.value = []
  historyError.value = null
  historyOpen.value = true
  if (!projectId.value) return
  historyLoading.value = true
  try {
    historyRows.value = await listDrawingRevisions(projectId.value, node.id)
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    historyError.value = ax.response?.data?.error?.message ?? '無法載入版本'
  } finally {
    historyLoading.value = false
  }
}

async function downloadRevision(row: DrawingRevisionItem) {
  historyDownloadId.value = row.id
  try {
    const { blob, fileName } = await getFileBlob(row.id, { download: true, fileName: row.fileName })
    downloadBlob(blob, fileName)
  } finally {
    historyDownloadId.value = null
  }
}

const colCount = 5
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">圖說管理</h1>
      <p class="mt-1 text-sm text-muted-foreground max-w-3xl">
        分類節點僅供整理；圖說項目可上傳新版本。<strong class="text-foreground">下載最新</strong>永遠取得該項目目前最新檔，避免現場誤用舊圖。
      </p>
    </div>

    <p v-if="uploadError" class="text-sm text-destructive">{{ uploadError }}</p>

    <div class="flex flex-wrap items-center justify-end gap-2">
      <span v-if="selectedCount > 0" class="text-sm text-muted-foreground tabular-nums">
        已選 {{ selectedCount }} 項
      </span>
      <ButtonGroup v-if="selectedCount > 0">
        <Button variant="outline" size="sm" @click="clearSelection">取消選取</Button>
        <Button variant="destructive" size="sm" @click="openBatchDelete">批次刪除</Button>
      </ButtonGroup>
      <Button variant="outline" size="sm" @click="openCreate(null, 'folder')">新增頂層分類</Button>
      <Button variant="outline" size="sm" @click="openCreate(null, 'leaf')">新增頂層圖說</Button>
      <Button variant="outline" size="sm" :disabled="loading" @click="expandAll">全部展開</Button>
      <Button variant="outline" size="sm" :disabled="loading" @click="collapseAll">全部收合</Button>
    </div>

    <div class="rounded-lg border border-border bg-card p-4">
      <div
        v-if="loading"
        class="flex items-center justify-center gap-2 py-12 text-muted-foreground"
      >
        <Loader2 class="size-5 animate-spin" />
        載入中…
      </div>
      <p v-else-if="listError" class="py-4 text-center text-sm text-destructive">{{ listError }}</p>
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
            <TableHead>項目名稱</TableHead>
            <TableHead class="whitespace-nowrap text-muted-foreground">最新上傳時間</TableHead>
            <TableHead
              class="min-w-[10.5rem] px-1 text-right text-muted-foreground"
              aria-label="操作"
            />
          </TableRow>
        </TableHeader>
        <TableBody ref="tableBodyRef">
          <template v-if="flattenedList.length === 0">
            <TableRow>
              <TableCell :colspan="colCount" class="py-8 text-center text-muted-foreground">
                尚無圖說項目，請新增分類或圖說。
              </TableCell>
            </TableRow>
          </template>
          <template v-for="(item, flatIndex) in flattenedList" :key="item.node.id">
            <tr
              v-if="dropInsertBeforeIndex === flatIndex"
              class="pointer-events-none"
              aria-hidden="true"
            >
              <td :colspan="colCount" class="h-0 p-0 align-top">
                <div
                  class="mx-2 h-0.5 min-h-[2px] rounded-full bg-primary/90 shadow-sm"
                  style="margin-top: -1px"
                />
              </td>
            </tr>
            <TableRow
              :data-flat-index="flatIndex"
              class="group transition-colors"
              :class="{ 'opacity-40': draggingItem?.node.id === item.node.id }"
            >
              <TableCell class="w-8 p-1 align-middle">
                <div
                  role="button"
                  tabindex="0"
                  class="flex cursor-grab touch-none items-center justify-center rounded p-1 text-muted-foreground/60 hover:bg-muted/80 hover:text-foreground active:cursor-grabbing"
                  aria-label="拖移排序"
                  @pointerdown="onDragHandlePointerDown($event, item)"
                >
                  <GripVertical class="size-4" />
                </div>
              </TableCell>
              <TableCell class="w-10 p-1 align-middle">
                <Checkbox
                  :checked="isRowIndeterminate(item.node) ? 'indeterminate' : isRowChecked(item.node)"
                  :aria-label="`勾選 ${item.node.name}`"
                  @update:checked="toggleSelect(item.node)"
                />
              </TableCell>
              <TableCell class="text-foreground p-1 align-middle">
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
                  <FileText
                    v-if="item.node.kind === 'leaf'"
                    class="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span v-else class="size-4 shrink-0" aria-hidden="true" />
                  <span
                    class="min-w-0 truncate text-sm"
                    :class="{ 'font-semibold': item.hasChildren }"
                    >{{ item.node.name }}</span
                  >
                </div>
              </TableCell>
              <TableCell
                class="p-1 align-middle whitespace-nowrap text-sm text-muted-foreground tabular-nums"
              >
                <template v-if="item.node.kind === 'leaf'">
                  {{ item.node.latestFile ? formatDateTime(item.node.latestFile.createdAt) : '—' }}
                </template>
                <template v-else>—</template>
              </TableCell>
              <TableCell class="min-w-[10.5rem] p-1 align-middle">
                <div class="flex flex-nowrap items-center justify-end gap-0.5">
                  <template v-if="item.node.kind === 'leaf'">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8 shrink-0"
                      title="上傳新版本"
                      :disabled="uploading"
                      @click="openUpload(item.node.id)"
                    >
                      <Upload class="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8 shrink-0"
                      title="檔案版本紀錄"
                      @click="openHistory(item.node)"
                    >
                      <History class="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8 shrink-0"
                      title="下載最新檔"
                      :disabled="!item.node.latestFile || downloadBusyId === item.node.id"
                      @click="downloadLatest(item.node)"
                    >
                      <Download class="size-4" />
                    </Button>
                  </template>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" class="size-8 shrink-0" aria-label="更多">
                        <MoreHorizontal class="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-48">
                      <DropdownMenuItem v-if="item.node.kind === 'folder'" @click="openCreate(item.node.id, 'folder')">
                        新增子分類
                      </DropdownMenuItem>
                      <DropdownMenuItem v-if="item.node.kind === 'folder'" @click="openCreate(item.node.id, 'leaf')">
                        新增圖說項目
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="openEdit(item.node)">編輯名稱</DropdownMenuItem>
                      <DropdownMenuItem class="text-destructive" @click="openDelete(item.node)">
                        刪除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      class="sr-only"
      accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.webp,.zip,.doc,.docx"
      @change="onFileInputChange"
    />

    <!-- 拖曳幽靈 -->
    <Teleport to="body">
      <div
        v-if="draggingItem"
        class="pointer-events-none fixed z-[100] max-w-sm truncate rounded-md border border-border bg-card px-3 py-2 text-sm shadow-lg text-foreground"
        :style="{ left: `${ghostPosition.x}px`, top: `${ghostPosition.y}px` }"
      >
        {{ draggingItem.node.name }}
      </div>
    </Teleport>

    <Dialog v-model:open="createOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ createKind === 'folder' ? '新增分類' : '新增圖說項目' }}</DialogTitle>
          <DialogDescription>
            {{ createParentId ? '將建立在選定分類底下。' : '將建立在頂層。' }}
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-2 py-2">
          <Label for="draw-create-name">名稱</Label>
          <Input
            id="draw-create-name"
            v-model="createName"
            class="bg-background"
            placeholder="請輸入名稱"
            @keydown.enter.prevent="submitCreate"
          />
          <p v-if="createError" class="text-sm text-destructive">{{ createError }}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="createOpen = false">取消</Button>
          <Button :disabled="createSubmitting || !createName.trim()" @click="submitCreate">
            <Loader2 v-if="createSubmitting" class="mr-2 size-4 animate-spin" />
            建立
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="editOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>編輯名稱</DialogTitle>
        </DialogHeader>
        <div class="grid gap-2 py-2">
          <Label for="draw-edit-name">名稱</Label>
          <Input id="draw-edit-name" v-model="editName" class="bg-background" />
          <p v-if="editError" class="text-sm text-destructive">{{ editError }}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="editOpen = false">取消</Button>
          <Button :disabled="editSubmitting || !editName.trim()" @click="submitEdit">
            <Loader2 v-if="editSubmitting" class="mr-2 size-4 animate-spin" />
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="deleteOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>刪除節點</DialogTitle>
          <DialogDescription>
            將刪除「{{ deleteTarget?.name }}」及其子項目，並移除相關檔案。此動作無法復原。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="deleteOpen = false">取消</Button>
          <Button variant="destructive" :disabled="deleteSubmitting" @click="confirmDelete">
            <Loader2 v-if="deleteSubmitting" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="batchDeleteOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批次刪除</DialogTitle>
          <DialogDescription>將刪除已選取的 {{ selectedCount }} 個節點（含子樹與檔案）。此動作無法復原。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="batchDeleteOpen = false">取消</Button>
          <Button variant="destructive" :disabled="batchDeleteSubmitting" @click="confirmBatchDelete">
            <Loader2 v-if="batchDeleteSubmitting" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="historyOpen">
      <DialogContent class="max-h-[85vh] sm:max-w-lg flex flex-col">
        <DialogHeader>
          <DialogTitle>檔案版本紀錄</DialogTitle>
          <DialogDescription v-if="historyNode" class="truncate">
            {{ historyNode.name }}
          </DialogDescription>
        </DialogHeader>
        <div class="min-h-0 flex-1 overflow-auto">
          <div v-if="historyLoading" class="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 class="size-4 animate-spin" />
            載入中…
          </div>
          <p v-else-if="historyError" class="text-sm text-destructive">{{ historyError }}</p>
          <Table v-else>
            <TableHeader>
              <TableRow>
                <TableHead>檔名</TableHead>
                <TableHead class="text-right">大小</TableHead>
                <TableHead class="whitespace-nowrap">上傳時間</TableHead>
                <TableHead class="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in historyRows" :key="row.id">
                <TableCell class="max-w-[140px] truncate text-sm">{{ row.fileName }}</TableCell>
                <TableCell class="text-right text-xs text-muted-foreground tabular-nums">
                  {{ formatBytes(row.fileSize) }}
                </TableCell>
                <TableCell class="whitespace-nowrap text-xs text-muted-foreground">
                  {{ formatDateTime(row.createdAt) }}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    :disabled="historyDownloadId === row.id"
                    aria-label="下載"
                    @click="downloadRevision(row)"
                  >
                    <Download class="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow v-if="!historyRows.length">
                <TableCell colspan="4" class="text-center text-muted-foreground py-6">
                  尚無上傳紀錄
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="historyOpen = false">關閉</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
