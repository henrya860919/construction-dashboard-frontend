<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, Loader2, Plus, Trash2 } from 'lucide-vue-next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { listDefectImprovements, deleteDefectImprovement } from '@/api/defect-improvements'
import { ROUTE_NAME } from '@/constants/routes'
import type { DefectItem, DefectStatus } from '@/types/defect-improvement'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)

const statusTab = ref<DefectStatus>('in_progress')
const loading = ref(false)
const items = ref<DefectItem[]>([])
const total = ref(0)

/** 各狀態數量，供 tab badge 顯示 */
const countByStatus = ref<Record<DefectStatus, number>>({ in_progress: 0, completed: 0 })

// FAB：捲動往下時隱藏、往上時顯示
const scrollContainerRef = ref<HTMLElement | null>(null)
const fabVisible = ref(true)
const lastScrollTop = ref(0)
const SCROLL_THRESHOLD = 12

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  const st = el.scrollTop
  const delta = st - lastScrollTop.value
  if (delta > SCROLL_THRESHOLD) {
    fabVisible.value = false
  } else if (delta < -SCROLL_THRESHOLD) {
    fabVisible.value = true
  }
  lastScrollTop.value = st
}

const statusTabs = [
  { value: 'in_progress' as const, label: '進行中' },
  { value: 'completed' as const, label: '已完成' },
]

/** Tab 內容區左右滑切換：記錄觸控起點，與卡片左滑刪除區分 */
const tabSwipeStartX = ref(0)
const tabSwipeStartY = ref(0)
const touchUsedForCardSwipe = ref(false)
const SWIPE_THRESHOLD = 48
const SWIPE_HORIZONTAL_RATIO = 1.2

function onTabContentTouchStart(e: TouchEvent) {
  tabSwipeStartX.value = e.touches[0].clientX
  tabSwipeStartY.value = e.touches[0].clientY
}

function onTabContentTouchEnd(e: TouchEvent) {
  if (e.changedTouches.length === 0) return
  if (touchUsedForCardSwipe.value) return
  const deltaX = e.changedTouches[0].clientX - tabSwipeStartX.value
  const deltaY = e.changedTouches[0].clientY - tabSwipeStartY.value
  if (Math.abs(deltaX) < SWIPE_THRESHOLD) return
  if (Math.abs(deltaX) <= Math.abs(deltaY) * SWIPE_HORIZONTAL_RATIO) return
  if (deltaX < 0) {
    if (statusTab.value === 'in_progress') statusTab.value = 'completed'
  } else {
    if (statusTab.value === 'completed') statusTab.value = 'in_progress'
  }
}

async function fetchCounts() {
  if (!projectId.value) return
  try {
    const [inProgressRes, completedRes] = await Promise.all([
      listDefectImprovements(projectId.value, { status: 'in_progress', limit: 1 }),
      listDefectImprovements(projectId.value, { status: 'completed', limit: 1 }),
    ])
    countByStatus.value = {
      in_progress: inProgressRes.meta.total,
      completed: completedRes.meta.total,
    }
  } catch {
    countByStatus.value = { in_progress: 0, completed: 0 }
  }
}

async function fetchList() {
  if (!projectId.value) return
  loading.value = true
  try {
    const res = await listDefectImprovements(projectId.value, {
      status: statusTab.value,
      limit: 50,
    })
    items.value = res.data
    total.value = res.meta.total
    countByStatus.value[statusTab.value] = res.meta.total
  } finally {
    loading.value = false
  }
}

watch(
  projectId,
  async () => {
    if (!projectId.value) return
    await fetchCounts()
    fetchList()
  },
  { immediate: true }
)
watch(statusTab, fetchList)

function goDetail(defect: DefectItem) {
  router.push({
    name: ROUTE_NAME.MOBILE_DEFECT_DETAIL,
    params: { projectId: projectId.value, defectId: defect.id },
  })
}

function goAdd() {
  router.push({
    name: ROUTE_NAME.MOBILE_DEFECT_NEW,
    params: { projectId: projectId.value },
  })
}

function priorityLabel(priority: string) {
  const map: Record<string, string> = { low: '低', medium: '中', high: '高' }
  return map[priority] ?? priority
}

