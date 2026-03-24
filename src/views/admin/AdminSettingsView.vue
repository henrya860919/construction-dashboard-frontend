<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Building2, ImageIcon } from 'lucide-vue-next'
import { getAdminTenantInfo, updateCompanyName, uploadCompanyLogo } from '@/api/admin'
import type { AdminTenantInfo } from '@/api/admin'
import { useTenantLogoUrl } from '@/composables/useTenantLogoUrl'
import { useTenantBrandingStore } from '@/stores/tenantBranding'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'

const authStore = useAuthStore()
const adminStore = useAdminStore()

const loading = ref(true)
const tenant = ref<AdminTenantInfo | null>(null)
const error = ref<string | null>(null)

const nameInput = ref('')
const saveNameLoading = ref(false)
const saveNameError = ref('')
const logoUploadLoading = ref(false)
const logoUploadError = ref('')

const tenantBrandingStore = useTenantBrandingStore()
const hasLogo = computed(() => !!tenant.value?.logoStorageKey)
const { objectUrl: logoUrl, reload: reloadLogo } = useTenantLogoUrl(hasLogo)
const logoFileInput = ref<HTMLInputElement | null>(null)
function triggerLogoSelect() {
  logoFileInput.value?.click()
}

async function fetchTenant() {
  loading.value = true
  error.value = null
  if (authStore.isPlatformAdmin && !adminStore.selectedTenantId) {
    error.value = '請先於後台頂部選擇租戶'
    tenant.value = null
    loading.value = false
    return
  }
  const tid = authStore.isPlatformAdmin ? adminStore.selectedTenantId ?? undefined : undefined
  try {
    tenant.value = await getAdminTenantInfo(tid)
    nameInput.value = tenant.value?.name ?? ''
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message
        : null
    error.value = msg ?? '無法載入公司資訊'
    tenant.value = null
  } finally {
    loading.value = false
  }
}

async function saveName() {
  const name = nameInput.value?.trim()
  if (!name) {
    saveNameError.value = '請輸入公司名稱'
    return
  }
  saveNameLoading.value = true
  saveNameError.value = ''
  try {
    await updateCompanyName(name)
    await fetchTenant()
    await tenantBrandingStore.fetch()
  } catch (e: unknown) {
    const res =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        : null
    saveNameError.value = res?.message ?? '儲存失敗'
  } finally {
    saveNameLoading.value = false
  }
}

const LOGO_ACCEPT = 'image/png,image/jpeg,image/jpg,image/svg+xml,image/webp'
const LOGO_MAX_MB = 2

async function onLogoChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > LOGO_MAX_MB * 1024 * 1024) {
    logoUploadError.value = `圖片不得超過 ${LOGO_MAX_MB} MB`
    input.value = ''
    return
  }
  logoUploadError.value = ''
  logoUploadLoading.value = true
  try {
    await uploadCompanyLogo(file)
    await fetchTenant()
    await tenantBrandingStore.fetch()
    await reloadLogo()
  } catch (e: unknown) {
    const res =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        : null
    logoUploadError.value = res?.message ?? '上傳失敗'
  } finally {
    logoUploadLoading.value = false
    input.value = ''
  }
}

onMounted(() => fetchTenant())

watch(
  () => adminStore.selectedTenantId,
  () => {
    if (authStore.isPlatformAdmin) void fetchTenant()
  }
)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">公司設定</h1>
      <p class="mt-1 text-sm text-muted-foreground">設定公司名稱與 Logo，之後可於系統中呈現。</p>
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
      <!-- 公司名稱 -->
      <Card class="border-border">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <Building2 class="size-4" />
            公司名稱
          </CardTitle>
          <CardDescription> 顯示於系統中的公司／租戶名稱 </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid gap-2">
            <Label for="company-name">名稱</Label>
            <Input
              id="company-name"
              v-model="nameInput"
              type="text"
              placeholder="請輸入公司名稱"
              class="max-w-md bg-background"
            />
          </div>
          <p v-if="saveNameError" class="text-sm text-destructive">{{ saveNameError }}</p>
          <Button :disabled="saveNameLoading" @click="saveName">
            <Loader2 v-if="saveNameLoading" class="mr-2 size-4 animate-spin" />
            {{ saveNameLoading ? '儲存中…' : '儲存名稱' }}
          </Button>
        </CardContent>
      </Card>

      <!-- Logo 上傳 -->
      <Card class="border-border">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <ImageIcon class="size-4" />
            公司 Logo
          </CardTitle>
          <CardDescription>
            上傳 PNG、JPG、SVG 或 WebP，建議尺寸正方形，最大 {{ LOGO_MAX_MB }} MB
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="flex flex-wrap items-start gap-6">
            <div
              class="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted"
            >
              <img v-if="logoUrl" :src="logoUrl" alt="公司 Logo" class="size-full object-contain" />
              <span v-else class="text-xs text-muted-foreground">尚無 Logo</span>
            </div>
            <div class="space-y-2">
              <input
                ref="logoFileInput"
                type="file"
                :accept="LOGO_ACCEPT"
                class="sr-only"
                :disabled="logoUploadLoading"
                @change="onLogoChange"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                :disabled="logoUploadLoading"
                @click="triggerLogoSelect"
              >
                <Loader2 v-if="logoUploadLoading" class="mr-2 size-4 animate-spin" />
                {{ logoUploadLoading ? '上傳中…' : '選擇圖片上傳' }}
              </Button>
              <p class="text-xs text-muted-foreground">點擊按鈕選擇圖片，上傳後會自動更新預覽</p>
            </div>
          </div>
          <p v-if="logoUploadError" class="text-sm text-destructive">{{ logoUploadError }}</p>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
