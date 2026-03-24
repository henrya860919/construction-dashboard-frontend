<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import StateCard from '@/components/common/StateCard.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Video, PlusCircle, Loader2, AlertCircle, MoreHorizontal, Trash2, ChevronDown, Wifi, WifiOff, Settings2, LayoutGrid } from 'lucide-vue-next'
import { ROUTE_NAME } from '@/constants'
import {
  listProjectCameras,
  createCamera,
  deleteCamera,
  downloadCameraInstallYaml,
  downloadProjectInstallPackage,
  getCameraInstallConfig,
  setCameraConnectionStatusOverride,
  type CameraItem,
  type CreateCameraPayload,
} from '@/api/cameras'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)
const equipmentPerm = useProjectModuleActions(projectId, 'construction.equipment')

const cameras = ref<CameraItem[]>([])
const loading = ref(true)
const listError = ref<string | null>(null)

/** 新增攝影機／安裝精靈：僅 canCreate 顯示入口，不採常駐＋toast（見 docs/project-module-frontend-ui-gating.md） */
const addDialogOpen = ref(false)
const addForm = ref<CreateCameraPayload>({ name: '', sourceUrl: '' })
const addSubmitting = ref(false)
const addError = ref<string | null>(null)
const createdCamera = ref<CameraItem | null>(null)
const installWizardOpen = ref(false)
const installStep = ref(1)
const installConfig = ref<Awaited<ReturnType<typeof getCameraInstallConfig>> | null>(null)
const installConfigLoading = ref(false)

const deleteTarget = ref<CameraItem | null>(null)
const deleteConfirmOpen = ref(false)
const deleteLoading = ref(false)
const overrideLoadingId = ref<string | null>(null)

/** 設備狀態統計（依 connectionStatus） */
const deviceStats = computed(() => {
  const list = cameras.value
  const total = list.length
  const online = list.filter((c) => c.connectionStatus === 'online').length
  const offline = list.filter((c) => c.connectionStatus === 'offline').length
  const notConfigured = list.filter((c) => c.connectionStatus === 'not_configured').length
  return { total, online, offline, notConfigured }
})

async function loadCameras() {
  if (!projectId.value) return
  loading.value = true
  listError.value = null
  try {
    cameras.value = await listProjectCameras(projectId.value)
  } catch (e: unknown) {
    listError.value = e instanceof Error ? e.message : '無法載入攝影機列表'
  } finally {
    loading.value = false
  }
}

onMounted(loadCameras)

function goToDevice(cameraId: string) {
  router.push({
    name: ROUTE_NAME.PROJECT_MONITORING_DEVICE_DETAIL,
    params: { projectId: projectId.value, deviceId: cameraId },
  })
}

function openAddDialog() {
  addForm.value = { name: '', sourceUrl: '' }
  addError.value = null
  createdCamera.value = null
  installWizardOpen.value = false
  installStep.value = 1
  addDialogOpen.value = true
}

async function submitAdd() {
  if (!projectId.value || !addForm.value.name.trim()) return
  addSubmitting.value = true
  addError.value = null
  try {
    const payload: CreateCameraPayload = {
      name: addForm.value.name.trim(),
    }
    if (addForm.value.sourceUrl?.trim()) {
      payload.sourceUrl = addForm.value.sourceUrl.trim()
    }
    const camera = await createCamera(projectId.value, payload)
    createdCamera.value = camera
    addDialogOpen.value = false
    installWizardOpen.value = true
    installStep.value = 1
    await loadCameras()
  } catch (e: unknown) {
    addError.value = e instanceof Error ? e.message : '新增失敗'
  } finally {
    addSubmitting.value = false
  }
}

async function loadInstallConfig() {
  if (!projectId.value || !createdCamera.value) return
  installConfigLoading.value = true
  try {
    installConfig.value = await getCameraInstallConfig(projectId.value, createdCamera.value.id)
  } finally {
    installConfigLoading.value = false
  }
}

