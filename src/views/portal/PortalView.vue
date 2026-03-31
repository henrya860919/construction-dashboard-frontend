<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTenantBrandingStore } from '@/stores/tenantBranding'

const authStore = useAuthStore()
const brandingStore = useTenantBrandingStore()

const user = authStore.user
const tenantName = brandingStore.name
const pendingCount = ref(0)
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-8">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">
        歡迎回來<span v-if="user?.name">，{{ user.name }}</span>
      </h1>
      <p v-if="tenantName" class="mt-1 text-sm text-muted-foreground">{{ tenantName }}</p>
      <p class="mt-2 text-sm text-muted-foreground">
        請使用頂部列的<strong class="font-medium text-foreground">系統模組</strong>切換工程、採購、投標、客戶、工務、人資、財務等（部分模組功能將陸續開放）。
      </p>
    </div>

    <div
      v-if="pendingCount > 0"
      class="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground"
    >
      <span class="rounded-md bg-primary/15 px-2 py-0.5 font-medium text-primary">
        {{ pendingCount }} 件待辦
      </span>
      <span class="text-muted-foreground">有表單等待您審核（功能將於之後串接）</span>
    </div>
  </div>
</template>
