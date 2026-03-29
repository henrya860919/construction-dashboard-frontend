import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getFeatureDefinitionsByModule, getFeatureDefinitionById } from '@/api/featureDefinitions'
import type { FeatureDefinition } from '@/types/feature-definition'

const ENGINEERING = 'engineering'

export const useFeatureDefinitionsStore = defineStore('featureDefinitions', () => {
  const byModule = ref<Record<string, FeatureDefinition[]>>({})
  const detailCache = ref<Record<string, FeatureDefinition>>({})
  const loaded = ref<Record<string, boolean>>({})
  /** 供麵包屑／標題用，由動態功能頁設定 */
  const breadcrumbFeatureTitle = ref<string | null>(null)

  function groupedByModule(module: string) {
    const features = byModule.value[module] ?? []
    return {
      system: [...features]
        .filter((f) => f.isSystem)
        .sort((a, b) => a.systemSortOrder - b.systemSortOrder),
      tenant: [...features]
        .filter((f) => !f.isSystem)
        .sort((a, b) => a.tenantSortOrder - b.tenantSortOrder),
    }
  }

  const engineeringTenantFeatures = computed(() => groupedByModule(ENGINEERING).tenant)

  async function loadModule(module: string, force = false) {
    if (loaded.value[module] && !force) return
    const list = await getFeatureDefinitionsByModule(module)
    byModule.value[module] = list
    loaded.value[module] = true
  }

  async function getFeature(id: string): Promise<FeatureDefinition | null> {
    const hit = detailCache.value[id]
    if (hit) return hit
    const row = await getFeatureDefinitionById(id)
    if (row) {
      detailCache.value[id] = row
    }
    return row
  }

  async function loadAll() {
    const modules = ['engineering', 'procurement', 'hr', 'finance'] as const
    await Promise.all(modules.map((m) => loadModule(m)))
  }

  function refresh(module: string) {
    loaded.value[module] = false
    return loadModule(module, true)
  }

  function setBreadcrumbFeatureTitle(title: string | null) {
    breadcrumbFeatureTitle.value = title
  }

  return {
    byModule,
    detailCache,
    loaded,
    breadcrumbFeatureTitle,
    groupedByModule,
    engineeringTenantFeatures,
    loadModule,
    getFeature,
    loadAll,
    refresh,
    setBreadcrumbFeatureTitle,
  }
})
