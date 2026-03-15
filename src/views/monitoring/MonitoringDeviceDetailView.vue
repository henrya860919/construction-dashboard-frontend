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
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, Video, Settings, Loader2, AlertCircle, Wifi, WifiOff, Trash2 } from 'lucide-vue-next'
import { useDeviceBreadcrumbStore } from '@/stores/deviceBreadcrumb'
import { ROUTE_NAME } from '@/constants'
import {
  getCamera,
  getCameraPlayUrl,
  updateCamera,
  deleteCamera,
  setCameraConnectionStatusOverride,
  type CameraItem,
  type UpdateCameraPayload,
} from '@/api/cameras'
import { useWhepPlayer } from '@/composables/useWhepPlayer'

const route = useRoute()
const router = useRouter()
const deviceBreadcrumbStore = useDeviceBreadcrumbStore()

const cameraId = computed(() => route.params.deviceId as string)
const projectId = computed(() => route.params.projectId as string)

const camera = ref<CameraItem | null>(null)
const cameraLoading = ref(true)
const cameraError = ref<string | null>(null)
const playUrl = ref<string | null>(null)
const playUrlError = ref<string | null>(null)

/** 僅在攝影機啟用、已取得 URL 且未手動標示為離線時傳入 WHEP；手動離線時不連線、不顯示畫面 */
const whepUrl = computed(() => {
  if (camera.value?.status !== 'active' || !playUrl.value) return null
  if (camera.value?.connectionStatusOverride === 'offline') return null
  return playUrl.value
})
const { videoRef, loading: webrtcLoading, error: webrtcError, hasStream: webrtcHasStream, disconnect } = useWhepPlayer(whepUrl)

const settingsOpen = ref(false)
const settingsForm = ref<{
  name: string
  sourceHost: string
  sourcePort: number
  sourcePath: string
  hasCredentials: boolean
  username: string
  password: string
}>({
  name: '',
  sourceHost: '',
  sourcePort: 554,
  sourcePath: '',
  hasCredentials: false,
  username: '',
  password: '',
})
const settingsSaving = ref(false)
const settingsError = ref<string | null>(null)

const deleteConfirmOpen = ref(false)
const deleteLoading = ref(false)
const overrideLoading = ref(false)

const deviceName = computed(() => camera.value?.name ?? cameraId.value)

/** 手動標示為離線（不影響實際串流） */
async function setOverrideOffline() {
  if (!projectId.value || !cameraId.value) return
  overrideLoading.value = true
  try {
    await setCameraConnectionStatusOverride(projectId.value, cameraId.value, 'offline')
    await loadCamera()
  } finally {
    overrideLoading.value = false
  }
}

/** 清除手動離線標示 */
async function clearOverride() {
  if (!projectId.value || !cameraId.value) return
  overrideLoading.value = true
  try {
    await setCameraConnectionStatusOverride(projectId.value, cameraId.value, null)
    await loadCamera()
  } finally {
    overrideLoading.value = false
  }
}

/** 連線狀態標籤（與列表一致） */
function connectionStatusLabel(connectionStatus: CameraItem['connectionStatus']) {
  switch (connectionStatus) {
    case 'online':
      return '線上'
    case 'offline':
      return '離線'
    case 'not_configured':
    default:
      return '尚未設定'
  }
}

