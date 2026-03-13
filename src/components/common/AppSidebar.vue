<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  LayoutDashboard,
  LayoutGrid,
  FolderKanban,
  ClipboardCheck,
  Table2,
  Building2,
  Activity,
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
  Users,
  Settings,
  ShieldCheck,
  Info,
  LogIn,
  BarChart3,
  Megaphone,
  Server,
  type LucideIcon,
} from 'lucide-vue-next'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  PROJECT_SIDEBAR_GROUPS,
  GLOBAL_SIDEBAR_ENTRIES,
  ADMIN_SIDEBAR_ENTRIES,
  PLATFORM_ADMIN_SIDEBAR_GROUPS,
} from '@/constants/navigation'
import { SIDEBAR_HEADER } from '@/constants/branding'
import { buildProjectPath, ROUTE_PATH } from '@/constants/routes'
import { useProjectStore } from '@/stores/project'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  LayoutGrid,
  FolderKanban,
  ClipboardCheck,
  Table2,
  Activity,
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
}

withDefaults(
  defineProps<{
    collapsed?: boolean
  }>(),
  { collapsed: false }
)

const route = useRoute()
const projectStore = useProjectStore()
const authStore = useAuthStore()

/** 是否在專案內（URL 為 /p/:projectId/...） */
const projectId = computed(() => route.params.projectId as string | undefined)
const isProjectScope = computed(() => !!projectId.value)

/** 是否在多租後台（平台方） */
const isPlatformAdminScope = computed(() => route.path.startsWith('/platform-admin'))
/** 是否在單租後台（廠商管理員） */
const isAdminScope = computed(() => route.path.startsWith('/admin'))

/** 非專案內且非後台時：專案列表 + 廠商管理員顯示「後台管理」 */
const globalSidebarEntries = computed(() => {
  const entries = [...GLOBAL_SIDEBAR_ENTRIES]
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

/** 同步 route 的 projectId 到 store（供麵包屑、API 等使用） */
watch(
  projectId,
  (id) => {
    projectStore.setCurrentProjectId(id ?? null)
  },
  { immediate: true }
)

function isItemActive(path: string) {
  return route.path === path || (path !== '/' && route.path.startsWith(path))
}

/** 平台後台側欄：僅精確比對 path，避免父路徑（如 /monitoring）與子路徑（如 /monitoring/audit-logs）同時亮起 */
function isPlatformItemActive(path: string) {
  return route.path === path
}

/** 專案內子項的完整 path */
function projectChildPath(pathSuffix: string): string {
  return projectId.value ? buildProjectPath(projectId.value, pathSuffix) : '/projects'
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
          class="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground"
          aria-hidden
        >
          <img
            v-if="SIDEBAR_HEADER.logoUrl"
            :src="SIDEBAR_HEADER.logoUrl"
            :alt="SIDEBAR_HEADER.companyName"
            class="size-full object-cover"
          />
          <Building2 v-else class="size-5" />
        </div>
        <div v-show="!collapsed" class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-foreground">
            {{ SIDEBAR_HEADER.companyName }}
          </p>
          <p class="truncate text-xs text-muted-foreground">
            {{ SIDEBAR_HEADER.tagline }}
          </p>
        </div>
      </header>

      <nav class="flex flex-col gap-2 p-2" :class="collapsed ? 'items-center' : ''">
        <!-- 多租後台（平台方）：依群組顯示（租戶與組織、監控、營運、系統） -->
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
                    <component :is="ICON_MAP[item.icon] ?? LayoutDashboard" class="size-4 shrink-0" />
                    <span class="truncate">{{ item.label }}</span>
                  </Button>
                </RouterLink>
              </div>
            </div>
          </template>
        </template>

        <!-- 單租後台（廠商管理員）：專案列表返回 + 專案管理、成員管理、公司設定 -->
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
            <RouterLink v-slot="{ navigate }" :to="item.path" custom>
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
            </RouterLink>
          </div>
        </template>

        <!-- 專案內：當前專案名稱 + 切換專案 + 概況/監測/契約 -->
        <template v-else-if="isProjectScope">
          <RouterLink v-slot="{ navigate }" to="/projects" custom>
            <div :class="collapsed ? 'flex justify-center' : 'pl-3'">
              <Tooltip v-if="collapsed">
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-9 w-9 shrink-0"
                    :class="isItemActive('/projects') && 'bg-accent text-accent-foreground'"
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
                :class="isItemActive('/projects') && 'bg-accent text-accent-foreground'"
                @click="navigate"
              >
                <ArrowLeft class="size-4 shrink-0" />
                <span class="truncate">切換專案</span>
              </Button>
            </div>
          </RouterLink>
          <template v-for="group in PROJECT_SIDEBAR_GROUPS" :key="group.id">
            <div class="space-y-1">
              <div
                v-show="!collapsed"
                class="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                {{ group.label }}
              </div>
              <RouterLink
                v-for="child in group.children"
                :key="child.id"
                v-slot="{ navigate }"
                :to="projectChildPath(child.pathSuffix)"
                custom
              >
                <div
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
                            isItemActive(projectChildPath(child.pathSuffix)) &&
                              'bg-accent text-accent-foreground'
                          )
                        "
                        @click="navigate"
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
                        isItemActive(projectChildPath(child.pathSuffix)) &&
                          'bg-accent text-accent-foreground'
                      )
                    "
                    @click="navigate"
                  >
                    <component
                      :is="ICON_MAP[child.icon] ?? LayoutDashboard"
                      class="size-4 shrink-0"
                    />
                    <span class="truncate">{{ child.label }}</span>
                  </Button>
                </div>
              </RouterLink>
            </div>
          </template>
        </template>

        <!-- 非專案內（專案列表頁等）：專案列表 + 廠商管理員顯示後台管理 -->
        <template v-else>
          <RouterLink
            v-for="item in globalSidebarEntries"
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
