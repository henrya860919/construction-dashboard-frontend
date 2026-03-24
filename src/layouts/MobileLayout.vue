<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ROUTE_NAME, ROUTE_PATH } from '@/constants/routes'
import { useAppPreferenceStore } from '@/stores/appPreference'
import { useMobileSelfInspectionNavStore } from '@/stores/mobileSelfInspectionNav'
import MobileNavTabs from '@/views/mobile/components/MobileNavTabs.vue'
import MobileHeader from '@/views/mobile/components/MobileHeader.vue'

const route = useRoute()
const router = useRouter()
const appPreference = useAppPreferenceStore()
const mobileSelfInspectionNav = useMobileSelfInspectionNavStore()
const mainRef = ref<HTMLElement | null>(null)

function goBack() {
  router.back()
}

/** 鍵盤收起後延遲，等動畫結束再做平滑還原 */
const BLUR_SCROLL_DELAY_MS = 380

/** 平滑捲回頂部，修正鍵盤收起後 viewport 卡住（大、小偏移都適用） */
function resetScrollAfterKeyboard() {
  const smooth = { behavior: 'smooth' as ScrollBehavior }
  window.scrollTo({ top: 0, left: 0, ...smooth })
  document.documentElement.scrollTo({ top: 0, left: 0, ...smooth })
  document.body.scrollTo({ top: 0, left: 0, ...smooth })
  const layer = mainRef.value?.querySelector('.mobile-page-layer') as HTMLElement | null
  if (layer) layer.scrollTo({ top: 0, left: 0, ...smooth })
}

function runResetAfterDelay() {
  window.setTimeout(() => {
    const active = document.activeElement as HTMLElement | null
    if (active?.blur) active.blur()
    resetScrollAfterKeyboard()
  }, BLUR_SCROLL_DELAY_MS)
}

function onFocusOut(e: FocusEvent) {
  const target = e.target as Node
  if (!target) return
  const tag = (target as Element).tagName?.toLowerCase()
  if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return
  runResetAfterDelay()
}

/** 上次記錄的 visual viewport 高度，用於判斷是否為「鍵盤收起」 */
let lastViewportHeight = 0

/** Visual Viewport 變大時（鍵盤收起）也重置，大、小偏移都觸發 */
function onViewportResize() {
  const vv = window.visualViewport
  if (!vv) return
  const h = vv.height
  const maxH = Math.min(window.innerHeight, window.screen.height)
  const minHeightThreshold = maxH * 0.45
  // 視窗高度「有變大」且已超過最低門檻就視為鍵盤收起（涵蓋小偏移）
  const grew = lastViewportHeight > 0 && h > lastViewportHeight
  const inRange = h >= minHeightThreshold
  if (grew && inRange) {
    runResetAfterDelay()
  }
  lastViewportHeight = h
}

onMounted(() => {
  lastViewportHeight = window.visualViewport?.height ?? window.innerHeight
  mainRef.value?.addEventListener('focusout', onFocusOut, true)
  window.visualViewport?.addEventListener('resize', onViewportResize)
})
onUnmounted(() => {
  mainRef.value?.removeEventListener('focusout', onFocusOut, true)
  window.visualViewport?.removeEventListener('resize', onViewportResize)
})

/** 從 params 或 path 取得 projectId，避免返回根頁時 params 未同步導致 tab bar 消失 */
const projectId = computed(() => {
  const fromParams = route.params.projectId as string | undefined
  if (fromParams) return fromParams
  const m = route.path.match(/\/p\/([^/]+)/)
  return m ? m[1] : undefined
})

/** 僅在「子頁」顯示返回鈕；根目錄（專案選擇、各 Tab 首頁如缺失列表）不顯示 */
const ROOT_ROUTE_NAMES = [
  ROUTE_NAME.MOBILE_PROJECT_PICKER,
  ROUTE_NAME.MOBILE_INSPECTION,
  ROUTE_NAME.MOBILE_DEFECTS,
  ROUTE_NAME.MOBILE_REPAIR,
  ROUTE_NAME.MOBILE_DIARY,
] as const
const canGoBack = computed(() => {
  const name = route.name as string
  return !ROOT_ROUTE_NAMES.includes(name as (typeof ROOT_ROUTE_NAMES)[number])
})