/** 操作員狀態說明：依 connectionStatus、手動離線標示與 WebRTC 狀態 */
const streamStatusText = computed(() => {
  const cam = camera.value
  if (cam?.connectionStatusOverride === 'offline') {
    return '目前屬於離線狀態（已手動標示，不顯示即時畫面）'
  }
  const status = cam?.connectionStatus
  if (status === 'not_configured') {
    return '尚未設定：請依安裝精靈在現場安裝 go2rtc 並推流後，此處才會顯示即時畫面'
  }
  if (status === 'offline') {
    const last = cam?.lastStreamAt
    const timeStr = last ? new Date(last).toLocaleString('zh-TW') : ''
    return timeStr
      ? `離線：設備或網路可能中斷，上次連線於 ${timeStr}`
      : '離線：請確認現場 go2rtc 已啟動且設備電源與網路正常'
  }
  if (webrtcError.value) return '串流連線失敗，請重新整理或確認現場 go2rtc 已推流'
  if (webrtcLoading.value) return '正在連線至串流伺服器…'
  if (webrtcHasStream.value) return '即時畫面連線中 · 可於影片控制列調整音量'
  // 後端已顯示線上、有播放網址但尚未收到影像軌：表示正在建立播放連線
  if (status === 'online' && playUrl.value && !webrtcError.value) {
    return '正在載入即時畫面…'
  }
  if (playUrl.value && !webrtcError.value) return '正在載入即時畫面…'
  return '請取得播放網址後重新整理'
})

async function loadCamera() {
  if (!projectId.value || !cameraId.value) return
  cameraLoading.value = true
  cameraError.value = null
  try {
    camera.value = await getCamera(projectId.value, cameraId.value)
    deviceBreadcrumbStore.setCurrentDeviceName(camera.value.name)
  } catch (e: unknown) {
    cameraError.value = e instanceof Error ? e.message : '無法載入設備'
  } finally {
    cameraLoading.value = false
  }
}

async function loadPlayUrl() {
  if (!projectId.value || !cameraId.value || camera.value?.status !== 'active') return
  playUrlError.value = null
  try {
    const result = await getCameraPlayUrl(projectId.value, cameraId.value)
    playUrl.value = result.url
  } catch (e: unknown) {
    playUrlError.value = e instanceof Error ? e.message : '無法取得播放網址'
  }
}


onMounted(async () => {
  await loadCamera()
  if (camera.value?.status === 'active') await loadPlayUrl()
})

onUnmounted(() => {
  disconnect()
  deviceBreadcrumbStore.setCurrentDeviceName(null)
})

function goBack() {
  router.push({ name: ROUTE_NAME.PROJECT_MONITORING_DEVICES, params: { projectId: projectId.value } })
}

function openSettings() {
  const c = camera.value
  settingsForm.value = {
    name: c?.name ?? '',
    sourceHost: c?.sourceHost ?? '',
    sourcePort: c?.sourcePort ?? 554,
    sourcePath: c?.sourcePath ?? '',
    hasCredentials: c?.hasCredentials ?? false,
    username: '',
    password: '',
  }
  settingsError.value = null
  settingsOpen.value = true
}

async function saveSettings() {
  if (!projectId.value || !cameraId.value) return
  settingsSaving.value = true
  settingsError.value = null
  try {
    const f = settingsForm.value
    const payload: UpdateCameraPayload = { name: f.name?.trim() }
    if (f.sourceHost?.trim()) {
      payload.sourceHost = f.sourceHost.trim()
      payload.sourcePort = f.sourcePort
      payload.sourcePath = f.sourcePath?.trim() || undefined
      payload.hasCredentials = f.hasCredentials
      if (f.hasCredentials) {
        payload.username = f.username?.trim() || undefined
        if (f.password !== undefined && f.password !== null && f.password !== '') payload.password = f.password
      }
    } else {
      payload.sourceUrl = null
    }
    camera.value = await updateCamera(projectId.value, cameraId.value, payload)
    deviceBreadcrumbStore.setCurrentDeviceName(camera.value.name)
    settingsOpen.value = false
  } catch (e: unknown) {
    settingsError.value = e instanceof Error ? e.message : '儲存失敗'
  } finally {
    settingsSaving.value = false
  }
}

function openDeleteConfirm() {
  deleteConfirmOpen.value = true
}

