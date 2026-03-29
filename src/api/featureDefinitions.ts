import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse } from '@/types'
import type { FeatureDefinition } from '@/types/feature-definition'

export async function getFeatureDefinitionsByModule(module: string): Promise<FeatureDefinition[]> {
  const { data } = await apiClient.get<ApiResponse<FeatureDefinition[]>>(
    API_PATH.FEATURE_DEFINITIONS_BY_MODULE(module)
  )
  return data.data ?? []
}

export async function getFeatureDefinitionById(id: string): Promise<FeatureDefinition | null> {
  const { data } = await apiClient.get<ApiResponse<FeatureDefinition>>(API_PATH.FEATURE_DEFINITION(id))
  return data.data ?? null
}