// 左滑刪除（iPhone 風格）：僅一列可展開，需明顯水平滑動才啟動，避免上下滑時誤觸
const DELETE_BUTTON_WIDTH = 72
/** 水平移動超過此值且比垂直多才啟動左滑 */
const SWIPE_COMMIT_THRESHOLD = 32
/** 水平明顯大於垂直的倍率（|dx| > |dy| * CARD_SWIPE_H_RATIO） */
const CARD_SWIPE_H_RATIO = 1.8
/** 放開時超過按鈕寬度此比例才維持展開 */
const SNAP_OPEN_RATIO = 0.65

const openedId = ref<string | null>(null)
const dragId = ref<string | null>(null)
const dragStartX = ref(0)
const dragInitialOffset = ref(0)
const dragOffset = ref(0)
/** 手指按下但尚未判定為左滑的 card，避免上下滑誤觸 */
const pendingCardId = ref<string | null>(null)
const cardTouchStartX = ref(0)
const cardTouchStartY = ref(0)

function getSlideX(defectId: string): number {
  if (dragId.value === defectId) return dragOffset.value
  if (openedId.value === defectId) return -DELETE_BUTTON_WIDTH
  return 0
}

function onSwipeStart(e: TouchEvent, defect: DefectItem) {
  pendingCardId.value = defect.id
  cardTouchStartX.value = e.touches[0].clientX
  cardTouchStartY.value = e.touches[0].clientY
}

function onSwipeMove(e: TouchEvent, defect: DefectItem) {
  const defectId = defect.id
  if (dragId.value === defectId) {
    const delta = e.touches[0].clientX - dragStartX.value
    const next = Math.max(-DELETE_BUTTON_WIDTH, Math.min(0, dragInitialOffset.value + delta))
    dragOffset.value = next
    return
  }
  if (pendingCardId.value !== defectId) return
  const dx = e.touches[0].clientX - cardTouchStartX.value
  const dy = e.touches[0].clientY - cardTouchStartY.value
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  if (absDx > SWIPE_COMMIT_THRESHOLD && absDx > absDy * CARD_SWIPE_H_RATIO) {
    touchUsedForCardSwipe.value = true
    pendingCardId.value = null
    const wasOpen = openedId.value === defect.id
    openedId.value = null
    dragId.value = defectId
    dragStartX.value = cardTouchStartX.value
    dragInitialOffset.value = wasOpen ? -DELETE_BUTTON_WIDTH : 0
    dragOffset.value = Math.max(-DELETE_BUTTON_WIDTH, Math.min(0, dragInitialOffset.value + dx))
  }
}

function onSwipeEnd(defectId: string) {
  if (pendingCardId.value === defectId) pendingCardId.value = null
  if (dragId.value !== defectId) return
  const snapOpen = dragOffset.value < -DELETE_BUTTON_WIDTH * SNAP_OPEN_RATIO
  openedId.value = snapOpen ? defectId : null
  dragId.value = null
  setTimeout(() => {
    touchUsedForCardSwipe.value = false
  }, 0)
}

function closeSwipe() {
  openedId.value = null
}

function onCardClick(defect: DefectItem) {
  if (openedId.value === defect.id) {
    closeSwipe()
    return
  }
  goDetail(defect)
}

