<script setup lang="ts">
import { computed, ref } from 'vue'
import { Menu, User, Bell, Upload, Megaphone } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRoute, useRouter } from 'vue-router'
import { useSidebarStore } from '@/stores/sidebar'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import { useDevice } from '@/composables/useDevice'
import { useAppPreferenceStore } from '@/stores/appPreference'
import { ROUTE_PATH } from '@/constants/routes'
import { useUploadQueueStore } from '@/stores/uploadQueue'
import { useAuth } from '@/composables/useAuth'
import UploadQueuePanel from '@/components/common/UploadQueuePanel.vue'
import AnnouncementPanel from '@/components/common/AnnouncementPanel.vue'
import PersonalSettingsModal from '@/components/common/PersonalSettingsModal.vue'
import { useAnnouncementStore } from '@/stores/announcements'

const route = useRoute()
const router = useRouter()
const personalSettingsOpen = ref(false)
const sidebarStore = useSidebarStore()
const { isMobileApp } = useDevice()
const appPreference = useAppPreferenceStore()
const projectStore = useProjectStore()
const authStore = useAuthStore()
const uploadQueueStore = useUploadQueueStore()
const announcementStore = useAnnouncementStore()
const { logout } = useAuth()

const props = withDefaults(
  defineProps<{ isMobile?: boolean }>(),
  { isMobile: false },
)

/** 是否在專案內（URL 為 /p/:projectId/...） */
const isProjectScope = computed(() => !!route.params.projectId)

/** Header 標題：專案內顯示專案名稱，否則顯示預設標題 */
const headerTitle = computed(() =>
  isProjectScope.value && projectStore.currentProjectName
    ? projectStore.currentProjectName
    : 'Construction Dashboard'
)

/** 通知數量（佔位，之後接 API） */
const notificationCount = 3

function handleMenuClick() {
  if (props.isMobile) {
    sidebarStore.toggleMobileOpen()
  } else {
    sidebarStore.toggleCollapsed()
  }
}

function switchToMobile() {
  appPreference.setPreferDesktopOnMobile(false)
  router.push(ROUTE_PATH.MOBILE)
}
</script>

<template>
  <header class="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background px-4">
    <Button
      variant="ghost"
      size="icon"
      class="shrink-0 md:size-9"
      aria-label="切換選單"
      @click="handleMenuClick"
    >
      <Menu class="size-5" />
    </Button>
    <div class="flex min-w-0 flex-1 items-center gap-2">
      <span class="truncate font-semibold text-foreground">{{ headerTitle }}</span>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <Button variant="ghost" size="icon" class="relative" aria-label="通知">
        <Bell class="size-5" />
        <Badge
          v-if="notificationCount > 0"
          class="absolute -right-1 -top-1 size-4 rounded-full p-0 text-[10px]"
        >
          {{ notificationCount }}
        </Badge>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="relative"
            aria-label="平台公告"
          >
            <Megaphone class="size-5" />
            <Badge
              v-if="announcementStore.unreadCount > 0"
              class="absolute -right-1 -top-1 size-4 min-w-4 rounded-full px-1 p-0 text-[10px]"
            >
              {{ announcementStore.unreadCount }}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-auto p-0" :side-offset="6">
          <AnnouncementPanel />
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="relative"
            aria-label="檔案上傳進度"
          >
            <Upload class="size-5" />
            <Badge
              v-if="uploadQueueStore.badgeCount > 0"
              class="absolute -right-1 -top-1 size-4 min-w-4 rounded-full px-1 p-0 text-[10px]"
            >
              {{ uploadQueueStore.badgeCount }}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="p-0" :side-offset="6">
          <UploadQueuePanel />
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" aria-label="使用者選單">
            <User class="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48">
          <DropdownMenuLabel>{{ authStore.user?.name || authStore.user?.email }}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            v-if="isMobileApp && appPreference.preferDesktopOnMobile"
            class="cursor-pointer"
            @click="switchToMobile"
          >
            切回手機版
          </DropdownMenuItem>
          <DropdownMenuItem class="cursor-pointer" @click="personalSettingsOpen = true">
            個人設定
          </DropdownMenuItem>
          <DropdownMenuItem @click="logout">登出</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PersonalSettingsModal v-model:open="personalSettingsOpen" />
    </div>
  </header>
</template>