async function handleDeleteCamera() {
  if (!projectId.value || !cameraId.value) return
  deleteLoading.value = true
  try {
    await deleteCamera(projectId.value, cameraId.value)
    deleteConfirmOpen.value = false
    goBack()
  } finally {
    deleteLoading.value = false
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
              @click="openSettings"
            >
              <Settings class="size-4" />
              設定
            </Button>
          </DialogTrigger>
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>設備設定</DialogTitle>
              <DialogDescription>
                修改顯示名稱或設備連線資訊（IP、埠、路徑與帳密會加密儲存，僅供 go2rtc 設定使用）。
              </DialogDescription>
            </DialogHeader>
            <form
              class="grid gap-4 py-4"
              @submit.prevent="saveSettings"
            >
              <div class="grid gap-2">
                <Label for="setting-name">顯示名稱</Label>
                <Input
                  id="setting-name"
                  v-model="settingsForm.name"
                  class="bg-background"
                />
              </div>
              <div class="grid gap-2">
                <Label for="setting-host">設備 IP 或主機名（選填）</Label>
                <Input
                  id="setting-host"
                  v-model="settingsForm.sourceHost"
                  placeholder="例：192.168.1.100"
                  class="bg-background"
                />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div class="grid gap-2">
                  <Label for="setting-port">埠</Label>
                  <Input
                    id="setting-port"
                    v-model.number="settingsForm.sourcePort"
                    type="number"
                    min="1"
                    max="65535"
                    placeholder="554"
                    class="bg-background"
                  />
                </div>
                <div class="grid gap-2">
                  <Label for="setting-path">路徑（選填）</Label>
                  <Input
                    id="setting-path"
                    v-model="settingsForm.sourcePath"
                    placeholder="例：stream1 或 /live/1"
                    class="bg-background"
                  />
                </div>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox
                  id="setting-has-credentials"
                  :checked="settingsForm.hasCredentials"
                  @update:checked="(v) => (settingsForm.hasCredentials = !!v)"
                />
                <Label
                  for="setting-has-credentials"
                  class="cursor-pointer font-normal"
                >
                  此設備需要帳號密碼
                </Label>
              </div>
              <template v-if="settingsForm.hasCredentials">
                <div class="grid gap-2">
                  <Label for="setting-username">帳號</Label>
                  <Input
                    id="setting-username"
                    v-model="settingsForm.username"
                    type="text"
                    :placeholder="camera?.usernameMasked ? `已設定（${camera.usernameMasked}）留空則保留` : '請輸入帳號'"
                    autocomplete="username"
                    class="bg-background"
                  />
                </div>
                <div class="grid gap-2">
                  <Label for="setting-password">密碼</Label>
                  <Input
                    id="setting-password"
                    v-model="settingsForm.password"
                    type="password"
                    placeholder="留空則保留原密碼"
                    autocomplete="current-password"
                    class="bg-background"
                  />
                </div>
              </template>
              <p class="text-xs text-muted-foreground">
                填寫後會加密儲存，下載專案安裝包時會預填至 go2rtc 設定。
              </p>
              <p
                v-if="settingsError"
                class="text-sm text-destructive"
              >
                {{ settingsError }}
              </p>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  @click="settingsOpen = false"
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  :disabled="settingsSaving"
                >
                  <Loader2
                    v-if="settingsSaving"
                    class="mr-2 size-4 animate-spin"
                  />
                  儲存
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <Button
          variant="outline"
          size="sm"
          class="text-destructive hover:bg-destructive/10 hover:text-destructive"
          @click="openDeleteConfirm"
        >
          <Trash2 class="size-4" />
          刪除攝影機
        </Button>
      </div>
    </header>

    <!-- 刪除確認 -->
    <Dialog v-model:open="deleteConfirmOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>刪除攝影機</DialogTitle>
          <DialogDescription>
            確定要刪除「{{ deviceName }}」？此操作無法復原，串流路徑將一併移除。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            @click="deleteConfirmOpen = false"
          >
            取消
          </Button>
          <Button
            variant="destructive"
            :disabled="deleteLoading"
            @click="handleDeleteCamera"
          >
            <Loader2
              v-if="deleteLoading"
              class="mr-2 size-4 animate-spin"
            />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 載入／錯誤 -->
    <div
      v-if="cameraLoading"
      class="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card py-12 text-muted-foreground"
    >
      <Loader2 class="size-5 animate-spin" />
      載入設備中…
    </div>
    <div
      v-else-if="cameraError"
      class="flex flex-1 items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <AlertCircle class="size-4 shrink-0" />
      {{ cameraError }}
    </div>

    <!-- 直播區 -->
    <div
      v-else
      class="min-h-0 flex-1 flex flex-col"
    >
      <Card class="flex min-h-0 flex-1 flex-col">
        <CardHeader class="shrink-0 space-y-1 pb-2">
          <CardTitle class="flex flex-wrap items-center gap-2 text-base text-foreground">
            <Video class="size-5 text-muted-foreground" />
            {{ deviceName }} — 即時畫面
            <span
              v-if="camera?.connectionStatus"
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="{
                'bg-green-500/20 text-green-700 dark:text-green-400': camera.connectionStatus === 'online',
                'bg-amber-500/20 text-amber-700 dark:text-amber-400': camera.connectionStatus === 'offline',
                'bg-muted text-muted-foreground': camera.connectionStatus === 'not_configured',
              }"
            >
              {{ connectionStatusLabel(camera.connectionStatus) }}
            </span>
          </CardTitle>
          <div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <component
              :is="webrtcHasStream ? Wifi : WifiOff"
              class="size-4 shrink-0"
            />
            <span>{{ streamStatusText }}</span>
            <template v-if="camera?.connectionStatusOverride === 'offline'">
              <span class="text-amber-600 dark:text-amber-400">· 已手動標示為離線</span>
              <Button
                variant="link"
                size="sm"
                class="h-auto p-0 text-xs"
                :disabled="overrideLoading"
                @click="clearOverride"
              >
                <Loader2
                  v-if="overrideLoading"
                  class="mr-1 size-3 animate-spin"
                />
                清除標示
              </Button>
            </template>
            <template v-else>
              <Button
                variant="link"
                size="sm"
                class="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                :disabled="overrideLoading"
                @click="setOverrideOffline"
              >
                <Loader2
                  v-if="overrideLoading"
                  class="mr-1 size-3 animate-spin"
                />
                標示為離線
              </Button>
            </template>
          </div>
        </CardHeader>
        <CardContent class="min-h-0 flex-1 overflow-hidden">
          <div
            v-if="camera?.status !== 'active'"
            class="flex h-full w-full items-center justify-center rounded-lg border border-border bg-muted/50"
          >
            <p class="text-sm text-muted-foreground">此攝影機已停用，無法播放</p>
          </div>
          <div
            v-else-if="camera?.connectionStatusOverride === 'offline'"
            class="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/50"
          >
            <WifiOff class="size-12 text-muted-foreground" />
            <p class="text-sm font-medium text-foreground">目前屬於離線狀態</p>
            <p class="max-w-sm text-center text-xs text-muted-foreground">
              此設備已手動標示為離線，不顯示即時畫面。若需恢復顯示，請點擊上方「清除標示」。
            </p>
          </div>
          <div
            v-else-if="playUrlError"
            class="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive"
          >
            <AlertCircle class="size-6" />
            <p class="text-sm">{{ playUrlError }}</p>
          </div>
          <div
            v-else
            class="flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-black"
          >
            <video
              ref="videoRef"
              class="h-full w-full object-contain"
              autoplay
              muted
              playsinline
              controls
            />
            <div
              v-if="webrtcLoading && !webrtcError"
              class="absolute flex flex-col items-center gap-2 text-white"
            >
              <Loader2 class="size-10 animate-spin" />
              <span class="text-sm">連線中…</span>
            </div>
            <div
              v-else-if="webrtcError && playUrl"
              class="absolute flex flex-col items-center gap-2 text-white"
            >
              <WifiOff class="size-10 opacity-80" />
              <span class="text-sm">無法連線至即時串流</span>
              <span class="text-xs opacity-80">請重新整理頁面，或確認現場 go2rtc 已執行並推流至雲端</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
