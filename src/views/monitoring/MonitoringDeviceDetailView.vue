<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Video, Settings } from 'lucide-vue-next'
import { useDeviceBreadcrumbStore } from '@/stores/deviceBreadcrumb'
import { ROUTE_NAME } from '@/constants'

const route = useRoute()
const router = useRouter()
const deviceBreadcrumbStore = useDeviceBreadcrumbStore()

const deviceId = computed(() => route.params.deviceId as string)

/** Mock 設備名稱（與列表一致） */
const DEVICE_NAMES: Record<string, string> = {
  'cctv-1': '大門入口',
  'cctv-2': '工地東側',
  'cctv-3': '物料區',
}

const deviceName = computed(() => DEVICE_NAMES[deviceId.value] ?? deviceId.value)

const settingsOpen = ref(false)

/** 設定表單 placeholder（連線設定） */
const connectionUrl = ref('')
const connectionKey = ref('')

onMounted(() => {
  deviceBreadcrumbStore.setCurrentDeviceName(deviceName.value)
})

onUnmounted(() => {
  deviceBreadcrumbStore.setCurrentDeviceName(null)
})

function goBack() {
  const projectId = route.params.projectId as string
  if (projectId) {
    router.push({ name: ROUTE_NAME.PROJECT_MONITORING_DEVICES, params: { projectId } })
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4">
    <header class="flex shrink-0 flex-wrap items-center justify-between gap-4">
      <Button
        variant="ghost"
        size="sm"
        class="gap-2"
        @click="goBack"
      >
        <ArrowLeft class="size-4" />
        返回設備列表
      </Button>
      <div class="flex items-center gap-2">
        <Dialog v-model:open="settingsOpen">
          <DialogTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              class="gap-2"
            >
              <Settings class="size-4" />
              設定
            </Button>
          </DialogTrigger>
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>設備連線設定</DialogTitle>
              <DialogDescription>
                {{ deviceName }}：連線位址與金鑰（此為示意，實際依後端 API 調整）。
              </DialogDescription>
            </DialogHeader>
            <div class="grid gap-4 py-4">
              <div class="grid gap-2">
                <label
                  for="connection-url"
                  class="text-sm font-medium text-foreground"
                >
                  連線位址
                </label>
                <Input
                  id="connection-url"
                  v-model="connectionUrl"
                  placeholder="rtsp://..."
                  class="bg-background"
                />
              </div>
              <div class="grid gap-2">
                <label
                  for="connection-key"
                  class="text-sm font-medium text-foreground"
                >
                  金鑰
                </label>
                <Input
                  id="connection-key"
                  v-model="connectionKey"
                  type="password"
                  placeholder="••••••••"
                  class="bg-background"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                @click="settingsOpen = false"
              >
                取消
              </Button>
              <Button @click="settingsOpen = false">
                儲存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </header>

    <!-- 直播區填滿剩餘高度，不產生捲軸 -->
    <div class="min-h-0 flex-1 flex flex-col">
      <Card class="flex min-h-0 flex-1 flex-col">
        <CardHeader class="shrink-0 pb-2">
          <CardTitle class="flex items-center gap-2 text-base text-foreground">
            <Video class="size-5 text-muted-foreground" />
            {{ deviceName }} — 即時畫面
          </CardTitle>
        </CardHeader>
        <CardContent class="min-h-0 flex-1 overflow-hidden">
          <!-- 直播畫面佔位：依瀏覽器大小 fit，不捲動 -->
          <div
            class="flex h-full w-full items-center justify-center rounded-lg border border-border bg-muted/50"
          >
            <div class="flex flex-col items-center gap-2 text-muted-foreground">
              <Video class="size-12 opacity-50" />
              <p class="text-sm">即時監控畫面</p>
              <p class="text-xs">串接 RTSP / WebRTC 後顯示直播</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