function goToInstallStep2() {
  installStep.value = 2
  loadInstallConfig()
}

async function handleDownloadYaml() {
  if (!projectId.value || !createdCamera.value) return
  try {
    await downloadCameraInstallYaml(projectId.value, createdCamera.value.id)
  } catch {
    // error toast optional
  }
}

async function handleDownloadPackage(os: 'win' | 'mac') {
  if (!projectId.value) return
  try {
    await downloadProjectInstallPackage(projectId.value, os)
  } catch {
    // error toast optional
  }
}

function finishWizard() {
  installWizardOpen.value = false
  createdCamera.value = null
  installConfig.value = null
  installStep.value = 1
}

/** 依實際連線狀態顯示給使用者 */
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

function connectionStatusClass(connectionStatus: CameraItem['connectionStatus']) {
  switch (connectionStatus) {
    case 'online':
      return 'bg-green-500/20 text-green-700 dark:text-green-400'
    case 'offline':
      return 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
    case 'not_configured':
    default:
      return 'bg-muted text-muted-foreground'
  }
}

/** 卡片左側狀態色條 */
function connectionStatusAccentClass(connectionStatus: CameraItem['connectionStatus']) {
  switch (connectionStatus) {
    case 'online':
      return 'bg-green-500'
    case 'offline':
      return 'bg-amber-500'
    case 'not_configured':
    default:
      return 'bg-muted-foreground/40'
  }
}

/** 狀態標籤用圖示 */
function connectionStatusIcon(connectionStatus: CameraItem['connectionStatus']) {
  switch (connectionStatus) {
    case 'online':
      return Wifi
    case 'offline':
      return WifiOff
    default:
      return Settings2
  }
}

function openDeleteConfirm(cam: CameraItem) {
  deleteTarget.value = cam
  deleteConfirmOpen.value = true
}

async function handleConfirmDelete() {
  if (!projectId.value || !deleteTarget.value) return
  deleteLoading.value = true
  try {
    await deleteCamera(projectId.value, deleteTarget.value.id)
    deleteConfirmOpen.value = false
    deleteTarget.value = null
    await loadCameras()
  } finally {
    deleteLoading.value = false
  }
}

async function handleSetOverrideOffline(cam: CameraItem) {
  if (!projectId.value) return
  overrideLoadingId.value = cam.id
  try {
    await setCameraConnectionStatusOverride(projectId.value, cam.id, 'offline')
    await loadCameras()
  } finally {
    overrideLoadingId.value = null
  }
}

async function handleClearOverride(cam: CameraItem) {
  if (!projectId.value) return
  overrideLoadingId.value = cam.id
  try {
    await setCameraConnectionStatusOverride(projectId.value, cam.id, null)
    await loadCameras()
  } finally {
    overrideLoadingId.value = null
  }
}

</script>

