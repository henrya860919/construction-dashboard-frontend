<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import {
  Menu,
  User,
  Bell,
  Upload,
  Megaphone,
  Building2,
  House,
  HardHat,
  Package,
  Gavel,
  Handshake,
  ClipboardList,
  Users,
  Wallet,
  ChevronDown,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useSidebarStore } from '@/stores/sidebar'
import { useAuthStore } from '@/stores/auth'
import { useDevice } from '@/composables/useDevice'
import { useAppPreferenceStore } from '@/stores/appPreference'
import { ROUTE_PATH } from '@/constants/routes'
import { SYSTEM_MODULES, type SystemModule } from '@/constants/modules'
import { useSystemModuleHeaderStore } from '@/stores/systemModuleHeader'
import { useUploadQueueStore } from '@/stores/uploadQueue'
import { useAuth } from '@/composables/useAuth'
import UploadQueuePanel from '@/components/common/UploadQueuePanel.vue'
import AnnouncementPanel from '@/components/common/AnnouncementPanel.vue'
import PersonalSettingsModal from '@/components/common/PersonalSettingsModal.vue'
import { useAnnouncementStore } from '@/stores/announcements'
import { useTenantBrandingStore } from '@/stores/tenantBranding'
import { useTenantLogoUrl } from '@/composables/useTenantLogoUrl'

const MODULE_ICONS: Record<SystemModule['icon'], LucideIcon> = {
  HardHat,
  Package,
  Gavel,
  Handshake,
  ClipboardList,
  Users,
  Wallet,
}

const route = useRoute()
const router = useRouter()
const personalSettingsOpen = ref(false)
const sidebarStore = useSidebarStore()
const { isMobileApp } = useDevice()
const appPreference = useAppPreferenceStore()
const authStore = useAuthStore()
const systemModuleHeaderStore = useSystemModuleHeaderStore()
const { visibleSystemModules } = storeToRefs(systemModuleHeaderStore)
const uploadQueueStore = useUploadQueueStore()
const announcementStore = useAnnouncementStore()
const tenantBrandingStore = useTenantBrandingStore()
const { logout } = useAuth()

const hasTenantLogo = computed(() => tenantBrandingStore.hasLogo)
const { objectUrl: tenantLogoUrl } = useTenantLogoUrl(hasTenantLogo)
const showHeaderLogoPlaceholder = computed(() => !tenantLogoUrl.value)

