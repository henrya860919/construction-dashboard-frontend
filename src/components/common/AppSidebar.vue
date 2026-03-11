<script setup lang="ts">
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
  type LucideIcon,
} from 'lucide-vue-next'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { SIDEBAR_ENTRIES } from '@/constants/navigation'
import { SIDEBAR_HEADER } from '@/constants/branding'
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
}

withDefaults(
  defineProps<{
    collapsed?: boolean
  }>(),
  { collapsed: false }
)

const route = useRoute()

function isItemActive(path: string) {
  return route.path === path || (path !== '/' && route.path.startsWith(path))
}
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <ScrollArea class="h-full">
      <!-- Sidebar Header：Logo + 公司名稱 + 副標，之後可換圖與文字 -->
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
        <template v-for="entry in SIDEBAR_ENTRIES" :key="entry.type === 'item' ? entry.item.id : entry.group.id">
          <!-- 單一導航項目 -->
          <RouterLink
            v-if="entry.type === 'item'"
            v-slot="{ navigate }"
            :to="entry.item.path"
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
                        isItemActive(entry.item.path) && 'bg-accent text-accent-foreground'
                      )
                    "
                    @click="navigate"
                  >
                    <component :is="ICON_MAP[entry.item.icon] ?? LayoutDashboard" class="size-4 shrink-0" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {{ entry.item.label }}
                </TooltipContent>
              </Tooltip>
              <Button
                v-else
                variant="ghost"
                :class="
                  cn(
                    'h-9 w-full justify-start gap-3 rounded-md px-3',
                    isItemActive(entry.item.path) && 'bg-accent text-accent-foreground'
                  )
                "
                @click="navigate"
              >
                <component :is="ICON_MAP[entry.item.icon] ?? LayoutDashboard" class="size-4 shrink-0" />
                <span class="truncate">{{ entry.item.label }}</span>
              </Button>
            </div>
          </RouterLink>
          <!-- 分組：標題 + 子項目 -->
          <div v-else class="space-y-1">
            <div
              v-show="!collapsed"
              class="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {{ entry.group.label }}
            </div>
            <RouterLink
              v-for="child in entry.group.children"
              :key="child.id"
              v-slot="{ navigate }"
              :to="child.path"
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
                          isItemActive(child.path) && 'bg-accent text-accent-foreground'
                        )
                      "
                      @click="navigate"
                    >
                      <component :is="ICON_MAP[child.icon] ?? LayoutDashboard" class="size-4 shrink-0" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {{ child.label }}
                  </TooltipContent>
                </Tooltip>
                <Button
                  v-else
                  variant="ghost"
                  :class="
                    cn(
                      'h-9 w-full justify-start gap-3 rounded-md px-3',
                      isItemActive(child.path) && 'bg-accent text-accent-foreground'
                    )
                  "
                  @click="navigate"
                >
                  <component :is="ICON_MAP[child.icon] ?? LayoutDashboard" class="size-4 shrink-0" />
                  <span class="truncate">{{ child.label }}</span>
                </Button>
              </div>
            </RouterLink>
          </div>
        </template>
      </nav>
    </ScrollArea>
  </TooltipProvider>
</template>
