<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ClipboardCheck, Plus } from 'lucide-vue-next'
import { buildMobileProjectPath } from '@/constants/routes'
import { ROUTE_PATH } from '@/constants/routes'
import { Button } from '@/components/ui/button'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)

// 手機版獨立：自主檢查列表（之後接 API）
const items = computed(() => [])

function goAdd() {
  router.push(buildMobileProjectPath(projectId.value, ROUTE_PATH.MOBILE_INSPECTION))
}
</script>

<template>
  <div class="mobile-page px-4 pb-6 pt-4">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-semibold text-foreground">自主檢查</h2>
      <Button size="sm" class="min-h-12 touch-manipulation" @click="goAdd">
        <Plus class="size-5" aria-hidden />
        <span class="ml-1">新增123abc</span>
      </Button>
    </div>

    <div
      v-if="items.length === 0"
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center"
    >
      <ClipboardCheck class="mb-3 size-12 text-muted-foreground" aria-hidden />
      <p class="text-sm font-medium text-foreground">尚無檢查紀錄</p>
      <p class="mt-1 text-sm text-muted-foreground">點擊「新增」開始填寫自主檢查表</p>
    </div>

    <ul v-else class="flex flex-col gap-3">
      <li
        v-for="(_item, i) in items"
        :key="i"
        class="min-h-[3.5rem] rounded-xl border border-border bg-card p-4"
      >
        <!-- 之後接 API 顯示檢查項目 -->
      </li>
    </ul>
  </div>
</template>
