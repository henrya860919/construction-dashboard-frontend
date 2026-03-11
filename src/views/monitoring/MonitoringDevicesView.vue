<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Video } from 'lucide-vue-next'
import { ROUTE_NAME } from '@/constants'

/** 設備類別 */
const DEVICE_CATEGORIES = [
  {
    id: 'cctv',
    label: 'CCTV 監控',
    icon: Video,
  },
] as const

/** 單一設備（mock） */
interface DeviceItem {
  id: string
  name: string
  description: string
  status: 'online' | 'offline'
  category: string
}

const router = useRouter()

const cctvDevices: DeviceItem[] = [
  { id: 'cctv-1', name: '大門入口', description: '即時監控 · 已連線', status: 'online', category: 'cctv' },
  { id: 'cctv-2', name: '工地東側', description: '即時監控 · 已連線', status: 'online', category: 'cctv' },
  { id: 'cctv-3', name: '物料區', description: '即時監控 · 離線', status: 'offline', category: 'cctv' },
]

function goToDevice(deviceId: string) {
  router.push({ name: ROUTE_NAME.MONITORING_DEVICE_DETAIL, params: { deviceId } })
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-xl font-semibold text-foreground">設備管理</h1>

    <section
      v-for="category in DEVICE_CATEGORIES"
      :key="category.id"
      class="space-y-4"
    >
      <div class="flex items-center gap-2">
        <component
          :is="category.icon"
          class="size-5 text-muted-foreground"
        />
        <h2 class="text-base font-medium text-foreground">
          {{ category.label }}
        </h2>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="device in cctvDevices"
          :key="device.id"
          class="cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
          @click="goToDevice(device.id)"
        >
          <CardHeader class="pb-2">
            <div class="flex items-start justify-between gap-2">
              <CardTitle class="text-base font-medium text-foreground">
                {{ device.name }}
              </CardTitle>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                :class="device.status === 'online' ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'"
              >
                {{ device.status === 'online' ? '連線' : '離線' }}
              </span>
            </div>
          </CardHeader>
          <CardContent class="pt-0">
            <p class="text-sm text-muted-foreground">
              {{ device.description }}
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  </div>
</template>