<template>
  <div class="space-y-8">
    <h1 class="text-xl font-semibold text-foreground">設備管理</h1>

    <!-- 設備狀態（與儀表板 StateCard 同風格） -->
    <section class="space-y-4">
      <h2 class="text-base font-medium text-foreground">設備狀態</h2>
      <div
        v-if="loading"
        class="flex items-center gap-2 py-6 text-sm text-muted-foreground"
      >
        <Loader2 class="size-4 animate-spin" />
        載入中…
      </div>
      <div
        v-else
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StateCard title="設備數量">
          <template #icon>
            <LayoutGrid class="size-6 text-muted-foreground" />
          </template>
          <p class="text-3xl font-bold tabular-nums text-foreground">
            {{ deviceStats.total }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            本專案攝影機總數
          </p>
        </StateCard>
        <StateCard title="線上">
          <template #icon>
            <Wifi class="size-6 text-green-600 dark:text-green-400" />
          </template>
          <p class="text-3xl font-bold tabular-nums text-green-700 dark:text-green-400">
            {{ deviceStats.online }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            正在推流
          </p>
        </StateCard>
        <StateCard title="離線">
          <template #icon>
            <WifiOff class="size-6 text-amber-600 dark:text-amber-400" />
          </template>
          <p class="text-3xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {{ deviceStats.offline }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            曾連線、目前未推流
          </p>
        </StateCard>
        <StateCard title="尚未設定">
          <template #icon>
            <Settings2 class="size-6 text-muted-foreground" />
          </template>
          <p class="text-3xl font-bold tabular-nums text-muted-foreground">
            {{ deviceStats.notConfigured }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            待完成現場 go2rtc 設定
          </p>
        </StateCard>
      </div>
    </section>

    <!-- CCTV 區塊 -->
    <section class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <Video class="size-5 text-muted-foreground" />
          <h2 class="text-base font-medium text-foreground">CCTV 監控</h2>
        </div>
        <div class="flex items-center gap-2">
          <DropdownMenu v-if="equipmentPerm.canRead">
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                class="gap-1"
                :disabled="!projectId || cameras.length === 0"
              >
                更多
                <ChevronDown class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                class="cursor-pointer"
                :disabled="!projectId || cameras.length === 0"
                @click="handleDownloadPackage('win')"
              >
                下載 Windows 安裝包
              </DropdownMenuItem>
              <DropdownMenuItem
                class="cursor-pointer"
                :disabled="!projectId || cameras.length === 0"
                @click="handleDownloadPackage('mac')"
              >
                下載 Mac 安裝包
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            v-if="equipmentPerm.canCreate"
            size="sm"
            class="gap-2"
            @click="openAddDialog"
          >
            <PlusCircle class="size-4" />
            新增攝影機
          </Button>
        </div>
      </div>

      <p class="text-sm text-muted-foreground">
        攝影機需在工地現場安裝 go2rtc 並設定推流後，方可在此收看即時畫面。
        <template v-if="equipmentPerm.canCreate">請先「新增攝影機」，</template>
        <template v-else>請由具建立權限者新增攝影機後，</template>
        再依本區「更多」下載<strong>專案安裝包</strong>（內含本專案所有攝影機設定）。解壓後：Windows 雙擊
        <code class="rounded bg-muted px-1">run.bat</code>；Mac 雙擊
        <code class="rounded bg-muted px-1">run.command</code>（若被系統阻擋，請打開壓縮檔內的
        <strong>Mac安裝說明.txt</strong> 依終端機步驟執行）。
      </p>

      <div
        v-if="loading"
        class="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-12 text-muted-foreground"
      >
        <Loader2 class="size-5 animate-spin" />
        載入中…
      </div>
      <div
        v-else-if="listError"
        class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        <AlertCircle class="size-4 shrink-0" />
        {{ listError }}
      </div>
      <div
        v-else-if="cameras.length === 0"
        class="rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center text-sm text-muted-foreground"
      >
        <template v-if="equipmentPerm.canCreate">尚無攝影機，請點「新增攝影機」並依精靈完成現場安裝。</template>
        <template v-else>尚無攝影機。</template>
      </div>
      <div
        v-else
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Card
          v-for="cam in cameras"
          :key="cam.id"
          class="group relative cursor-pointer overflow-hidden border-border bg-card shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md"
          @click="goToDevice(cam.id)"
        >
          <div
            class="absolute left-0 top-0 h-full w-1 shrink-0 rounded-l-lg"
            :class="connectionStatusAccentClass(cam.connectionStatus)"
          />
          <CardHeader class="relative flex flex-row items-start gap-3 pl-5 pb-3">
            <div class="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 transition-colors group-hover:bg-muted">
              <Video class="size-5 text-muted-foreground" />
            </div>
            <div class="min-w-0 flex-1 space-y-1.5">
              <div class="flex items-start justify-between gap-2">
                <CardTitle class="text-base font-semibold leading-tight text-foreground">
                  {{ cam.name }}
                </CardTitle>
                <div class="flex shrink-0 items-center gap-1">
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                    :class="connectionStatusClass(cam.connectionStatus)"
                  >
                    <component
                      :is="connectionStatusIcon(cam.connectionStatus)"
                      class="size-3.5"
                    />
                    {{ connectionStatusLabel(cam.connectionStatus) }}
                  </span>
                  <DropdownMenu v-if="equipmentPerm.canUpdate || equipmentPerm.canDelete">
                    <DropdownMenuTrigger
                      as-child
                      @click.stop
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        class="size-8 opacity-70 group-hover:opacity-100"
                        aria-label="更多"
                        @click.stop
                      >
                        <MoreHorizontal class="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      @click.stop
                    >
                      <DropdownMenuItem
                        v-if="equipmentPerm.canUpdate && cam.connectionStatusOverride === 'offline'"
                        class="cursor-pointer"
                        :disabled="overrideLoadingId === cam.id"
                        @click.stop="handleClearOverride(cam)"
                      >
                        清除離線標示
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        v-else-if="equipmentPerm.canUpdate"
                        class="cursor-pointer"
                        :disabled="overrideLoadingId === cam.id"
                        @click.stop="handleSetOverrideOffline(cam)"
                      >
                        標示為離線
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        v-if="equipmentPerm.canDelete"
                        class="cursor-pointer text-destructive focus:text-destructive"
                        @click.stop="openDeleteConfirm(cam)"
                      >
                        <Trash2 class="size-4" />
                        刪除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <p class="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Video class="size-3.5 shrink-0 opacity-70" />
                go2rtc 推流 · 點擊進入即時畫面與設定
              </p>
            </div>
          </CardHeader>
        </Card>
      </div>
    </section>

    <!-- 新增攝影機 Dialog -->
    <Dialog v-model:open="addDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新增攝影機</DialogTitle>
          <DialogDescription>
            為此專案建立一組攝影機設定，取得連線 Token 後請至現場依安裝精靈完成 go2rtc 設定。
          </DialogDescription>
        </DialogHeader>
        <form
          class="grid gap-4 py-4"
          @submit.prevent="submitAdd"
        >
          <div class="grid gap-2">
            <Label for="camera-name">顯示名稱（必填）</Label>
            <Input
              id="camera-name"
              v-model="addForm.name"
              placeholder="例：大門入口、工地東側"
              class="bg-background"
              required
            />
          </div>
          <div class="grid gap-2">
            <Label for="camera-source">設備 RTSP 網址（選填）</Label>
            <Input
              id="camera-source"
              v-model="addForm.sourceUrl"
              type="url"
              placeholder="rtsp://使用者:密碼@IP:554/stream1"
              class="bg-background"
            />
            <p class="text-xs text-muted-foreground">
              若已知現場攝影機的 RTSP 位址與帳密，可在此填寫；系統會加密儲存，並用於產生 go2rtc 設定範例。亦可稍後在設備詳情中設定。
            </p>
          </div>
          <p
            v-if="addError"
            class="text-sm text-destructive"
          >
            {{ addError }}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              @click="addDialogOpen = false"
            >
              取消
            </Button>
            <Button
              type="submit"
              :disabled="addSubmitting || !addForm.name.trim()"
            >
              <Loader2
                v-if="addSubmitting"
                class="mr-2 size-4 animate-spin"
              />
              新增並取得安裝設定
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- 安裝精靈 Dialog -->
    <Dialog v-model:open="installWizardOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>現場安裝精靈 — {{ createdCamera?.name }}</DialogTitle>
          <DialogDescription>
            請依步驟在工地現場電腦完成 go2rtc 設定，連線成功後即可在儀表板收看即時畫面。
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-6 py-4">
          <!-- Step 1 -->
          <div
            v-if="installStep === 1"
            class="space-y-2"
          >
            <p class="font-medium text-foreground">步驟 1：攝影機已建立</p>
            <p class="text-sm text-muted-foreground">
              系統已為此攝影機產生專用連線 Token，並已向串流伺服器註冊。請點「下一步」下載設定檔。
            </p>
            <Button
              class="w-full"
              @click="goToInstallStep2"
            >
              下一步：下載 go2rtc 設定
            </Button>
          </div>
          <!-- Step 2 -->
          <div
            v-if="installStep === 2"
            class="space-y-4"
          >
            <p class="font-medium text-foreground">步驟 2：下載一鍵安裝包</p>
            <template v-if="installConfigLoading">
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 class="size-4 animate-spin" />
                載入設定…
              </div>
            </template>
            <template v-else-if="installConfig">
              <p class="text-sm text-muted-foreground">
                下載<strong>專案安裝包</strong>（含本專案所有攝影機的 go2rtc 設定）。壓縮檔內含 <strong>go2rtc.yaml</strong> 與 <strong>執行腳本</strong>，解壓後雙擊即可；腳本會先關閉先前執行的 go2rtc，再從 GitHub 下載最新版並啟動。
              </p>
              <div class="grid gap-2 sm:grid-cols-2">
                <Button
                  class="w-full"
                  @click="handleDownloadPackage('win')"
                >
                  下載 Windows 一鍵安裝包
                </Button>
                <Button
                  class="w-full"
                  variant="secondary"
                  @click="handleDownloadPackage('mac')"
                >
                  下載 Mac 一鍵安裝包
                </Button>
              </div>
              <p class="text-xs text-muted-foreground">
                Windows：解壓後雙擊 <code class="rounded bg-muted px-1">run.bat</code>。Mac：解壓後雙擊 <code class="rounded bg-muted px-1">run.command</code>；若出現「無法打開」，請打開壓縮檔內的 <strong>Mac安裝說明.txt</strong> 依終端機步驟執行。
              </p>
              <details class="text-sm text-muted-foreground">
                <summary class="cursor-pointer hover:text-foreground">僅下載 YAML 設定檔（進階）</summary>
                <Button
                  variant="link"
                  class="h-auto p-0 text-xs"
                  @click="handleDownloadYaml"
                >
                  下載 go2rtc.yaml
                </Button>
              </details>
              <div class="flex gap-2">
                <Button
                  variant="outline"
                  @click="installStep = 1"
                >
                  上一步
                </Button>
                <Button @click="installStep = 3">
                  下一步：執行說明
                </Button>
              </div>
            </template>
          </div>
          <!-- Step 3 -->
          <div
            v-if="installStep === 3"
            class="space-y-4"
          >
            <p class="font-medium text-foreground">步驟 3：執行說明</p>
            <p class="text-sm text-muted-foreground">
              解壓下載的安裝包後，雙擊 <strong>run.bat</strong>（Windows）或 <strong>run.command</strong>（Mac；若被阻擋請看壓縮檔內 <strong>Mac安裝說明.txt</strong>）。腳本會先關閉先前執行的 go2rtc，再下載最新版並啟動，推流成功後回到本系統「設備」→ 點選攝影機即可收看即時畫面。
            </p>
            <div class="flex gap-2">
              <Button
                variant="outline"
                @click="installStep = 2"
              >
                上一步
              </Button>
              <Button
                @click="finishWizard"
              >
                完成
              </Button>
              <Button
                v-if="createdCamera"
                variant="secondary"
                @click="goToDevice(createdCamera.id); installWizardOpen = false"
              >
                前往即時畫面
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <!-- 刪除攝影機確認 -->
    <Dialog v-model:open="deleteConfirmOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>刪除攝影機</DialogTitle>
          <DialogDescription>
            確定要刪除「{{ deleteTarget?.name }}」？此操作無法復原，串流路徑將一併移除。
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
            @click="handleConfirmDelete"
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
  </div>
</template>
