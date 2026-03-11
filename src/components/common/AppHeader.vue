<script setup lang="ts">
import { Menu, User, Bell, Sun, Moon } from 'lucide-vue-next'
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

const sidebarStore = useSidebarStore()
const themeStore = useThemeStore()

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
          <DropdownMenuLabel>我的帳戶</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>個人設定</DropdownMenuItem>
          <DropdownMenuItem>登出</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>
</template>
