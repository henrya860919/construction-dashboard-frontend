<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  LayoutDashboard,
  LayoutGrid,
  FolderKanban,
  FolderOpen,
  ClipboardCheck,
  Building2,
  Activity,
  AlertTriangle,
  AlertCircle,
  Cpu,
  Image,
  FileText,
  Upload,
  ClipboardList,
  CalendarRange,
  FileSignature,
  CalendarClock,
  Flag,
  ArrowLeft,
  ChevronRight,
  Users,
  Settings,
  ShieldCheck,
  Info,
  LogIn,
  BarChart3,
  Megaphone,
  Server,
  ListTree,
  Library,
  CalendarDays,
  ChartGantt,
  HardHat,
  Wrench,
  BookOpen,
  DraftingCompass,
  type LucideIcon,
} from 'lucide-vue-next'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  LAYER1_ENTRIES,
  LAYER2_ITEMS,
  LAYER3_PROJECT_MGMT,
  LAYER3_CONSTRUCTION,
  LAYER3_REPAIR,
  ADMIN_SIDEBAR_ENTRIES,
  PLATFORM_ADMIN_SIDEBAR_GROUPS,
} from '@/constants/navigation'
import { SIDEBAR_HEADER } from '@/constants/branding'
import { buildProjectPath, ROUTE_PATH } from '@/constants/routes'
import { useProjectStore } from '@/stores/project'
import { useAuthStore } from '@/stores/auth'
import { useTenantBrandingStore } from '@/stores/tenantBranding'
import { useSidebarStore } from '@/stores/sidebar'
import { useTenantLogoUrl } from '@/composables/useTenantLogoUrl'
import { getProject } from '@/api/project'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  LayoutGrid,
  FolderKanban,
  FolderOpen,
  ClipboardCheck,
  Activity,
  AlertTriangle,
  AlertCircle,
  Cpu,
  Image,
  FileText,
  Upload,
  ClipboardList,
  CalendarRange,
  FileSignature,
  CalendarClock,
  Flag,
  ArrowLeft,
  Building2,
  Users,
  Settings,
  ShieldCheck,
  Info,
  LogIn,
  BarChart3,
  Megaphone,
  Server,
  ListTree,
  Library,
  CalendarDays,
  ChartGantt,
  HardHat,
  Wrench,
  BookOpen,
  DraftingCompass,
}

withDefaults(
  defineProps<{
    collapsed?: boolean
  }>(),
  { collapsed: false }
)

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const authStore = useAuthStore()
const tenantBrandingStore = useTenantBrandingStore()
const sidebarStore = useSidebarStore()

/** Sidebar 標題：專案內 = 專案名稱，未進專案 = 公司名稱（無則 Construction Dashboard） */
const sidebarTitle = computed(() => {
  if (isProjectScope.value && projectStore.currentProjectName) {
    return projectStore.currentProjectName
  }
  return tenantBrandingStore.name || 'Construction Dashboard'
})

/** 租戶 Logo：僅在有設定時顯示，無則不顯示任何圖片 */
const hasLogo = computed(() => tenantBrandingStore.hasLogo)
const { objectUrl: tenantLogoUrl } = useTenantLogoUrl(hasLogo)

const showDefaultLogoIcon = computed(() => !tenantLogoUrl.value)

