<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ArrowLeft, FolderKanban, Users, Settings } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ROUTE_PATH } from '@/constants'

const navItems = [
  { path: ROUTE_PATH.ADMIN_PROJECTS, label: '專案管理', icon: FolderKanban },
  { path: ROUTE_PATH.ADMIN_MEMBERS, label: '成員管理', icon: Users },
  { path: ROUTE_PATH.ADMIN_SETTINGS, label: '公司設定', icon: Settings },
]
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <aside class="hidden w-56 border-r border-border bg-card md:block">
      <div class="flex h-14 items-center border-b border-border px-4">
        <span class="font-semibold text-foreground">單租後台</span>
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
