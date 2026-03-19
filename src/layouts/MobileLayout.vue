<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ROUTE_NAME, ROUTE_PATH } from '@/constants/routes'
import { useAppPreferenceStore } from '@/stores/appPreference'
import MobileNavTabs from '@/views/mobile/components/MobileNavTabs.vue'
import MobileHeader from '@/views/mobile/components/MobileHeader.vue'

const route = useRoute()
const router = useRouter()
const appPreference = useAppPreferenceStore()

const projectId = computed(() => route.params.projectId as string | undefined)
const canGoBack = computed(() => typeof window !== 'undefined' && window.history.length > 1)

const pageTitle = computed(() => {
  const name = route.name as string | undefined
  if (name === ROUTE_NAME.MOBILE_PROJECT_PICKER) return '選擇專案'
  if (route.path.includes('/inspection')) return '自主檢查'
  if (route.path.includes('/diary')) return '施工日誌'
  if (route.path.includes('/defects')) return '缺失改善'
  if (route.path.includes('/repair')) return '報修'
  return '現場查驗'
})

const showTabs = computed(() => Boolean(projectId.value))

function goBack() {
  router.back()
}

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

    <main class="mobile-main">
      <router-view />
    </main>

    <MobileNavTabs v-if="showTabs && projectId" :project-id="projectId" />
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
}
.mobile-main {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}
</style>
