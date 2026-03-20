<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectRoutePermissionGuard } from '@/composables/useProjectRoutePermissionGuard'
import AppHeader from '@/components/common/AppHeader.vue'
import AppSidebar from '@/components/common/AppSidebar.vue'
import AppBreadcrumb from '@/components/common/AppBreadcrumb.vue'
import AnnouncementModal from '@/components/common/AnnouncementModal.vue'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useSidebarStore } from '@/stores/sidebar'
import { useIsMobile } from '@/composables'

const route = useRoute()
const sidebarStore = useSidebarStore()
const isMobile = useIsMobile()

useProjectRoutePermissionGuard()

watch(
  () => route.path,
  () => {
    if (isMobile.value) {
      sidebarStore.setMobileOpen(false)
    }
  }
)
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <!-- 手機：側欄在 Sheet 內 -->
    <Sheet
      :open="sidebarStore.mobileOpen"
      @update:open="(v: boolean) => sidebarStore.setMobileOpen(v)"
    >
      <SheetContent side="left" class="w-[210px] p-0">
        <div class="flex h-full flex-col pt-6">
          <AppSidebar :collapsed="false" />
        </div>
      </SheetContent>
    </Sheet>

    <!-- 桌面：左側固定側欄 -->
    <aside
      class="hidden border-r border-border bg-card md:block md:shrink-0 md:transition-[width]"
      :class="sidebarStore.collapsed ? 'md:w-14' : 'md:w-[210px]'"
    >
      <div class="flex h-full w-full flex-col">
        <AppSidebar :collapsed="sidebarStore.collapsed" />
      </div>
    </aside>

    <!-- 主內容區 -->
    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      <AppHeader :is-mobile="isMobile" />
      <AnnouncementModal />
      <div class="border-b border-border bg-background px-4 py-2 md:px-6">
        <AppBreadcrumb />
      </div>
      <main class="flex-1 overflow-auto p-4 md:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
