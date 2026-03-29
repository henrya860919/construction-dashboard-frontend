<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useFeatureDefinitionsStore } from '@/stores/featureDefinitions'

const route = useRoute()
const featureStore = useFeatureDefinitionsStore()

const featureId = computed(() => route.params.featureId as string)

async function syncTitle() {
  const id = featureId.value
  if (!id) return
  const row = await featureStore.getFeature(id)
  featureStore.setBreadcrumbFeatureTitle(row?.name ?? null)
}

watch(featureId, () => void syncTitle(), { immediate: true })

onMounted(() => void syncTitle())

onUnmounted(() => {
  featureStore.setBreadcrumbFeatureTitle(null)
})
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-semibold tracking-tight text-foreground">動態功能列表</h1>
    <p class="text-sm text-muted-foreground">
      功能編號 <code class="rounded bg-muted px-1 py-0.5 text-foreground">{{ featureId }}</code>
      — 列表與篩選將依 <span class="font-medium text-foreground">list_config</span>／表單資料串接。
    </p>
  </div>
</template>
