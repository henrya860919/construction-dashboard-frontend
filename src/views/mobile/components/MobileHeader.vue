<script setup lang="ts">
import { ChevronLeft, Menu } from 'lucide-vue-next'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

defineProps<{
  title: string
  canGoBack: boolean
  projectId?: string
}>()

const emit = defineEmits<{
  back: []
  menu: []
  switchToDesktop: []
}>()
</script>

<template>
  <header
    class="mobile-header flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 safe-area-inset-top"
    style="padding-top: max(0.75rem, env(safe-area-inset-top));"
  >
    <div class="flex min-w-[3rem] justify-start">
      <Button
        v-if="canGoBack"
        variant="ghost"
        size="icon"
        class="h-12 min-h-12 w-12 min-w-12 touch-manipulation"
        aria-label="返回"
        @click="emit('back')"
      >
        <ChevronLeft class="size-6 text-foreground" aria-hidden />
      </Button>
    </div>

    <h1 class="mobile-header-title flex-1 truncate text-center text-base font-medium text-foreground">
      {{ title }}
    </h1>

    <div class="flex min-w-[3rem] justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-12 min-h-12 w-12 min-w-12 touch-manipulation"
            aria-label="選單"
          >
            <Menu class="size-6 text-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="bg-popover text-popover-foreground border-border">
          <DropdownMenuItem
            v-if="projectId"
            class="min-h-12 text-base"
            @click="emit('menu')"
          >
            切換專案
          </DropdownMenuItem>
          <DropdownMenuItem
            class="min-h-12 text-base"
            @click="emit('switchToDesktop')"
          >
            使用完整版網站
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>
</template>

<style scoped>
.mobile-header {
  /* iOS / Android 安全區域 */
}
</style>
