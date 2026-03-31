<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { login } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { ROUTE_PATH } from '@/constants'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({ email: '', password: '' })
const loading = ref(false)
const errorMessage = ref('')

async function onSubmit() {
  errorMessage.value = ''
  if (!form.email.trim() || !form.password) {
    errorMessage.value = '請輸入 Email 與密碼'
    return
  }
  loading.value = true
  try {
    const data = await login({ email: form.email.trim(), password: form.password })
    authStore.setAuth(data.accessToken, data.refreshToken, data.user)
    router.push(authStore.isPlatformAdmin ? ROUTE_PATH.PLATFORM_ADMIN_TENANTS : ROUTE_PATH.PROJECTS)
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: { message?: string } } } }
    errorMessage.value =
      err.response?.data?.error?.message ?? '登入失敗，請檢查帳密'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Card class="border-border bg-card">
    <CardHeader class="space-y-1">
      <CardTitle class="text-xl text-foreground">登入</CardTitle>
      <CardDescription class="text-muted-foreground">
        請使用您的帳號登入 Construction Dashboard
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <label for="email" class="text-sm font-medium text-foreground">Email</label>
          <Input
            id="email"
            v-model="form.email"
            type="email"
            placeholder="admin@example.com"
            autocomplete="email"
            class="border-border bg-background text-foreground"
          />
        </div>
        <div class="space-y-2">
          <label for="password" class="text-sm font-medium text-foreground">密碼</label>
          <Input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            class="border-border bg-background text-foreground"
          />
        </div>
        <p v-if="errorMessage" class="text-sm text-destructive">
          {{ errorMessage }}
        </p>
        <Button type="submit" class="w-full" :disabled="loading">
          {{ loading ? '登入中…' : '登入' }}
        </Button>
      </form>
      <p class="text-xs text-muted-foreground">
        測試帳號：admin@example.com / member@example.com / platform@example.com，密碼皆為 password123
      </p>
    </CardContent>
  </Card>
</template>
