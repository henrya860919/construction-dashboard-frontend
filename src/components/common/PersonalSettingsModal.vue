<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import type { ThemeMode, AccentScheme } from '@/constants/theme'
import { changePassword } from '@/api/auth'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, Lock, Loader2 } from 'lucide-vue-next'

defineProps<{
  open: boolean
}>()
const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const authStore = useAuthStore()
const themeStore = useThemeStore()

const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const passwordLoading = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')

watch(() => passwordForm.value, () => {
  passwordError.value = ''
  passwordSuccess.value = ''
}, { deep: true })

async function submitChangePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''
  const { currentPassword, newPassword, confirmPassword } = passwordForm.value
  if (!currentPassword.trim()) {
    passwordError.value = '請輸入目前密碼'
    return
  }
  if (!newPassword) {
    passwordError.value = '請輸入新密碼'
    return
  }
  if (newPassword.length < 6) {
    passwordError.value = '新密碼至少 6 碼'
    return
  }
  if (newPassword !== confirmPassword) {
    passwordError.value = '兩次輸入的新密碼不一致'
    return
  }
  passwordLoading.value = true
  try {
    await changePassword({ currentPassword, newPassword })
    passwordSuccess.value = '密碼已變更'
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
      : '變更密碼失敗'
    passwordError.value = msg || '變更密碼失敗'
  } finally {
    passwordLoading.value = false
  }
}

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: '淺色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟隨系統' },
]

const accentOptions: { value: AccentScheme; label: string }[] = [
  { value: 'default', label: '預設（灰）' },
  { value: 'blue', label: '藍' },
  { value: 'green', label: '綠' },
  { value: 'orange', label: '橘' },
  { value: 'violet', label: '紫' },
]

</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>個人設定</DialogTitle>
        <DialogDescription>
          帳號資訊與介面偏好，設定會儲存在此瀏覽器中。
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-6 py-2">
        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="flex items-center gap-2 text-base">
              <User class="size-4" />
              帳號資訊
            </CardTitle>
            <CardDescription>目前登入的帳號資料</CardDescription>
          </CardHeader>
          <CardContent class="space-y-3 pt-0">
            <div class="grid gap-1">
              <span class="text-xs font-medium text-muted-foreground">姓名</span>
              <p class="text-sm text-foreground">
                {{ authStore.user?.name || '—' }}
              </p>
            </div>
            <div class="grid gap-1">
              <span class="text-xs font-medium text-muted-foreground">Email</span>
              <p class="text-sm text-foreground">
                {{ authStore.user?.email || '—' }}
              </p>
            </div>
            <div class="grid gap-1">
              <span class="text-xs font-medium text-muted-foreground">角色</span>
              <p class="text-sm text-foreground">
                {{ authStore.user?.systemRole === 'platform_admin' ? '平台管理員' : authStore.user?.systemRole === 'tenant_admin' ? '租戶管理員' : '專案使用者' }}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="flex items-center gap-2 text-base">
              <Lock class="size-4" />
              變更密碼
            </CardTitle>
            <CardDescription>修改登入密碼，請使用至少 6 碼</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4 pt-0">
            <div class="grid gap-2">
              <label for="current-password" class="text-sm font-medium text-foreground">目前密碼</label>
              <Input
                id="current-password"
                v-model="passwordForm.currentPassword"
                type="password"
                placeholder="請輸入目前密碼"
                class="bg-background"
                autocomplete="current-password"
              />
            </div>
            <div class="grid gap-2">
              <label for="new-password" class="text-sm font-medium text-foreground">新密碼</label>
              <Input
                id="new-password"
                v-model="passwordForm.newPassword"
                type="password"
                placeholder="至少 6 碼"
                class="bg-background"
                autocomplete="new-password"
              />
            </div>
            <div class="grid gap-2">
              <label for="confirm-password" class="text-sm font-medium text-foreground">確認新密碼</label>
              <Input
                id="confirm-password"
                v-model="passwordForm.confirmPassword"
                type="password"
                placeholder="再輸入一次新密碼"
                class="bg-background"
                autocomplete="new-password"
              />
            </div>
            <p v-if="passwordError" class="text-sm text-destructive">{{ passwordError }}</p>
            <p v-if="passwordSuccess" class="text-sm text-foreground">{{ passwordSuccess }}</p>
            <Button
              type="button"
              :disabled="passwordLoading"
              @click="submitChangePassword"
            >
              <Loader2 v-if="passwordLoading" class="mr-2 size-4 animate-spin" />
              變更密碼
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="text-base">系統顏色設定</CardTitle>
            <CardDescription>
              主題與主色偏好會儲存在此裝置的瀏覽器內，僅影響本機顯示。
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4 pt-0">
            <div class="grid gap-2">
              <label class="text-sm font-medium text-foreground">主題模式</label>
              <Select :model-value="themeStore.mode" @update:model-value="themeStore.setMode">
                <SelectTrigger class="w-full bg-background">
                  <SelectValue placeholder="選擇主題" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in themeOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p class="text-xs text-muted-foreground">
                淺色／深色／跟隨系統（依作業系統設定自動切換）
              </p>
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-foreground">主色（按鈕、連結、強調）</label>
              <Select :model-value="themeStore.accent" @update:model-value="themeStore.setAccent">
                <SelectTrigger class="w-full bg-background">
                  <SelectValue placeholder="選擇主色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in accentOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p class="text-xs text-muted-foreground">
                選擇介面主要強調色，即時套用。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DialogContent>
  </Dialog>
</template>
