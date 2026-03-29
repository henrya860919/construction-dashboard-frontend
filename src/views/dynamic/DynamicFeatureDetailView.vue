<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useFeatureDefinitionsStore } from '@/stores/featureDefinitions'

const route = useRoute()
const featureStore = useFeatureDefinitionsStore()

const featureId = computed(() => route.params.featureId as string)
const submissionId = computed(() => route.params.submissionId as string)

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
    <h1 class="text-xl font-semibold tracking-tight text-foreground">案件詳情</h1>
    <p class="text-sm text-muted-foreground">
      功能
      <code class="rounded bg-muted px-1 py-0.5 text-foreground">{{ featureId }}</code>
      ／紀錄
      <code class="rounded bg-muted px-1 py-0.5 text-foreground">{{ submissionId }}</code>
    </p>
  </div>
</template>