watch(
  () => authStore.isAuthenticated && authStore.user?.tenantId,
  (shouldLoad) => {
    if (!shouldLoad) {
      tenantBrandingStore.clear()
      return
    }
    if (!tenantBrandingStore.loaded) {
      void tenantBrandingStore.fetch()
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (authStore.isAuthenticated && authStore.user?.tenantId && !tenantBrandingStore.loaded) {
    void tenantBrandingStore.fetch()
  }
})

withDefaults(
  defineProps<{ isMobile?: boolean; hideSidebar?: boolean }>(),
  { isMobile: false, hideSidebar: false }
)

/** 主標：一律為租戶（公司）名稱，不隨專案或路由切換 */
const headerPrimaryTitle = computed(
  () => tenantBrandingStore.name || 'Construction Dashboard'
)

/** 通知數量（佔位，之後接 API） */
const notificationCount = 3

function handleMobileMenuClick() {
  sidebarStore.toggleMobileOpen()
}

function switchToMobile() {
  appPreference.setPreferDesktopOnMobile(false)
  router.push(ROUTE_PATH.MOBILE)
}

function isSystemModuleActive(mod: SystemModule): boolean {
  const path = route.path
  if (mod.key === 'engineering') {
    /** /portal 由「首頁」按鈕表現 active，工程管理僅在專案／列表／自訂功能時為作用中 */
    return (
      path === ROUTE_PATH.PROJECTS ||
      path.startsWith('/p/') ||
      path.startsWith(`${ROUTE_PATH.FEATURES}/`)
    )
  }
  if (mod.key === 'procurement') return path.startsWith(ROUTE_PATH.PROCUREMENT)
  if (mod.key === 'bidding') return path.startsWith(ROUTE_PATH.BIDDING)
  if (mod.key === 'customer') return path.startsWith(ROUTE_PATH.CUSTOMER)
  if (mod.key === 'works') return path.startsWith(ROUTE_PATH.WORKS)
  if (mod.key === 'hr') return path.startsWith(ROUTE_PATH.HR)
  if (mod.key === 'finance') return path.startsWith(ROUTE_PATH.FINANCE)
  return false
}

function enterSystemModule(mod: SystemModule) {
  if (!mod.available) return
  router.push(mod.path)
}

function moduleNavIconClass(mod: SystemModule): string {
  if (!mod.available) return 'size-4 shrink-0 text-muted-foreground/60'
  const active = isSystemModuleActive(mod)
  return cn(
    'size-4 shrink-0 transition-colors',
    active ? 'text-accent-foreground' : 'text-muted-foreground group-hover:text-foreground'
  )
}

const isPortalRoute = computed(() => route.path === ROUTE_PATH.PORTAL)

/** 小螢幕選單觸發器：/portal 顯示首頁；否則顯示目前作用中模組（僅計入 Header 可見者） */
const activeSystemModule = computed(
  () => visibleSystemModules.value.find((m) => isSystemModuleActive(m)) ?? null
)

/** 手機版觸發列圖示／後備：可見清單為空時退回工程管理常數 */
const mobileTriggerModule = computed(
  () => activeSystemModule.value ?? visibleSystemModules.value[0] ?? SYSTEM_MODULES[0]
)

const mobileModuleTriggerLabel = computed(() => {
  if (isPortalRoute.value) return '首頁'
  return mobileTriggerModule.value.name
})

/** 租戶管理員：單租後台入口（置於使用者選單，非平台管理員） */
const showTenantAdminInUserMenu = computed(
  () => authStore.canAccessAdmin && !authStore.isPlatformAdmin
)

function goToTenantAdmin() {
  router.push(ROUTE_PATH.ADMIN_PROJECTS)
}
</script>

<template>
  <TooltipProvider :delay-duration="300">
  <header class="sticky top-0 z-40 shrink-0 border-b border-border bg-background shadow-sm">
    <!-- 左／右等寬 1fr，中欄 auto 置中：標題與模組同一列 -->
    <div
      class="grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 md:gap-3 md:px-4"
    >
      <div class="flex min-w-0 items-center gap-2 md:gap-3">
        <!-- 手機：開啟側欄 Sheet（桌面改由側欄上的收合鈕） -->
        <Button
          v-if="isMobile && !hideSidebar"
          variant="ghost"
          size="icon"
          class="shrink-0 md:size-9"
          aria-label="開啟選單"
          @click="handleMobileMenuClick"
        >
          <Menu class="size-5" />
        </Button>
        <div
          v-if="tenantLogoUrl"
          class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm dark:bg-zinc-200 md:size-9"
          aria-hidden
        >
          <img :src="tenantLogoUrl" alt="" class="size-full object-cover" />
        </div>
        <div
          v-else-if="showHeaderLogoPlaceholder"
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-muted-foreground shadow-sm dark:bg-zinc-200 md:size-9"
          aria-hidden
        >
          <Building2 class="size-4 md:size-[1.125rem]" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold leading-tight text-foreground md:text-base">
            {{ headerPrimaryTitle }}
          </p>
        </div>
        <RouterLink v-slot="{ navigate, isActive }" :to="ROUTE_PATH.PORTAL" custom>
          <Button
            variant="ghost"
            size="sm"
            class="shrink-0 gap-1.5 px-2"
            :class="isActive && 'bg-accent text-accent-foreground'"
            aria-label="首頁"
            @click="navigate"
          >
            <House class="size-4 shrink-0" aria-hidden="true" />
            <span class="hidden sm:inline">首頁</span>
          </Button>
        </RouterLink>
      </div>

      <!-- 小螢幕：系統模組改為下拉選單 -->
      <div class="flex min-w-0 justify-center md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="h-9 max-w-[11rem] gap-1.5 border-border px-2 font-medium shadow-none"
              aria-label="選擇系統模組"
              aria-haspopup="menu"
            >
              <House
                v-if="isPortalRoute"
                class="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <component
                v-else
                :is="MODULE_ICONS[mobileTriggerModule.icon]"
                :class="
                  cn(
                    'size-4 shrink-0',
                    mobileTriggerModule.available
                      ? 'text-foreground'
                      : 'text-muted-foreground/60'
                  )
                "
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1 truncate text-left">{{ mobileModuleTriggerLabel }}</span>
              <ChevronDown class="size-4 shrink-0 opacity-60" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" class="w-56" :side-offset="6">
            <DropdownMenuLabel>系統模組</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <template v-for="mod in visibleSystemModules" :key="mod.key">
              <DropdownMenuItem
                v-if="mod.available"
                :class="
                  cn(
                    'cursor-pointer gap-2',
                    isSystemModuleActive(mod) &&
                      'bg-accent text-accent-foreground focus:bg-accent focus:text-accent-foreground'
                  )
                "
                @click="enterSystemModule(mod)"
              >
                <component
                  :is="MODULE_ICONS[mod.icon]"
                  :class="moduleNavIconClass(mod)"
                  aria-hidden="true"
                />
                <span class="flex-1">{{ mod.name }}</span>
              </DropdownMenuItem>
              <Tooltip v-else>
                <TooltipTrigger as-child>
                  <DropdownMenuItem
                    class="cursor-default gap-2 text-muted-foreground opacity-80"
                    @select.prevent
                    @click.prevent
                  >
                    <component
                      :is="MODULE_ICONS[mod.icon]"
                      :class="moduleNavIconClass(mod)"
                      aria-hidden="true"
                    />
                    <span class="flex-1">{{ mod.name }}</span>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="left">即將推出</TooltipContent>
              </Tooltip>
            </template>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <!-- md 以上：維持橫向模組按鈕 -->
      <nav
        class="hidden max-w-[min(100vw-12rem,56rem)] items-center justify-center gap-1 overflow-x-auto px-0.5 [scrollbar-width:thin] md:flex"
        role="navigation"
        aria-label="系統模組"
      >
        <template v-for="mod in visibleSystemModules" :key="mod.key">
          <Button
            v-if="mod.available"
            type="button"
            variant="ghost"
            size="sm"
            :class="
              cn(
                'group h-9 shrink-0 gap-1.5 px-2.5 font-medium',
                isSystemModuleActive(mod)
                  ? 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )
            "
            @click="enterSystemModule(mod)"
          >
            <component
              :is="MODULE_ICONS[mod.icon]"
              :class="moduleNavIconClass(mod)"
              aria-hidden="true"
            />
            <span class="whitespace-nowrap">{{ mod.name }}</span>
          </Button>
          <Tooltip v-else>
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="h-9 shrink-0 cursor-default gap-1.5 px-2.5 font-medium text-muted-foreground opacity-70 hover:bg-transparent hover:text-muted-foreground"
                :aria-label="`${mod.name}（即將推出）`"
                @click.prevent
              >
                <component
                  :is="MODULE_ICONS[mod.icon]"
                  :class="moduleNavIconClass(mod)"
                  aria-hidden="true"
                />
                <span class="whitespace-nowrap">{{ mod.name }}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>即將推出</TooltipContent>
          </Tooltip>
        </template>
      </nav>

      <div class="flex min-w-0 items-center justify-end gap-1 md:gap-2">
        <Button variant="ghost" size="icon" class="relative shrink-0 md:size-9" aria-label="通知">
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
            <Button variant="ghost" size="icon" class="relative shrink-0 md:size-9" aria-label="平台公告">
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
              class="relative shrink-0 md:size-9"
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
            <Button variant="ghost" size="icon" class="shrink-0 md:size-9" aria-label="使用者選單">
              <User class="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-48">
            <DropdownMenuLabel>{{ authStore.user?.name || authStore.user?.email }}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              v-if="showTenantAdminInUserMenu"
              class="cursor-pointer gap-2"
              @click="goToTenantAdmin"
            >
              <ShieldCheck class="size-4 shrink-0" aria-hidden="true" />
              後台管理
            </DropdownMenuItem>
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
            <DropdownMenuSeparator />
            <DropdownMenuItem class="cursor-pointer" @click="logout">登出</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <PersonalSettingsModal v-model:open="personalSettingsOpen" />
      </div>
    </div>
  </header>
  </TooltipProvider>
</template>
