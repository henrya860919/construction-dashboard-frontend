<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StateCard from '@/components/common/StateCard.vue'
import { Users, FolderKanban, HardDrive, Loader2 } from 'lucide-vue-next'
import { getAdminTenantInfo } from '@/api/admin'
import type { AdminTenantInfo } from '@/api/admin'

const loading = ref(true)
const error = ref<string | null>(null)
const tenant = ref<AdminTenantInfo | null>(null)

/** 已使用 / 限制量，例：0.37 MB / 無限制 或 0.37 MB / 500 GB */
const storageDisplay = computed(() => {
  const info = tenant.value
  if (!info) return '—'
  const usedMb = info.storageUsageBytes / 1024 / 1024
  const usedStr = `${usedMb.toFixed(2)} MB`
  const quotaMb = info.storageQuotaMb
  const limitStr =
    quotaMb == null ? '無限制' : quotaMb >= 1024 ? `${(quotaMb / 1024).toFixed(1)} GB` : `${quotaMb} MB`
  return `${usedStr} / ${limitStr}`
})

const formatDate = (s: string | null) => (s ? s.slice(0, 10) : '—')

async function fetch() {
  loading.value = true
  error.value = null
  try {
    tenant.value = await getAdminTenantInfo()
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : '無法載入租戶資訊'
    error.value = msg
    tenant.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => fetch())
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">租戶資訊</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        檢視所屬租戶的統計與基本資料（唯讀）
      </p>
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
          <p class="mt-1 text-xs text-muted-foreground">
            所屬租戶成員總數
          </p>
        </StateCard>
        <StateCard title="專案數量">
          <template #icon>
            <FolderKanban class="size-6 text-muted-foreground" />
          </template>
          <p class="text-3xl font-bold tabular-nums text-foreground">
            {{ tenant.projectCount }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            所屬租戶專案總數
          </p>
        </StateCard>
        <StateCard title="總使用儲存容量">
          <template #icon>
            <HardDrive class="size-6 text-muted-foreground" />
          </template>
          <p class="text-3xl font-bold tabular-nums text-foreground">
            {{ storageDisplay }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            已使用 / 容量上限
          </p>
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
              <p class="text-sm text-foreground">{{ tenant.status === 'active' ? '啟用' : '停用' }}</p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted-foreground">到期日</label>
              <p class="text-sm text-foreground">{{ formatDate(tenant.expiresAt) }}</p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted-foreground">人員上限</label>
              <p class="text-sm text-foreground">{{ tenant.userLimit != null ? tenant.userLimit : '不限制' }}</p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted-foreground">單筆上傳上限 (MB)</label>
              <p class="text-sm text-foreground">{{ tenant.fileSizeLimitMb != null ? tenant.fileSizeLimitMb : '不限制' }}</p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted-foreground">總儲存容量上限 (MB)</label>
              <p class="text-sm text-foreground">{{ tenant.storageQuotaMb != null ? tenant.storageQuotaMb : '不限制' }}</p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted-foreground">建立時間</label>
              <p class="text-sm text-foreground">{{ tenant.createdAt ? tenant.createdAt.slice(0, 19).replace('T', ' ') : '—' }}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
