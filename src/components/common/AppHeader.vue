<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Menu, User, Bell, Sun, Moon, Settings } from 'lucide-vue-next'
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
import { useSidebarStore } from '@/stores/sidebar'
import { useThemeStore } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'
import { useAuth } from '@/composables/useAuth'
import { ROUTE_PATH } from '@/constants'

const sidebarStore = useSidebarStore()
const themeStore = useThemeStore()
const authStore = useAuthStore()
const { logout } = useAuth()

const props = withDefaults(
  defineProps<{ isMobile?: boolean }>(),
  { isMobile: false },
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
      <span class="truncate font-semibold text-foreground">Construction Dashboard</span>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <DropdownMenu v-if="authStore.canAccessAdmin && !authStore.isPlatformAdmin">
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="sm" class="gap-1.5">
            <Settings class="size-4" />
            後台
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48">
          <DropdownMenuItem as-child>
            <RouterLink :to="ROUTE_PATH.ADMIN_PROJECTS">單租後台</RouterLink>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="icon"
        aria-label="切換深色／淺色模式"
        @click="themeStore.toggle()"
      >
        <Sun v-if="themeStore.isDark" class="size-5" />
        <Moon v-else class="size-5" />
      </Button>
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
          <Button variant="ghost" size="icon" aria-label="使用者選單">
            <User class="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48">
          <DropdownMenuLabel>{{ authStore.user?.name || authStore.user?.email }}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="logout">登出</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>
</template>
