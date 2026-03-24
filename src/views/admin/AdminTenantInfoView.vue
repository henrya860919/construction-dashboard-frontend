<script setup lang="ts">
import { ref, computed, onMounted, watch, reactive } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StateCard from '@/components/common/StateCard.vue'
import { Users, FolderKanban, HardDrive, Loader2 } from 'lucide-vue-next'
import {
  getAdminTenantInfo,
  getAdminTenantModuleEntitlements,
  type AdminTenantInfo,
} from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import {
  PERMISSION_MODULES,
  PERMISSION_MODULE_LABELS,
  tenantModuleGateAllowsOperations,
} from '@/constants/permission-modules'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

const authStore = useAuthStore()
const adminStore = useAdminStore()

const loading = ref(true)
const error = ref<string | null>(null)
const tenant = ref<AdminTenantInfo | null>(null)

const modulesLoading = ref(true)
const modulesError = ref<string | null>(null)
const moduleEnabled = reactive<Record<string, boolean>>(
  Object.fromEntries(PERMISSION_MODULES.map((m) => [m, false])) as Record<string, boolean>
)
/** 租戶端是否被後端擋下「新增專案／編輯權限」 */
const moduleGateBlocksOps = ref(false)

const tenantIdQuery = computed((): string | undefined => {
  if (authStore.isPlatformAdmin) return adminStore.selectedTenantId ?? undefined
  return undefined
})

/** 已使用 / 限制量，例：0.37 MB / 無限制 或 0.37 MB / 500 GB */
const storageDisplay = computed(() => {
  const info = tenant.value
  if (!info) return '—'
  const usedMb = info.storageUsageBytes / 1024 / 1024
  const usedStr = `${usedMb.toFixed(2)} MB`
  const quotaMb = info.storageQuotaMb
  const limitStr =
    quotaMb == null
      ? '無限制'
      : quotaMb >= 1024
        ? `${(quotaMb / 1024).toFixed(1)} GB`
        : `${quotaMb} MB`
  return `${usedStr} / ${limitStr}`
})

const formatDate = (s: string | null) => (s ? s.slice(0, 10) : '—')

function applyModuleEntitlementsToState(mod: {
  moduleEntitlementsGranted: boolean
  disabledModuleIds: string[]
}) {
  const dis = new Set(mod.disabledModuleIds ?? [])
  if (mod.moduleEntitlementsGranted === false) {
    for (const m of PERMISSION_MODULES) {
      moduleEnabled[m] = false
    }
    return
  }
  for (const m of PERMISSION_MODULES) {
    moduleEnabled[m] = !dis.has(m)
  }
}

async function fetch() {
  loading.value = true
  modulesLoading.value = true
  error.value = null
  modulesError.value = null

  if (authStore.isPlatformAdmin && !adminStore.selectedTenantId) {
    error.value = '請先於後台頂部選擇租戶'
    tenant.value = null
    moduleGateBlocksOps.value = true
    applyModuleEntitlementsToState({ moduleEntitlementsGranted: false, disabledModuleIds: [] })
    loading.value = false
    modulesLoading.value = false
    return
  }

  const tid = tenantIdQuery.value

  try {
    tenant.value = await getAdminTenantInfo(tid)
    error.value = null
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message
        : null
    error.value = msg ?? '無法載入租戶資訊'
    tenant.value = null
  } finally {
    loading.value = false
  }

  if (!tenant.value) {
    moduleGateBlocksOps.value = true
    applyModuleEntitlementsToState({ moduleEntitlementsGranted: false, disabledModuleIds: [] })
    modulesLoading.value = false
    return
  }

  try {
    const mod = await getAdminTenantModuleEntitlements(tid)
    applyModuleEntitlementsToState(mod)
    moduleGateBlocksOps.value = !tenantModuleGateAllowsOperations(
      mod.moduleEntitlementsGranted,
      mod.disabledModuleIds
    )
    modulesError.value = null
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message
        : null
    modulesError.value = msg ?? '無法載入模組開通狀態'
    moduleGateBlocksOps.value = true
    applyModuleEntitlementsToState({ moduleEntitlementsGranted: false, disabledModuleIds: [] })
  } finally {
    modulesLoading.value = false
  }
}

onMounted(() => fetch())

