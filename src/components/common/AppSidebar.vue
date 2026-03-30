<script setup lang="ts">
import { computed, watch } from 'vue'
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
  FileSpreadsheet,
  Calculator,
  TrendingUp,
  Layers,
  Briefcase,
  UserCircle,
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
  ADMIN_SIDEBAR_GROUPS,
  HR_SIDEBAR_GROUPS,
  PLATFORM_ADMIN_SIDEBAR_GROUPS,
} from '@/constants/navigation'
import { buildProjectPath, ROUTE_PATH } from '@/constants/routes'
import { useProjectStore } from '@/stores/project'
import { useAuthStore } from '@/stores/auth'
import { useProjectPermissionsStore } from '@/stores/projectPermissions'
import { useProjectPermission } from '@/composables/useProjectPermission'
import { useSidebarStore } from '@/stores/sidebar'
import { getProject } from '@/api/project'
import { cn } from '@/lib/utils'
import { useFeatureDefinitionsStore } from '@/stores/featureDefinitions'
import type { Layer3ConstructionEntry, NavItemProject } from '@/types/navigation'

type Layer3ListEntry =
  | { kind: 'group'; label: string }
  | { kind: 'link'; item: NavItemProject }

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
  FileSpreadsheet,
  Calculator,
  TrendingUp,
  Layers,
  Briefcase,
  UserCircle,
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
const permStore = useProjectPermissionsStore()
const sidebarStore = useSidebarStore()
const featureDefinitionsStore = useFeatureDefinitionsStore()

/** 是否在專案內（URL 為 /p/:projectId/...） */
const projectId = computed(() => route.params.projectId as string | undefined)
const isProjectScope = computed(() => !!projectId.value)

const { canReadPath } = useProjectPermission(projectId)

watch(
  () =>
    [projectId.value, authStore.isAuthenticated, authStore.user?.systemRole] as const,
  ([id, authed, role]) => {
    if (!id || !authed) return
    if (role === 'platform_admin') return
    void permStore.ensureLoaded(id)
  },
  { immediate: true }
)

watch(
  () =>
    [projectId.value, authStore.user?.tenantId, authStore.user?.systemRole] as const,
  ([id, tenantId, role]) => {
    if (!id || !tenantId || role === 'platform_admin') return
    void featureDefinitionsStore.loadModule('engineering')
  },
  { immediate: true }
)

function isProjectNavPathVisible(pathSuffix: string): boolean {
  if (!projectId.value || !authStore.isAuthenticated) return true
  if (authStore.isPlatformAdmin) return true
  return canReadPath(pathSuffix)
}

function isLayer3ConstructionGroup(
  e: Layer3ConstructionEntry
): e is { type: 'group'; label: string } {
  return 'type' in e && e.type === 'group'
}

const drillPanelHasVisibleItems = computed(() => ({
  'project-mgmt': LAYER3_PROJECT_MGMT.some((c) => isProjectNavPathVisible(c.pathSuffix)),
  construction: LAYER3_CONSTRUCTION.some(
    (c) => !isLayer3ConstructionGroup(c) && isProjectNavPathVisible(c.pathSuffix)
  ),
  repair: LAYER3_REPAIR.some((c) => isProjectNavPathVisible(c.pathSuffix)),
}))

const isPlatformAdminScope = computed(() => route.path.startsWith('/platform-admin'))
const isAdminScope = computed(() => route.path.startsWith('/admin'))
const isHrScope = computed(() => route.path.startsWith('/hr'))
const isDynamicFeatureScope = computed(() => route.path.startsWith('/features/'))

const tenantCustomNavItems = computed(() => featureDefinitionsStore.engineeringTenantFeatures)