watch(
  () => authStore.isAuthenticated && authStore.user?.tenantId,
  (shouldLoad) => {
    if (!shouldLoad) {
      tenantBrandingStore.clear()
      return
    }
    if (!tenantBrandingStore.loaded) {
      tenantBrandingStore.fetch()
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (authStore.isAuthenticated && authStore.user?.tenantId && !tenantBrandingStore.loaded) {
    tenantBrandingStore.fetch()
  }
})

/** 是否在專案內（URL 為 /p/:projectId/...） */
const projectId = computed(() => route.params.projectId as string | undefined)
const isProjectScope = computed(() => !!projectId.value)

const isPlatformAdminScope = computed(() => route.path.startsWith('/platform-admin'))
const isAdminScope = computed(() => route.path.startsWith('/admin'))

/** Layer 1 條目（未進專案）：專案列表 + 有權限時後台管理 */
const layer1Entries = computed(() => {
  const entries = [...LAYER1_ENTRIES]
  if (authStore.canAccessAdmin && !authStore.isPlatformAdmin) {
    entries.push({
      id: 'admin',
      label: '後台管理',
      path: ROUTE_PATH.ADMIN_PROJECTS,
      icon: 'ShieldCheck',
    })
  }
  return entries
})

watch(
  projectId,
  (id) => {
    projectStore.setCurrentProjectId(id ?? null)
    if (id && !projectStore.projectNameMap[id]) {
      getProject(id).then((project) => {
        if (project?.name) projectStore.setProjectName(id, project.name)
      })
    }
    if (id) {
      sidebarStore.setPanelFromRoute(route.path)
    } else {
      sidebarStore.resetPanel()
    }
  },
  { immediate: true }
)

/** 進入專案內時依 path 同步 panel */
watch(
  () => route.path,
  (path) => {
    if (isProjectScope.value) {
      sidebarStore.setPanelFromRoute(path)
    }
  }
)

function isItemActive(path: string) {
  return route.path === path || (path !== '/' && route.path.startsWith(path))
}

function isPlatformItemActive(path: string) {
  return route.path === path
}

function projectChildPath(pathSuffix: string): string {
  return projectId.value ? buildProjectPath(projectId.value, pathSuffix) : '/projects'
}

function isProjectChildActive(pathSuffix: string): boolean {
  return route.path === projectChildPath(pathSuffix)
}

function goToProjectPath(pathSuffix: string) {
  if (projectId.value) {
    router.push(buildProjectPath(projectId.value, pathSuffix))
  }
}

/** Layer 3 目前列表（與 Layer 2 同結構，僅項目列表） */
const layer3Items = computed(() => {
  const panel = sidebarStore.currentPanel
  if (panel === 'project-mgmt') return LAYER3_PROJECT_MGMT
  if (panel === 'construction') return LAYER3_CONSTRUCTION
  if (panel === 'repair') return LAYER3_REPAIR
  return []
})

/** 各 Layer 3 模組的第一個頁面 pathSuffix，drill 進入時導向該頁 */
function getFirstPathSuffixForPanel(panelId: 'project-mgmt' | 'construction' | 'repair'): string {
  const first = {
    'project-mgmt': LAYER3_PROJECT_MGMT[0]?.pathSuffix ?? '/management/overview',
    construction: LAYER3_CONSTRUCTION[0]?.pathSuffix ?? '/monitoring/history',
    repair: LAYER3_REPAIR[0]?.pathSuffix ?? '/repair/overview',
  }
  return first[panelId]
}

function handleDrillIn(panelId: 'project-mgmt' | 'construction' | 'repair') {
  sidebarStore.drillIn(panelId)
  goToProjectPath(getFirstPathSuffixForPanel(panelId))
}

/** Layer 2 第一個功能頁 pathSuffix，從 Layer 3 返回時導向該頁 */
function getFirstLayer2PathSuffix(): string {
  const first = LAYER2_ITEMS.find((i) => i.type === 'link')
  return first?.type === 'link' ? first.pathSuffix : '/dashboard'
}

function handleDrillOut() {
  sidebarStore.drillOut()
  goToProjectPath(getFirstLayer2PathSuffix())
}
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <ScrollArea class="h-full">
      <header
        class="flex shrink-0 items-center gap-3 border-border bg-muted/30 px-3 py-4"
        :class="collapsed ? 'justify-center px-2' : ''"
      >
        <div
          v-if="tenantLogoUrl"
          class="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white dark:bg-zinc-200 shadow-sm"
          aria-hidden
        >
          <img :src="tenantLogoUrl" alt="" class="size-full object-cover" />
        </div>
        <div
          v-else-if="showDefaultLogoIcon"
          class="flex size-7 shrink-0 items-center justify-center rounded-full bg-white dark:bg-zinc-200 shadow-sm text-muted-foreground"
          aria-hidden
        >
          <Building2 class="size-4" />
        </div>
        <div v-show="!collapsed" class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-foreground">
            {{ sidebarTitle }}
          </p>
          <p v-if="!isProjectScope" class="truncate text-xs text-muted-foreground">
            {{ SIDEBAR_HEADER.tagline }}
          </p>
        </div>
      </header>

      <nav class="relative flex flex-col gap-2 p-2" :class="collapsed ? 'items-center' : ''">
        <!-- 多租後台（平台方）：不變 -->
        <template v-if="isPlatformAdminScope">
          <template v-for="group in PLATFORM_ADMIN_SIDEBAR_GROUPS" :key="group.id">
            <div class="space-y-1">
              <div
                v-show="!collapsed"
                class="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                {{ group.label }}
              </div>
              <div
                v-for="item in group.children"
                :key="item.id"
                class="flex min-h-9 items-center rounded-md"
                :class="collapsed ? 'justify-center' : ''"
              >
                <RouterLink v-slot="{ navigate }" :to="item.path" custom>
                  <Tooltip v-if="collapsed">
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon"
                        :class="
                          cn(
                            'h-9 w-9 shrink-0 justify-center rounded-md',
                            isPlatformItemActive(item.path) && 'bg-accent text-accent-foreground'
                          )
                        "
                        @click="navigate"
                      >
                        <component
                          :is="ICON_MAP[item.icon] ?? LayoutDashboard"
                          class="size-4 shrink-0"
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{{ item.label }}</TooltipContent>
                  </Tooltip>
                  <Button
                    v-else
                    variant="ghost"
                    :class="
                      cn(
                        'h-9 w-full justify-start gap-3 rounded-md px-3',
                        isPlatformItemActive(item.path) && 'bg-accent text-accent-foreground'
                      )
                    "
                    @click="navigate"
                  >
                    <component
                      :is="ICON_MAP[item.icon] ?? LayoutDashboard"
                      class="size-4 shrink-0"
                    />
                    <span class="truncate">{{ item.label }}</span>
                  </Button>
                </RouterLink>
              </div>
            </div>
          </template>
        </template>

        <!-- 單租後台（廠商管理員）：不變 -->
        <template v-else-if="isAdminScope">
          <RouterLink v-slot="{ navigate }" to="/projects" custom>
            <div :class="collapsed ? 'flex justify-center' : 'pl-3'">
              <Tooltip v-if="collapsed">
                <TooltipTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-9 w-9 shrink-0" @click="navigate">
                    <ArrowLeft class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">專案列表</TooltipContent>
              </Tooltip>
              <Button
                v-else
                variant="ghost"
                class="h-9 w-full justify-start gap-3 rounded-md px-3"
                @click="navigate"
              >
                <ArrowLeft class="size-4 shrink-0" />
                <span class="truncate">專案列表</span>
              </Button>
            </div>
          </RouterLink>
          <div
            v-for="item in ADMIN_SIDEBAR_ENTRIES"
            :key="item.id"
            class="flex min-h-9 items-center rounded-md"
            :class="collapsed ? 'justify-center' : 'pl-3'"
          >
            <Tooltip v-if="collapsed">
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  :class="
                    cn(
                      'h-9 w-9 shrink-0 justify-center rounded-md',
                      isItemActive(item.path) && 'bg-accent text-accent-foreground'
                    )
                  "
                  @click="router.push(item.path)"
                >
                  <component :is="ICON_MAP[item.icon] ?? LayoutDashboard" class="size-4 shrink-0" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{{ item.label }}</TooltipContent>
            </Tooltip>
            <Button
              v-else
              variant="ghost"
              :class="
                cn(
                  'h-9 w-full justify-start gap-3 rounded-md px-3',
                  isItemActive(item.path) && 'bg-accent text-accent-foreground'
                )
              "
              @click="router.push(item.path)"
            >
              <component :is="ICON_MAP[item.icon] ?? LayoutDashboard" class="size-4 shrink-0" />
              <span class="truncate">{{ item.label }}</span>
            </Button>
          </div>
        </template>

        <!-- 專案內：翻頁式 Layer 2 / Layer 3 -->
        <template v-else-if="isProjectScope">
          <div class="relative min-h-[200px] w-full overflow-hidden">
            <!-- 滑動容器：兩 panel 並排，依 currentPanel 位移 -->
            <div
              class="flex w-[200%]"
              :style="{
                transform:
                  sidebarStore.currentPanel === 'root' ? 'translateX(0)' : 'translateX(-50%)',
                transition: 'transform 260ms cubic-bezier(0.4, 0, 0.2, 1)',
              }"
            >
              <!-- Panel Layer 2（專案內第一層） -->
              <div class="w-1/2 shrink-0 px-1">
                <RouterLink v-slot="{ navigate }" to="/projects" custom>
                  <div :class="collapsed ? 'flex justify-center' : 'pl-3'">
                    <Tooltip v-if="collapsed">
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon"
                          class="h-9 w-9 shrink-0"
                          @click="navigate"
                        >
                          <ArrowLeft class="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">切換專案</TooltipContent>
                    </Tooltip>
                    <Button
                      v-else
                      variant="ghost"
                      class="h-9 w-full justify-start gap-3 rounded-md px-3"
                      @click="navigate"
                    >
                      <ArrowLeft class="size-4 shrink-0" />
                      <span class="truncate">切換專案</span>
                    </Button>
                  </div>
                </RouterLink>
                <template
                  v-for="(item, idx) in LAYER2_ITEMS"
                  :key="item.type === 'group' ? `group-${idx}` : item.id"
                >
                  <!-- 群組標籤：不可點擊 -->
                  <div
                    v-if="item.type === 'group'"
                    v-show="!collapsed"
                    class="px-3 py-1.5 text-xs font-medium text-muted-foreground cursor-default"
                  >
                    {{ item.label }}
                  </div>
                  <!-- 直接連結 -->
                  <div
                    v-else-if="item.type === 'link'"
                    class="flex min-h-9 items-center rounded-md"
                    :class="collapsed ? 'justify-center' : 'pl-3'"
                  >
                    <Tooltip v-if="collapsed">
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon"
                          :class="
                            cn(
                              'h-9 w-9 shrink-0 justify-center rounded-md',
                              isProjectChildActive(item.pathSuffix) &&
                                'bg-accent text-accent-foreground'
                            )
                          "
                          @click="goToProjectPath(item.pathSuffix)"
                        >
                          <component
                            :is="ICON_MAP[item.icon] ?? LayoutDashboard"
                            class="size-4 shrink-0"
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">{{ item.label }}</TooltipContent>
                    </Tooltip>
                    <Button
                      v-else
                      variant="ghost"
                      :class="
                        cn(
                          'h-9 w-full justify-start gap-3 rounded-md px-3',
                          isProjectChildActive(item.pathSuffix) &&
                            'bg-accent text-accent-foreground'
                        )
                      "
                      @click="goToProjectPath(item.pathSuffix)"
                    >
                      <component
                        :is="ICON_MAP[item.icon] ?? LayoutDashboard"
                        class="size-4 shrink-0"
                      />
                      <span class="truncate">{{ item.label }}</span>
                    </Button>
                  </div>
                  <!-- Drill 進 Layer 3（hover 時按鈕內顯示向右箭頭表示可再進入） -->
                  <div
                    v-else
                    class="group flex min-h-9 items-center rounded-md"
                    :class="collapsed ? 'justify-center' : 'pl-3'"
                  >
                    <Tooltip v-if="collapsed">
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon"
                          class="h-9 w-9 shrink-0 justify-center rounded-md"
                          @click="handleDrillIn(item.panelId)"
                        >
                          <component
                            :is="ICON_MAP[item.icon] ?? LayoutDashboard"
                            class="size-4 shrink-0"
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">{{ item.label }}</TooltipContent>
                    </Tooltip>
                    <Button
                      v-else
                      variant="ghost"
                      class="h-9 w-full justify-start gap-3 rounded-md px-3"
                      @click="handleDrillIn(item.panelId)"
                    >
                      <component
                        :is="ICON_MAP[item.icon] ?? LayoutDashboard"
                        class="size-4 shrink-0"
                      />
                      <span class="min-w-0 truncate">{{ item.label }}</span>
                      <ChevronRight
                        class="ml-auto size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      />
                    </Button>
                  </div>
                </template>
              </div>

              <!-- Panel Layer 3（與 Layer 2 相同 UI：主畫面 + 項目列表） -->
              <div v-if="layer3Items.length" class="w-1/2 shrink-0 px-1">
                <div :class="collapsed ? 'flex justify-center' : 'pl-3'">
                  <Tooltip v-if="collapsed">
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="h-9 w-9 shrink-0"
                        @click="handleDrillOut()"
                      >
                        <ArrowLeft class="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">主畫面</TooltipContent>
                  </Tooltip>
                  <Button
                    v-else
                    variant="ghost"
                    class="h-9 w-full justify-start gap-3 rounded-md px-3"
                    @click="handleDrillOut()"
                  >
                    <ArrowLeft class="size-4 shrink-0" />
                    <span class="truncate">主畫面</span>
                  </Button>
                </div>
                <div
                  v-for="child in layer3Items"
                  :key="child.id"
                  class="flex min-h-9 items-center rounded-md"
                  :class="collapsed ? 'justify-center' : 'pl-3'"
                >
                  <Tooltip v-if="collapsed">
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon"
                        :class="
                          cn(
                            'h-9 w-9 shrink-0 justify-center rounded-md',
                            isProjectChildActive(child.pathSuffix) &&
                              'bg-accent text-accent-foreground'
                          )
                        "
                        @click="goToProjectPath(child.pathSuffix)"
                      >
                        <component
                          :is="ICON_MAP[child.icon] ?? LayoutDashboard"
                          class="size-4 shrink-0"
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{{ child.label }}</TooltipContent>
                  </Tooltip>
                  <Button
                    v-else
                    variant="ghost"
                    :class="
                      cn(
                        'h-9 w-full justify-start gap-3 rounded-md px-3',
                        isProjectChildActive(child.pathSuffix) && 'bg-accent text-accent-foreground'
                      )
                    "
                    @click="goToProjectPath(child.pathSuffix)"
                  >
                    <component
                      :is="ICON_MAP[child.icon] ?? LayoutDashboard"
                      class="size-4 shrink-0"
                    />
                    <span class="truncate">{{ child.label }}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 未進專案（專案列表頁等）：Layer 1 -->
        <template v-else>
          <RouterLink
            v-for="item in layer1Entries"
            :key="item.id"
            v-slot="{ navigate }"
            :to="item.path"
            custom
          >
            <div
              class="flex min-h-9 items-center rounded-md"
              :class="collapsed ? 'justify-center' : ''"
            >
              <Tooltip v-if="collapsed">
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    :class="
                      cn(
                        'h-9 w-9 shrink-0 justify-center rounded-md',
                        isItemActive(item.path) && 'bg-accent text-accent-foreground'
                      )
                    "
                    @click="navigate"
                  >
                    <component
                      :is="ICON_MAP[item.icon] ?? LayoutDashboard"
                      class="size-4 shrink-0"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{{ item.label }}</TooltipContent>
              </Tooltip>
              <Button
                v-else
                variant="ghost"
                :class="
                  cn(
                    'h-9 w-full justify-start gap-3 rounded-md px-3',
                    isItemActive(item.path) && 'bg-accent text-accent-foreground'
                  )
                "
                @click="navigate"
              >
                <component :is="ICON_MAP[item.icon] ?? LayoutDashboard" class="size-4 shrink-0" />
                <span class="truncate">{{ item.label }}</span>
              </Button>
            </div>
          </RouterLink>
        </template>
      </nav>
    </ScrollArea>
  </TooltipProvider>
</template>