watch(
  () => adminStore.selectedTenantId,
  () => {
    if (authStore.isPlatformAdmin) void fetch()
  }
)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">租戶資訊</h1>
      <p class="mt-1 text-sm text-muted-foreground">檢視所屬租戶的統計與基本資料（唯讀）</p>
    </div>

    <p v-if="error" class="text-sm text-destructive">
      {{ error }}
    </p>
    <template v-else-if="loading">
      <div class="flex items-center gap-2 text-muted-foreground">
        <Loader2 class="size-5 animate-spin" />
        <span>載入中…</span>
      </div>
    </template>
    <template v-else-if="tenant">
      <!-- 上半部：成員數量、專案數量、總使用儲存容量（與儀表板 StateCard 同規範） -->
      <div class="grid gap-4 md:grid-cols-3">
        <StateCard title="成員數量">
          <template #icon>
            <Users class="size-6 text-muted-foreground" />
          </template>
          <p class="text-3xl font-bold tabular-nums text-foreground">
            {{ tenant.memberCount }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">所屬租戶成員總數</p>
        </StateCard>
        <StateCard title="專案數量">
          <template #icon>
            <FolderKanban class="size-6 text-muted-foreground" />
          </template>
          <p class="text-3xl font-bold tabular-nums text-foreground">
            {{ tenant.projectCount }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">所屬租戶專案總數</p>
        </StateCard>
        <StateCard title="總使用儲存容量">
          <template #icon>
            <HardDrive class="size-6 text-muted-foreground" />
          </template>
          <p class="text-3xl font-bold tabular-nums text-foreground">
            {{ storageDisplay }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">已使用 / 容量上限</p>
        </StateCard>
      </div>

      <!-- 下半部：租戶資訊（唯讀） -->
      <Card class="border-border">
        <CardHeader>
          <CardTitle class="text-base">租戶基本資料</CardTitle>
          <p class="text-sm text-muted-foreground">以下為唯讀，無法在此編輯</p>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted-foreground">租戶名稱</label>
              <p class="text-sm text-foreground">{{ tenant.name }}</p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted-foreground">代碼 (slug)</label>
              <p class="text-sm text-foreground">{{ tenant.slug ?? '—' }}</p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted-foreground">狀態</label>
              <p class="text-sm text-foreground">
                {{ tenant.status === 'active' ? '啟用' : '停用' }}
              </p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted-foreground">到期日</label>
              <p class="text-sm text-foreground">{{ formatDate(tenant.expiresAt) }}</p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted-foreground">人員上限</label>
              <p class="text-sm text-foreground">
                {{ tenant.userLimit != null ? tenant.userLimit : '不限制' }}
              </p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted-foreground">單筆上傳上限 (MB)</label>
              <p class="text-sm text-foreground">
                {{ tenant.fileSizeLimitMb != null ? tenant.fileSizeLimitMb : '不限制' }}
              </p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted-foreground">總儲存容量上限 (MB)</label>
              <p class="text-sm text-foreground">
                {{ tenant.storageQuotaMb != null ? tenant.storageQuotaMb : '不限制' }}
              </p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted-foreground">建立時間</label>
              <p class="text-sm text-foreground">
                {{ tenant.createdAt ? tenant.createdAt.slice(0, 19).replace('T', ' ') : '—' }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <!-- 功能模組開通（與平台後台對齊，唯讀） -->
      <Card class="border-border">
        <CardHeader>
          <CardTitle class="text-base">功能模組開通</CardTitle>
          <p class="text-sm text-muted-foreground">
            由平台管理；以下開關僅供檢視，與平台後台「模組開通」設定一致。關閉的模組全員（含租戶管理員）無法使用。
          </p>
        </CardHeader>
        <CardContent>
          <div v-if="modulesLoading" class="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 class="size-5 animate-spin" />
            <span>載入模組狀態…</span>
          </div>
          <template v-else>
            <p v-if="modulesError" class="text-sm text-destructive">{{ modulesError }}</p>
            <p
              v-else-if="moduleGateBlocksOps"
              class="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            >
              平台尚未為此租戶完成「模組開通」設定，或所有模組均已關閉；租戶端無法新增專案或編輯成員／權限範本，請由平台後台租戶管理處理。
            </p>
            <div v-if="!modulesError" class="space-y-2 rounded-lg border border-border bg-card p-3">
              <div
                v-for="m in PERMISSION_MODULES"
                :key="m"
                class="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/50 px-3 py-2"
              >
                <Label
                  :for="`tenant-mod-${m}`"
                  class="cursor-default text-sm font-medium text-foreground"
                >
                  {{ PERMISSION_MODULE_LABELS[m] }}
                </Label>
                <div class="flex shrink-0 items-center gap-2">
                  <span class="text-xs tabular-nums text-muted-foreground">
                    {{ moduleEnabled[m] ? '開通' : '關閉' }}
                  </span>
                  <Switch
                    :id="`tenant-mod-${m}`"
                    :model-value="moduleEnabled[m]"
                    disabled
                    class="opacity-100"
                  />
                </div>
              </div>
            </div>
          </template>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
