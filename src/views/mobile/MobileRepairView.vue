<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, Loader2, Plus, Trash2 } from 'lucide-vue-next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { listRepairRequests, deleteRepairRequest } from '@/api/repair-requests'
import { ROUTE_NAME } from '@/constants/routes'
import type { RepairRequestItem, RepairRequestStatus } from '@/types/repair-request'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)

const statusTab = ref<RepairRequestStatus>('in_progress')
const loading = ref(false)
const items = ref<RepairRequestItem[]>([])

const countByStatus = ref<Record<RepairRequestStatus, number>>({ in_progress: 0, completed: 0 })

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
      listRepairRequests(projectId.value, { status: 'in_progress', limit: 1 }),
      listRepairRequests(projectId.value, { status: 'completed', limit: 1 }),
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
    const res = await listRepairRequests(projectId.value, {
      status: statusTab.value,
      limit: 50,
    })
    items.value = res.data
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

function goDetail(row: RepairRequestItem) {
  router.push({
    name: ROUTE_NAME.MOBILE_REPAIR_DETAIL,
    params: { projectId: projectId.value, repairId: row.id },
  })
}

function goAdd() {
  router.push({
    name: ROUTE_NAME.MOBILE_REPAIR_NEW,
    params: { projectId: projectId.value },
  })
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

const DELETE_BUTTON_WIDTH = 72
const SWIPE_COMMIT_THRESHOLD = 32
const CARD_SWIPE_H_RATIO = 1.8
const SNAP_OPEN_RATIO = 0.65

const openedId = ref<string | null>(null)
const dragId = ref<string | null>(null)
const dragStartX = ref(0)
const dragInitialOffset = ref(0)
const dragOffset = ref(0)
const pendingCardId = ref<string | null>(null)
const cardTouchStartX = ref(0)
const cardTouchStartY = ref(0)

function getSlideX(id: string): number {
  if (dragId.value === id) return dragOffset.value
  if (openedId.value === id) return -DELETE_BUTTON_WIDTH
  return 0
}

function onSwipeStart(e: TouchEvent, row: RepairRequestItem) {
  pendingCardId.value = row.id
  cardTouchStartX.value = e.touches[0].clientX
  cardTouchStartY.value = e.touches[0].clientY
}

function onSwipeMove(e: TouchEvent, row: RepairRequestItem) {
  const rid = row.id
  if (dragId.value === rid) {
    const delta = e.touches[0].clientX - dragStartX.value
    const next = Math.max(-DELETE_BUTTON_WIDTH, Math.min(0, dragInitialOffset.value + delta))
    dragOffset.value = next
    return
  }
  if (pendingCardId.value !== rid) return
  const dx = e.touches[0].clientX - cardTouchStartX.value
  const dy = e.touches[0].clientY - cardTouchStartY.value
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  if (absDx > SWIPE_COMMIT_THRESHOLD && absDx > absDy * CARD_SWIPE_H_RATIO) {
    touchUsedForCardSwipe.value = true
    pendingCardId.value = null
    const wasOpen = openedId.value === row.id
    openedId.value = null
    dragId.value = rid
    dragStartX.value = cardTouchStartX.value
    dragInitialOffset.value = wasOpen ? -DELETE_BUTTON_WIDTH : 0
    dragOffset.value = Math.max(-DELETE_BUTTON_WIDTH, Math.min(0, dragInitialOffset.value + dx))
  }
}

function onSwipeEnd(id: string) {
  if (pendingCardId.value === id) pendingCardId.value = null
  if (dragId.value !== id) return
  const snapOpen = dragOffset.value < -DELETE_BUTTON_WIDTH * SNAP_OPEN_RATIO
  openedId.value = snapOpen ? id : null
  dragId.value = null
  setTimeout(() => {
    touchUsedForCardSwipe.value = false
  }, 0)
}

function closeSwipe() {
  openedId.value = null
}

function onCardClick(row: RepairRequestItem) {
  if (openedId.value === row.id) {
    closeSwipe()
    return
  }
  goDetail(row)
}

const deletingId = ref<string | null>(null)
async function confirmDelete(row: RepairRequestItem, e: Event) {
  e.stopPropagation()
  if (deletingId.value) return
  deletingId.value = row.id
  try {
    await deleteRepairRequest(projectId.value, row.id)
    items.value = items.value.filter((i) => i.id !== row.id)
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
      <h2 class="text-lg font-semibold text-foreground">報修</h2>
      <p class="mt-0.5 text-sm text-muted-foreground">進行中與已完成的報修紀錄</p>
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
            <p class="mt-1 text-sm text-muted-foreground">報修紀錄將顯示於此</p>
          </div>

          <ul v-else class="flex flex-col gap-3">
            <li
              v-for="row in items"
              :key="row.id"
              class="swipe-row relative overflow-hidden rounded-xl"
            >
              <div
                class="absolute right-0 top-0 flex h-full w-[72px] items-center justify-center rounded-r-xl bg-destructive"
                aria-hidden
              >
                <button
                  type="button"
                  class="flex h-full w-full items-center justify-center text-white touch-manipulation"
                  :disabled="deletingId === row.id"
                  aria-label="刪除此筆報修"
                  @click="confirmDelete(row, $event)"
                >
                  <Trash2 v-if="deletingId !== row.id" class="size-5" />
                  <Loader2 v-else class="size-5 animate-spin" />
                </button>
              </div>
              <div
                class="card-slide relative z-10 rounded-xl border border-border bg-card p-4 shadow-sm transition-transform duration-200 ease-out"
                :style="{ transform: `translateX(${getSlideX(row.id)}px)` }"
                @touchstart="onSwipeStart($event, row)"
                @touchmove="onSwipeMove($event, row)"
                @touchend="onSwipeEnd(row.id)"
                @click="onCardClick(row)"
              >
                <div class="flex cursor-pointer items-start justify-between gap-2 active:bg-muted/50">
                  <p class="line-clamp-2 flex-1 text-sm font-medium text-foreground">
                    {{ row.repairContent }}
                  </p>
                  <span
                    class="shrink-0 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                  >
                    {{ row.problemCategory }}
                  </span>
                </div>
                <div class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>客戶：{{ row.customerName }}</span>
                  <span v-if="row.unitLabel">戶別：{{ row.unitLabel }}</span>
                  <span v-if="formatDateShort(row.repairDate)">報修日：{{ formatDateShort(row.repairDate) }}</span>
                </div>
              </div>
            </li>
          </ul>
        </TabsContent>
      </div>
    </Tabs>

    <Transition name="fab">
      <button
        v-show="fabVisible"
        type="button"
        class="fab pwa-fixed-bottom"
        aria-label="新增報修"
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

.swipe-row {
  touch-action: pan-y;
}
.card-slide {
  min-height: 4rem;
  touch-action: pan-y;
}
</style>
