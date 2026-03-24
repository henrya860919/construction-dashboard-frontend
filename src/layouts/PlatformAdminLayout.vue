<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ArrowLeft, Building2, FolderKanban, Users } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ROUTE_PATH } from '@/constants'

const navItems = [
  { path: ROUTE_PATH.PLATFORM_ADMIN_TENANTS, label: '租戶管理', icon: Building2 },
  { path: ROUTE_PATH.PLATFORM_ADMIN_PROJECTS, label: '專案總覽', icon: FolderKanban },
  { path: ROUTE_PATH.PLATFORM_ADMIN_USERS, label: '使用者總覽', icon: Users },
]
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <aside class="hidden w-56 border-r border-border bg-card md:block">
      <div class="flex h-14 items-center border-b border-border px-4">
        <span class="font-semibold text-foreground">多租後台</span>
      </div>
      <ScrollArea class="h-[calc(100vh-3.5rem)]">
        <nav class="flex flex-col gap-1 p-2">
          <Button variant="ghost" size="sm" class="w-full justify-start gap-2" as-child>
            <RouterLink :to="ROUTE_PATH.PROJECTS">
              <ArrowLeft class="size-4" />
              返回主應用
            </RouterLink>
          </Button>
          <RouterLink
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            custom
            v-slot="{ isActive, navigate }"
          >
            <Button
              :variant="isActive ? 'secondary' : 'ghost'"
              size="sm"
              class="w-full justify-start gap-2"
              @click="navigate"
            >
              <component :is="item.icon" class="size-4" />
              {{ item.label }}
            </Button>
          </RouterLink>
        </nav>
      </ScrollArea>
    </aside>
    <main class="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-6">
      <div class="min-w-0">
        <RouterView />
      </div>
    </main>
  </div>
</template>
