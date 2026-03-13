<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Loader2, Settings, ShieldAlert } from 'lucide-vue-next'
import { fetchPlatformSettings, updatePlatformSettings, type PlatformSettings } from '@/api/platform'

const loading = ref(true)
const saving = ref(false)
const savingMaintenance = ref(false)
const error = ref<string | null>(null)
const success = ref(false)
const form = ref<PlatformSettings>({
  maintenanceMode: false,
  defaultUserLimit: null,
  defaultStorageQuotaMb: null,
  defaultFileSizeLimitMb: null,
})

async function load() {
  loading.value = true
  error.value = null
  try {
    form.value = await fetchPlatformSettings()
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : '無法載入設定'
    error.value = msg
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  error.value = null
  success.value = false
  try {
    const updated = await updatePlatformSettings({
      maintenanceMode: form.value.maintenanceMode,
      defaultUserLimit: form.value.defaultUserLimit ?? null,
      defaultStorageQuotaMb: form.value.defaultStorageQuotaMb ?? null,
      defaultFileSizeLimitMb: form.value.defaultFileSizeLimitMb ?? null,
    })
    form.value = updated
    success.value = true
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : '儲存失敗'
    error.value = msg
  } finally {
    saving.value = false
  }
}

/** 維護模式開關切換時立即寫入後端；以 API 回傳為準同步到 form */
async function onMaintenanceChange(checked: boolean) {
  savingMaintenance.value = true
  error.value = null
  try {
    const updated = await updatePlatformSettings({ maintenanceMode: checked })
    form.value = { ...form.value, ...updated }
    success.value = true
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : '更新失敗'
    error.value = msg
  } finally {
    savingMaintenance.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">平台設定</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        維護模式、新租戶預設限制等全平台參數。
      </p>
    </div>

    <p v-if="error" class="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error }}
    </p>
    <p v-if="success" class="rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
      已儲存
    </p>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- 維護模式：獨立卡片，開關即時寫入 -->
      <Card class="border-border bg-card">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <ShieldAlert class="size-4" />
            維護模式
          </CardTitle>
          <CardDescription>
            開啟後僅平台管理員可登入與操作，其他使用者會看到「系統維護中」。切換後會立即儲存。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div>
              <label for="maintenance" class="text-base font-medium">維護模式</label>
              <p class="text-sm text-muted-foreground">開啟後僅平台管理員可存取</p>
            </div>
            <div class="flex items-center gap-2">
              <Switch
                id="maintenance"
                :model-value="form.maintenanceMode"
                :disabled="savingMaintenance"
                @update:model-value="onMaintenanceChange"
              />
              <Loader2 v-if="savingMaintenance" class="size-5 animate-spin text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 一般設定：新租戶預設限制，需按儲存 -->
      <Card class="border-border bg-card">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <Settings class="size-4" />
            一般設定
          </CardTitle>
          <CardDescription>新租戶預設限制（選填，建立租戶時可套用）。修改後請按「儲存」。</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="space-y-2">
          <label class="text-sm font-medium">新租戶預設限制（選填，建立租戶時可套用）</label>
          <div class="grid gap-4 sm:grid-cols-3">
            <div class="grid gap-2">
              <label for="userLimit" class="text-sm text-muted-foreground">人員上限</label>
              <Input
                id="userLimit"
                :model-value="form.defaultUserLimit ?? ''"
                type="number"
                min="0"
                placeholder="不限制"
                class="bg-background"
                @update:model-value="(v) => (form.defaultUserLimit = v === '' || v === undefined ? null : Number(v))"
              />
            </div>
            <div class="grid gap-2">
              <label for="storageQuota" class="text-sm text-muted-foreground">儲存配額 (MB)</label>
              <Input
                id="storageQuota"
                :model-value="form.defaultStorageQuotaMb ?? ''"
                type="number"
                min="0"
                placeholder="不限制"
                class="bg-background"
                @update:model-value="(v) => (form.defaultStorageQuotaMb = v === '' || v === undefined ? null : Number(v))"
              />
            </div>
            <div class="grid gap-2">
              <label for="fileSize" class="text-sm text-muted-foreground">單檔上限 (MB)</label>
              <Input
                id="fileSize"
                :model-value="form.defaultFileSizeLimitMb ?? ''"
                type="number"
                min="0"
                placeholder="不限制"
                class="bg-background"
                @update:model-value="(v) => (form.defaultFileSizeLimitMb = v === '' || v === undefined ? null : Number(v))"
              />
            </div>
          </div>
        </div>

          <div class="flex justify-end">
            <Button :disabled="saving" @click="save">
              <Loader2 v-if="saving" class="mr-2 size-4 animate-spin" />
              儲存
            </Button>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