/** 側欄頂部顯示用（進入專案後、切換專案列上方） */
const sidebarProjectTitle = computed(() => {
  if (!projectId.value) return ''
  return projectStore.currentProjectName ?? projectId.value
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

/** 單租後台側欄所有連結 path（最長前綴決定 active） */
const adminSidebarNavPaths = computed(() => {
  const fromEntries = ADMIN_SIDEBAR_ENTRIES.map((i) => i.path)
  const fromGroups = ADMIN_SIDEBAR_GROUPS.flatMap((g) => g.children.map((c) => c.path))
  return [...new Set([...fromEntries, ...fromGroups])]
})

const hrSidebarNavPaths = computed(() =>
  [...new Set(HR_SIDEBAR_GROUPS.flatMap((g) => g.children.map((c) => c.path)))]
)

/** 組織指派編輯頁歸在「組織成員」底下（人資） */
function hrSidebarRouteMatchKey(path: string): string {
  if (path.startsWith(`${ROUTE_PATH.HR_ORG}/assignments/`)) {
    return ROUTE_PATH.HR_ORG_MEMBERS
  }
  return path
}

function isHrSidebarItemActive(itemPath: string): boolean {
  const key = hrSidebarRouteMatchKey(route.path)
  const matches = hrSidebarNavPaths.value.filter(
    (p) => key === p || (p !== '/' && key.startsWith(`${p}/`))
  )
  if (matches.length === 0) return false
  const longest = matches.reduce((a, b) => (a.length >= b.length ? a : b))
  return itemPath === longest
}

function isAdminSidebarItemActive(itemPath: string): boolean {
  const key = route.path
  const matches = adminSidebarNavPaths.value.filter(
    (p) => key === p || (p !== '/' && key.startsWith(`${p}/`))
  )
  if (matches.length === 0) return false
  const longest = matches.reduce((a, b) => (a.length >= b.length ? a : b))
  return itemPath === longest
}

function isPlatformItemActive(path: string) {
  return route.path === path
}

function projectChildPath(pathSuffix: string): string {
  return projectId.value ? buildProjectPath(projectId.value, pathSuffix) : '/projects'
}

/** 在候選 pathSuffix 中選「最長」且符合目前 route 者，避免 /files 與 /files/forms 同時 active */
function resolveActiveProjectPathSuffix(candidateSuffixes: string[]): string | null {
  const sorted = [...candidateSuffixes].sort((a, b) => b.length - a.length)
  for (const suffix of sorted) {
    const full = projectChildPath(suffix)
    if (route.path === full) return suffix
    if (full !== '/' && route.path.startsWith(`${full}/`)) return suffix
  }
  return null
}

const layer2ActiveSuffix = computed(() => {
  const suffixes = LAYER2_ITEMS.filter(
    (i): i is Extract<(typeof LAYER2_ITEMS)[number], { type: 'link' }> =>
      i.type === 'link' && isProjectNavPathVisible(i.pathSuffix)
  ).map((i) => i.pathSuffix)
  return resolveActiveProjectPathSuffix(suffixes)
})

function isLayer2NavActive(pathSuffix: string): boolean {
  return layer2ActiveSuffix.value === pathSuffix
}

function goToProjectPath(pathSuffix: string) {
  if (projectId.value) {
    router.push(buildProjectPath(projectId.value, pathSuffix))
  }
}

/** Layer 3 目前列表（依權限過濾 read；施工管理含群組標題） */
const layer3Items = computed((): Layer3ListEntry[] => {
  const panel = sidebarStore.currentPanel
  if (panel === 'project-mgmt') {
    return LAYER3_PROJECT_MGMT.filter((c) => isProjectNavPathVisible(c.pathSuffix)).map((item) => ({
      kind: 'link' as const,
      item,
    }))
  }
  if (panel === 'repair') {
    return LAYER3_REPAIR.filter((c) => isProjectNavPathVisible(c.pathSuffix)).map((item) => ({
      kind: 'link' as const,
      item,
    }))
  }
  if (panel === 'construction') {
    const out: Layer3ListEntry[] = []
    let i = 0
    while (i < LAYER3_CONSTRUCTION.length) {
      const e = LAYER3_CONSTRUCTION[i]!
      if (isLayer3ConstructionGroup(e)) {
        const visible: NavItemProject[] = []
        i++
        while (i < LAYER3_CONSTRUCTION.length && !isLayer3ConstructionGroup(LAYER3_CONSTRUCTION[i]!)) {
          const item = LAYER3_CONSTRUCTION[i]! as NavItemProject
          if (isProjectNavPathVisible(item.pathSuffix)) visible.push(item)
          i++
        }
        if (visible.length > 0) {
          out.push({ kind: 'group', label: e.label })
          for (const item of visible) out.push({ kind: 'link', item })
        }
      } else {
        const item = e as NavItemProject
        if (isProjectNavPathVisible(item.pathSuffix)) out.push({ kind: 'link', item })
        i++
      }
    }
    return out
  }
  return []
})

const layer3ActiveSuffix = computed(() =>
  resolveActiveProjectPathSuffix(
    layer3Items.value.filter((e) => e.kind === 'link').map((e) => e.item.pathSuffix)
  )
)

function isLayer3NavActive(pathSuffix: string): boolean {
  return layer3ActiveSuffix.value === pathSuffix
}

function l3EntryKey(entry: Layer3ListEntry, idx: number): string {
  if (entry.kind === 'group') return `g-${idx}-${entry.label}`
  return entry.item.id
}

/** 各 Layer 3 模組的第一個可見頁 pathSuffix，drill 進入時導向該頁 */
function getFirstPathSuffixForPanel(panelId: 'project-mgmt' | 'construction' | 'repair'): string {
  if (panelId === 'construction') {
    for (const e of LAYER3_CONSTRUCTION) {
      if (!isLayer3ConstructionGroup(e) && isProjectNavPathVisible(e.pathSuffix)) {
        return e.pathSuffix
      }
    }
  } else {
    const list = panelId === 'project-mgmt' ? LAYER3_PROJECT_MGMT : LAYER3_REPAIR
    const first = list.find((c) => isProjectNavPathVisible(c.pathSuffix))
    if (first) return first.pathSuffix
  }
  const fallback = {
    'project-mgmt': '/management/overview',
    construction: '/monitoring/history',
    repair: '/repair/overview',
  }
  return fallback[panelId]
}

function handleDrillIn(panelId: 'project-mgmt' | 'construction' | 'repair') {
  sidebarStore.drillIn(panelId)
  goToProjectPath(getFirstPathSuffixForPanel(panelId))
}

/** Layer 2 第一個可見功能頁 pathSuffix，從 Layer 3 返回時導向該頁 */
function getFirstLayer2PathSuffix(): string {
  const first = LAYER2_ITEMS.find(
    (i): i is Extract<(typeof LAYER2_ITEMS)[number], { type: 'link' }> =>
      i.type === 'link' && isProjectNavPathVisible(i.pathSuffix)
  )
  return first?.pathSuffix ?? '/dashboard'
}

function handleDrillOut() {
  sidebarStore.drillOut()
  goToProjectPath(getFirstLayer2PathSuffix())
}

function tenantFeaturePath(featureId: string): string {
  return `${ROUTE_PATH.FEATURES}/${encodeURIComponent(featureId)}`
}

function isTenantFeatureNavActive(featureId: string): boolean {
  const prefix = tenantFeaturePath(featureId)
  return route.path === prefix || route.path.startsWith(`${prefix}/`)
}

</script>

<template>
  <TooltipProvider :delay-duration="0">
    <ScrollArea class="h-full">
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

        <!-- 單租後台（廠商管理員）：返回專案列表改由麵包屑／系統模組，側欄僅後台項目 -->
        <template v-else-if="isAdminScope">
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
                      isAdminSidebarItemActive(item.path) && 'bg-accent text-accent-foreground'
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
                  isAdminSidebarItemActive(item.path) && 'bg-accent text-accent-foreground'
                )
              "
              @click="router.push(item.path)"
            >
              <component :is="ICON_MAP[item.icon] ?? LayoutDashboard" class="size-4 shrink-0" />
              <span class="truncate">{{ item.label }}</span>
            </Button>
          </div>
          <template v-for="group in ADMIN_SIDEBAR_GROUPS" :key="group.id">
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
                          isAdminSidebarItemActive(item.path) && 'bg-accent text-accent-foreground'
                        )
                      "
                      @click="router.push(item.path)"
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
                      isAdminSidebarItemActive(item.path) && 'bg-accent text-accent-foreground'
                    )
                  "
                  @click="router.push(item.path)"
                >
                  <component :is="ICON_MAP[item.icon] ?? LayoutDashboard" class="size-4 shrink-0" />
                  <span class="truncate">{{ item.label }}</span>
                </Button>
              </div>
            </div>
          </template>
        </template>

        <!-- 人資模組：組織／職位 -->
        <template v-else-if="isHrScope">
          <template v-for="group in HR_SIDEBAR_GROUPS" :key="group.id">
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
                          isHrSidebarItemActive(item.path) && 'bg-accent text-accent-foreground'
                        )
                      "
                      @click="router.push(item.path)"
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
                      isHrSidebarItemActive(item.path) && 'bg-accent text-accent-foreground'
                    )
                  "
                  @click="router.push(item.path)"
                >
                  <component :is="ICON_MAP[item.icon] ?? LayoutDashboard" class="size-4 shrink-0" />
                  <span class="truncate">{{ item.label }}</span>
                </Button>
              </div>
            </div>
          </template>
        </template>

        <!-- 動態功能（租戶自建）：首頁改由 AppHeader，此處僅說明 -->
        <template v-else-if="isDynamicFeatureScope">
          <div
            class="flex min-h-9 items-center rounded-md"
            :class="collapsed ? 'justify-center' : 'pl-3'"
          >
            <Tooltip v-if="collapsed">
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 text-muted-foreground">
                  <Layers class="size-4 shrink-0" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">自訂功能</TooltipContent>
            </Tooltip>
            <div v-else class="px-3 py-2 text-xs text-muted-foreground">此為租戶自建功能，列表與表單將於後續串接。</div>
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
                <div
                  v-show="!collapsed && sidebarProjectTitle"
                  class="mb-2 border-b border-border px-3 pb-3 pt-2.5"
                >
                  <p
                    class="truncate text-sm font-semibold leading-snug text-foreground"
                    :title="sidebarProjectTitle"
                  >
                    {{ sidebarProjectTitle }}
                  </p>
                </div>
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
                      <TooltipContent side="right">
                        {{
                          sidebarProjectTitle
                            ? `${sidebarProjectTitle} · 切換專案`
                            : '切換專案'
                        }}
                      </TooltipContent>
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
                  <!-- 直接連結（依專案模組 read 隱藏） -->
                  <div
                    v-else-if="item.type === 'link' && isProjectNavPathVisible(item.pathSuffix)"
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
                              isLayer2NavActive(item.pathSuffix) &&
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
                          isLayer2NavActive(item.pathSuffix) &&
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
                  <!-- Drill 進 Layer 3（子項皆無權限時隱藏） -->
                  <div
                    v-else-if="item.type === 'drill' && drillPanelHasVisibleItems[item.panelId]"
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

                <template v-if="tenantCustomNavItems.length && authStore.user?.tenantId">
                  <div
                    v-show="!collapsed"
                    class="mt-2 border-t border-border px-3 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    租戶功能
                  </div>
                  <div
                    v-for="feat in tenantCustomNavItems"
                    :key="feat.id"
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
                              isTenantFeatureNavActive(feat.id) && 'bg-accent text-accent-foreground'
                            )
                          "
                          @click="router.push(tenantFeaturePath(feat.id))"
                        >
                          <span v-if="feat.icon" class="text-base leading-none" aria-hidden>{{
                            feat.icon
                          }}</span>
                          <Layers v-else class="size-4 shrink-0" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">{{ feat.name }}</TooltipContent>
                    </Tooltip>
                    <Button
                      v-else
                      variant="ghost"
                      :class="
                        cn(
                          'h-9 w-full justify-start gap-3 rounded-md px-3',
                          isTenantFeatureNavActive(feat.id) && 'bg-accent text-accent-foreground'
                        )
                      "
                      @click="router.push(tenantFeaturePath(feat.id))"
                    >
                      <span v-if="feat.icon" class="text-base leading-none" aria-hidden>{{
                        feat.icon
                      }}</span>
                      <Layers v-else class="size-4 shrink-0 text-muted-foreground" />
                      <span class="truncate">{{ feat.name }}</span>
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
                <template v-for="(entry, l3Idx) in layer3Items" :key="l3EntryKey(entry, l3Idx)">
                  <div
                    v-if="entry.kind === 'group'"
                    v-show="!collapsed"
                    class="px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    {{ entry.label }}
                  </div>
                  <div
                    v-else
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
                              isLayer3NavActive(entry.item.pathSuffix) &&
                                'bg-accent text-accent-foreground'
                            )
                          "
                          @click="goToProjectPath(entry.item.pathSuffix)"
                        >
                          <component
                            :is="ICON_MAP[entry.item.icon] ?? LayoutDashboard"
                            class="size-4 shrink-0"
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">{{ entry.item.label }}</TooltipContent>
                    </Tooltip>
                    <Button
                      v-else
                      variant="ghost"
                      :class="
                        cn(
                          'h-9 w-full justify-start gap-3 rounded-md px-3',
                          isLayer3NavActive(entry.item.pathSuffix) &&
                            'bg-accent text-accent-foreground'
                        )
                      "
                      @click="goToProjectPath(entry.item.pathSuffix)"
                    >
                      <component
                        :is="ICON_MAP[entry.item.icon] ?? LayoutDashboard"
                        class="size-4 shrink-0"
                      />
                      <span class="truncate">{{ entry.item.label }}</span>
                    </Button>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </template>

        <!-- 未進專案（專案列表頁等）：Layer 1 -->
        <template v-else>
          <RouterLink
            v-for="item in LAYER1_ENTRIES"
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
