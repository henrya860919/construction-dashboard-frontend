<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ClipboardList, Loader2, Plus } from 'lucide-vue-next'
import {
  listProjectSelfInspectionRecords,
  getProjectSelfInspectionTemplateHub,
} from '@/api/project-self-inspections'
import type { SelfInspectionRecordItem } from '@/api/project-self-inspections'
import { ROUTE_NAME } from '@/constants/routes'
import { useMobileSelfInspectionNavStore } from '@/stores/mobileSelfInspectionNav'

defineOptions({ name: 'MobileSelfInspectionTemplateView' })

const route = useRoute()
const router = useRouter()
const navStore = useMobileSelfInspectionNavStore()

const projectId = computed(() => route.params.projectId as string)
const templateId = computed(() => route.params.templateId as string)

const loading = ref(true)
const loadingMore = ref(false)
const loadError = ref('')
const records = ref<SelfInspectionRecordItem[]>([])
const page = ref(1)
const total = ref(0)
const limit = 30
const hubLoading = ref(true)
const isArchived = ref(false)

const hasMore = computed(() => records.value.length < total.value)

const fabVisible = ref(true)
const lastScrollTop = ref(0)
const SCROLL_THRESHOLD = 12

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  const st = el.scrollTop
  const delta = st - lastScrollTop.value
  if (delta > SCROLL_THRESHOLD) fabVisible.value = false
  else if (delta < -SCROLL_THRESHOLD) fabVisible.value = true
  lastScrollTop.value = st
}

async function loadHub() {
  hubLoading.value = true
  try {
    const hub = await getProjectSelfInspectionTemplateHub(projectId.value, templateId.value)
    isArchived.value = hub.template.status === 'archived'
    navStore.setTemplateTitle(hub.template.name)
  } catch {
    navStore.setTemplateTitle(null)
  } finally {
    hubLoading.value = false
  }
}

async function fetchRecords(reset: boolean) {
  if (!projectId.value || !templateId.value) return
  if (reset) {
    page.value = 1
    records.value = []
  }
  loading.value = true
  loadError.value = ''
  try {
    const { data, meta } = await listProjectSelfInspectionRecords(
      projectId.value,
      templateId.value,
      { page: page.value, limit }
    )
    if (reset) records.value = data
    else records.value = [...records.value, ...data]
    total.value = meta.total
  } catch {
    loadError.value = '無法載入紀錄'
    if (reset) records.value = []
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value || loading.value) return
  page.value += 1
  loadingMore.value = true
  try {
    const { data, meta } = await listProjectSelfInspectionRecords(
      projectId.value,
      templateId.value,
      { page: page.value, limit }
    )
    records.value = [...records.value, ...data]
    total.value = meta.total
  } catch {
    page.value -= 1
  } finally {
    loadingMore.value = false
  }
}

watch(
  [projectId, templateId],
  async () => {
    if (!projectId.value || !templateId.value) return
    await loadHub()
    await fetchRecords(true)
  },
  { immediate: true }
)

onUnmounted(() => {
  navStore.setTemplateTitle(null)
})

function recordSummary(row: SelfInspectionRecordItem): string {
  const name = row.filledPayload?.header?.inspectionName?.trim()
  if (name) return name
  return '查驗紀錄'
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function goRecord(row: SelfInspectionRecordItem) {
  router.push({
    name: ROUTE_NAME.MOBILE_INSPECTION_RECORD_DETAIL,
    params: {
      projectId: projectId.value,
      templateId: templateId.value,
      recordId: row.id,
    },
  })
}

function goNew() {
  if (isArchived.value) return
  router.push({
    name: ROUTE_NAME.MOBILE_INSPECTION_RECORD_NEW,
    params: { projectId: projectId.value, templateId: templateId.value },
  })
}
</script>

<template>
  <div class="mobile-page flex h-full min-h-0 flex-col">
    <div class="shrink-0 px-4 pt-4 pb-2">
      <p class="text-xs text-muted-foreground">點一筆可檢視內容；右下角新增查驗</p>
    </div>

    <div
      v-if="!hubLoading && isArchived"
      class="mx-4 mb-2 shrink-0 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
    >
      此樣板已封存，僅可檢視歷史紀錄，無法新增。
    </div>

    <div
      class="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-2"
      @scroll="onScroll"
    >
      <div v-if="loadError" class="rounded-xl border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
        {{ loadError }}
      </div>

      <div
        v-else-if="!loading && records.length === 0"
        class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center"
      >
        <ClipboardList class="mb-3 size-12 text-muted-foreground" aria-hidden />
        <p class="text-sm font-medium text-foreground">尚無查驗紀錄</p>
        <p v-if="!isArchived" class="mt-1 text-sm text-muted-foreground">點右下角 + 開始填寫</p>
      </div>

      <ul v-else class="flex flex-col gap-3">
        <li v-for="row in records" :key="row.id">
          <button
            type="button"
            class="mobile-card-touch flex w-full flex-col gap-1 rounded-xl border border-border bg-card p-4 text-left active:bg-muted/50"
            @click="goRecord(row)"
          >
            <span class="text-base font-medium text-foreground">{{ recordSummary(row) }}</span>
            <span class="text-xs text-muted-foreground">{{ formatWhen(row.createdAt) }}</span>
          </button>
        </li>
      </ul>

      <div v-if="loading && records.length === 0" class="flex flex-col items-center py-12">
        <Loader2 class="size-8 animate-spin text-muted-foreground" aria-hidden />
        <p class="mt-2 text-sm text-muted-foreground">載入中…</p>
      </div>

      <div v-if="hasMore && records.length > 0" class="mt-4 flex justify-center pb-4">
        <button
          type="button"
          class="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground touch-manipulation active:bg-muted/60"
          :disabled="loadingMore"
          @click="loadMore"
        >
          <span v-if="loadingMore" class="inline-flex items-center gap-2">
            <Loader2 class="size-4 animate-spin" aria-hidden />
            載入中…
          </span>
          <span v-else>載入更多</span>
        </button>
      </div>
    </div>

    <Transition name="fab">
      <button
        v-show="fabVisible && !isArchived && !hubLoading"
        type="button"
        class="fab pwa-fixed-bottom"
        aria-label="新增查驗紀錄"
        @click="goNew"
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
</style>