const deletingId = ref<string | null>(null)
async function confirmDelete(defect: DefectItem, e: Event) {
  e.stopPropagation()
  if (deletingId.value) return
  deletingId.value = defect.id
  try {
    await deleteDefectImprovement(projectId.value, defect.id)
    items.value = items.value.filter((i) => i.id !== defect.id)
    countByStatus.value[statusTab.value] = Math.max(0, countByStatus.value[statusTab.value] - 1)
    openedId.value = null
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="mobile-page flex h-full min-h-0 flex-col">
    <div class="shrink-0 px-4 pt-4 pb-3">
      <h2 class="text-lg font-semibold text-foreground">缺失改善</h2>
      <p class="mt-0.5 text-sm text-muted-foreground">進行中與已完成的改善項目</p>
    </div>

    <Tabs v-model="statusTab" class="flex min-h-0 flex-1 flex-col gap-3 px-4">
      <TabsList class="grid w-full shrink-0 grid-cols-2 rounded-xl bg-muted/60 p-1">
        <TabsTrigger
          v-for="tab in statusTabs"
          :key="tab.value"
          :value="tab.value"
          class="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
        >
          <span class="flex items-center gap-1.5">
            {{ tab.label }}
            <Badge variant="secondary" class="min-w-[1.25rem] px-1.5 py-0 text-xs font-medium">
              {{ countByStatus[tab.value] }}
            </Badge>
          </span>
        </TabsTrigger>
      </TabsList>

      <div
        ref="scrollContainerRef"
        class="scrollbar-hide min-h-0 flex-1 overflow-y-auto pb-6 pt-2"
        @scroll="onScroll"
        @touchstart="onTabContentTouchStart"
        @touchend="onTabContentTouchEnd"
      >
        <TabsContent v-for="tab in statusTabs" :key="tab.value" :value="tab.value" class="mt-0">
          <div v-if="loading" class="flex flex-col items-center justify-center py-12">
            <Loader2 class="size-8 animate-spin text-muted-foreground" aria-hidden />
            <p class="mt-2 text-sm text-muted-foreground">載入中...</p>
          </div>

          <div
            v-else-if="items.length === 0"
            class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center"
          >
            <AlertCircle class="mb-3 size-12 text-muted-foreground" aria-hidden />
            <p class="text-sm font-medium text-foreground">尚無{{ tab.label }}項目</p>
            <p class="mt-1 text-sm text-muted-foreground">缺失改善紀錄將顯示於此</p>
          </div>

          <ul v-else class="flex flex-col gap-3">
            <li
              v-for="defect in items"
              :key="defect.id"
              class="swipe-row relative overflow-hidden rounded-xl"
            >
              <!-- 左滑後露出的刪除按鈕 -->
              <div
                class="absolute right-0 top-0 flex h-full w-[72px] items-center justify-center rounded-r-xl bg-destructive"
                aria-hidden
              >
                <button
                  type="button"
                  class="flex h-full w-full items-center justify-center text-white touch-manipulation"
                  :disabled="deletingId === defect.id"
                  aria-label="刪除此筆缺失"
                  @click="confirmDelete(defect, $event)"
                >
                  <Trash2 v-if="deletingId !== defect.id" class="size-5" />
                  <Loader2 v-else class="size-5 animate-spin" />
                </button>
              </div>
              <!-- 可滑動的卡片內容 -->
              <div
                class="card-slide relative z-10 rounded-xl border border-border bg-card p-4 shadow-sm transition-transform duration-200 ease-out"
                :style="{ transform: `translateX(${getSlideX(defect.id)}px)` }"
                @touchstart="onSwipeStart($event, defect)"
                @touchmove="onSwipeMove($event, defect)"
                @touchend="onSwipeEnd(defect.id)"
                @click="onCardClick(defect)"
              >
                <div
                  class="flex cursor-pointer items-start justify-between gap-2 active:bg-muted/50"
                >
                  <p class="line-clamp-2 flex-1 text-sm font-medium text-foreground">
                    {{ defect.description }}
                  </p>
                  <span
                    class="shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                    :class="
                      defect.priority === 'high'
                        ? 'border-destructive/30 bg-destructive/10 text-destructive'
                        : defect.priority === 'medium'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : 'border-border bg-muted/50 text-muted-foreground'
                    "
                  >
                    {{ priorityLabel(defect.priority) }}
                  </span>
                </div>
                <div class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>發現人：{{ defect.discoveredBy }}</span>
                  <span v-if="defect.floor">樓層：{{ defect.floor }}</span>
                  <span v-if="defect.location">位置：{{ defect.location }}</span>
                </div>
              </div>
            </li>
          </ul>
        </TabsContent>
      </div>
    </Tabs>

    <!-- 右下角浮動新增按鈕：捲動往下隱藏、往上顯示 -->
    <Transition name="fab">
      <button
        v-show="fabVisible"
        type="button"
        class="fab pwa-fixed-bottom"
        aria-label="新增缺失"
        @click="goAdd"
      >
        <Plus class="size-6 text-primary-foreground" aria-hidden />
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.mobile-page {
  padding-bottom: 0;
}

/* 浮動按鈕：圓形、右下角、高於底部 Tab 列 */
.fab {
  position: fixed;
  right: 1.25rem;
  bottom: calc(3.5rem + max(0.5rem, env(safe-area-inset-bottom, 0px) * 1.5) + 0.75rem);
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 3.25rem;
  border: none;
  border-radius: 50%;
  background: var(--primary);
  color: var(--primary-foreground);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.fab:active {
  transform: scale(0.96);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* 捲動時 FAB 顯示／隱藏動畫 */
.fab-enter-active,
.fab-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.fab-enter-from,
.fab-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* 左滑刪除列 */
.swipe-row {
  touch-action: pan-y;
}
.card-slide {
  min-height: 4rem;
  touch-action: pan-y;
}
</style>