const pageTitle = computed(() => {
  const name = route.name as string | undefined
  if (name === ROUTE_NAME.MOBILE_PROJECT_PICKER) return '選擇專案'
  if (route.path.includes('/inspection')) {
    if (route.name === ROUTE_NAME.MOBILE_INSPECTION_RECORD_NEW) return '新增查驗紀錄'
    if (route.name === ROUTE_NAME.MOBILE_INSPECTION_RECORD_DETAIL) return '查驗紀錄'
    if (route.name === ROUTE_NAME.MOBILE_INSPECTION_TEMPLATE) {
      return mobileSelfInspectionNav.templateTitle || '查驗紀錄'
    }
    return '自主檢查'
  }
  if (route.path.includes('/diary')) return '施工日誌'
  if (route.path.includes('/defects')) {
    if (route.name === ROUTE_NAME.MOBILE_DEFECT_RECORD_NEW) return '新增執行紀錄'
    if (route.name === ROUTE_NAME.MOBILE_DEFECT_RECORD_DETAIL) return '執行紀錄'
    if (route.name === ROUTE_NAME.MOBILE_DEFECT_NEW) return '新增缺失'
    if (route.name === ROUTE_NAME.MOBILE_DEFECT_EDIT) return '編輯缺失'
    if (route.params.defectId) return '缺失詳情'
    return '缺失改善'
  }
  if (route.path.includes('/repair')) {
    if (route.name === ROUTE_NAME.MOBILE_REPAIR_RECORD_NEW) return '新增報修紀錄'
    if (route.name === ROUTE_NAME.MOBILE_REPAIR_RECORD_DETAIL) return '報修紀錄'
    if (route.name === ROUTE_NAME.MOBILE_REPAIR_NEW) return '新增報修'
    if (route.name === ROUTE_NAME.MOBILE_REPAIR_EDIT) return '編輯報修'
    if (route.params.repairId) return '報修詳情'
    return '報修'
  }
  if (name === ROUTE_NAME.MOBILE_PHOTO_VIEWER) return '查看照片'
  return '現場查驗'
})

const showTabs = computed(() => Boolean(projectId.value))

function openMenu() {
  // 切換專案：回專案選擇
  router.push(ROUTE_PATH.MOBILE)
}

function switchToDesktop() {
  appPreference.setPreferDesktopOnMobile(true)
  router.push(ROUTE_PATH.PROJECTS)
}
</script>

<template>
  <div class="mobile-layout">
    <MobileHeader
      :title="pageTitle"
      :can-go-back="canGoBack"
      :project-id="projectId"
      @back="goBack"
      @menu="openMenu"
      @switch-to-desktop="switchToDesktop"
    />

    <main ref="mainRef" class="mobile-main">
      <div class="mobile-view-wrap">
        <router-view v-slot="{ Component }">
          <div v-if="Component" :key="route.fullPath" class="mobile-page-layer scrollbar-hide">
            <component :is="Component" />
          </div>
        </router-view>
      </div>
    </main>

    <MobileNavTabs v-if="showTabs && projectId" :project-id="projectId" class="pwa-fixed-bottom" />
  </div>
</template>

<style scoped>
.mobile-layout {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  height: 100vh;
  max-height: 100dvh;
  max-height: 100vh;
  overflow: hidden;
  background: var(--background);
  -webkit-user-select: none;
  user-select: none;
}
.mobile-layout :deep(input),
.mobile-layout :deep(textarea),
.mobile-layout :deep([contenteditable="true"]) {
  -webkit-user-select: text;
  user-select: text;
}
.mobile-main {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  overflow-x: hidden;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}

.mobile-view-wrap {
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.mobile-page-layer {
  position: absolute;
  inset: 0;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  background: var(--background);
}
</style>
