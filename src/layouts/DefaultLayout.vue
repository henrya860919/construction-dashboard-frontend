<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectRoutePermissionGuard } from '@/composables/useProjectRoutePermissionGuard'
import AppHeader from '@/components/common/AppHeader.vue'
import AppSidebar from '@/components/common/AppSidebar.vue'
import AppBreadcrumb from '@/components/common/AppBreadcrumb.vue'
import AnnouncementModal from '@/components/common/AnnouncementModal.vue'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { PanelLeft, PanelLeftClose } from 'lucide-vue-next'
import { useSidebarStore } from '@/stores/sidebar'
import { useIsMobile, useBreadcrumb } from '@/composables'

const route = useRoute()
const { items: breadcrumbItems } = useBreadcrumb()
const sidebarStore = useSidebarStore()
const isMobile = useIsMobile()

/** /portal 等：不渲染側欄與收合鈕 */
const hideSidebar = computed(() =>
  route.matched.some((r) => r.meta.hideSidebar === true)
)

/** 無側欄且無麵包屑時（如首頁）不渲染頂部列，避免空白邊框列 */
const showMainToolbarRow = computed(
  () => !hideSidebar.value || breadcrumbItems.value.length > 0
)

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
  <div class="flex h-screen flex-col overflow-hidden bg-background">
    <!-- 頂部：全寬 Header（含系統模組列） -->
    <AppHeader :is-mobile="isMobile" :hide-sidebar="hideSidebar" />
    <AnnouncementModal />

    <div class="flex min-h-0 min-w-0 flex-1">
      <!-- 手機：側欄在 Sheet 內（首頁等不顯示側欄時略過） -->
      <Sheet
        v-if="!hideSidebar"
        :open="sidebarStore.mobileOpen"
        @update:open="(v: boolean) => sidebarStore.setMobileOpen(v)"
      >
        <SheetContent side="left" class="w-[210px] p-0">
          <div class="flex h-full flex-col">
            <AppSidebar :collapsed="false" />
          </div>
        </SheetContent>
      </Sheet>

      <!-- 桌面：左側側欄 -->
      <aside
        v-if="!hideSidebar"
        class="hidden overflow-hidden border-r border-border bg-card md:block md:shrink-0 md:transition-[width] md:duration-200 md:ease-in-out"
        :class="
          sidebarStore.collapsed
            ? 'md:pointer-events-none md:w-0 md:min-w-0 md:border-r-0'
            : 'md:w-[210px]'
        "
      >
        <div class="flex h-full w-[210px] min-h-0 flex-col">
          <AppSidebar :collapsed="false" />
        </div>
      </aside>

      <!-- 主內容區：桌面側欄切換與麵包屑同列 + 頁面 -->
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <TooltipProvider v-if="showMainToolbarRow" :delay-duration="0">
          <div
            class="flex shrink-0 items-center gap-2 border-b border-border bg-background px-4 py-2 md:gap-3 md:px-6"
          >
            <div v-if="!hideSidebar" class="hidden shrink-0 md:block">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-9 shrink-0"
                    :aria-expanded="!sidebarStore.collapsed"
                    :aria-label="sidebarStore.collapsed ? '展開側欄' : '收合側欄'"
                    @click="sidebarStore.toggleCollapsed()"
                  >
                    <PanelLeft v-if="sidebarStore.collapsed" class="size-4" />
                    <PanelLeftClose v-else class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {{ sidebarStore.collapsed ? '展開側欄' : '收合側欄' }}
                </TooltipContent>
              </Tooltip>
            </div>
            <div class="min-w-0 flex-1">
              <AppBreadcrumb />
            </div>
          </div>
        </TooltipProvider>
        <main class="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
          <div class="min-w-0">
            <RouterView />
          </div>
        </main>
      </div>
    </div>
  </div>
</template>
