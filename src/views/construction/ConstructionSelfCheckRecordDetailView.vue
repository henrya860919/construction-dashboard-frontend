<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-vue-next'
import {
  getProjectSelfInspectionRecord,
  getProjectSelfInspectionTemplateHub,
} from '@/api/project-self-inspections'
import type { SelfInspectionRecordItem } from '@/api/project-self-inspections'
import type { ProjectSelfInspectionTemplateHub } from '@/api/project-self-inspections'
import { ROUTE_NAME } from '@/constants/routes'

const route = useRoute()
const router = useRouter()

const projectId = computed(() => (route.params.projectId as string) ?? '')
const templateId = computed(() => (route.params.templateId as string) ?? '')
const recordId = computed(() => (route.params.recordId as string) ?? '')

const loading = ref(true)
const loadError = ref('')
const record = ref<SelfInspectionRecordItem | null>(null)
const hub = ref<ProjectSelfInspectionTemplateHub | null>(null)

const hc = computed(() => hub.value?.template.headerConfig)

function resultLabel(optionId: string | undefined) {
  if (!optionId || !hc.value) return '—'
  const o = hc.value.resultLegendOptions.find((x) => x.id === optionId)
  return o?.label ?? optionId
}

function timingLabel(optionId: string | undefined) {
  if (!optionId || !hc.value) return '—'
  const o = hc.value.timingOptions.find((x) => x.id === optionId)
  return o?.label ?? optionId
}

function formatDateTime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function load() {
  const pid = projectId.value
  const tid = templateId.value
  const rid = recordId.value
  if (!pid || !tid || !rid) return
  loading.value = true
  loadError.value = ''
  record.value = null
  hub.value = null
  try {
    const rec = await getProjectSelfInspectionRecord(pid, tid, rid)
    record.value = rec
    if (rec.structureSnapshot) {
      hub.value = rec.structureSnapshot
    } else {
      hub.value = await getProjectSelfInspectionTemplateHub(pid, tid)
    }
  } catch {
    loadError.value = '無法載入紀錄'
  } finally {
    loading.value = false
  }
}

watch(
  [projectId, templateId, recordId],
  () => {
    load()
  },
  { immediate: true }
)

function goHub() {
  router.push({
    name: ROUTE_NAME.PROJECT_CONSTRUCTION_SELF_CHECK_TEMPLATE,
    params: { projectId: projectId.value, templateId: templateId.value },
  })
}

const header = computed(() => record.value?.filledPayload?.header)
const items = computed(() => record.value?.filledPayload?.items ?? {})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-3">
      <Button variant="outline" type="button" class="gap-2" @click="goHub">
        <ArrowLeft class="size-4" aria-hidden="true" />
        返回紀錄列表
      </Button>
      <h1 class="text-xl font-semibold text-foreground">查驗紀錄詳情</h1>
    </div>

    <div v-if="loading" class="flex items-center gap-2 text-muted-foreground">
      <Loader2 class="size-5 animate-spin" />
      載入中…
    </div>

    <div
      v-else-if="loadError || !record || !hub || !hc"
      class="rounded-lg border border-destructive/50 bg-card px-4 py-3 text-sm text-destructive"
    >
      {{ loadError || '找不到紀錄' }}
    </div>

    <template v-else>
      <div class="rounded-lg border border-border bg-card p-4 md:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-medium text-foreground">{{ hub.template.name }}</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              填寫時間 {{ formatDateTime(record.createdAt) }}
            </p>
          </div>
          <p class="text-sm text-muted-foreground">
            填寫者：
            <span class="text-foreground">{{
              record.filledBy?.name?.trim() || record.filledBy?.email || '—'
            }}</span>
          </p>
        </div>

        <dl class="mt-6 grid gap-3 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <dt class="text-xs text-muted-foreground">
              {{ hc.inspectionNameLabel?.trim() || '檢查名稱' }}
            </dt>
            <dd class="text-sm text-foreground">{{ header?.inspectionName?.trim() || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ hc.projectNameLabel }}</dt>
            <dd class="text-sm text-foreground">{{ header?.projectName?.trim() || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ hc.subProjectLabel }}</dt>
            <dd class="text-sm text-foreground">{{ header?.subProjectName?.trim() || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ hc.subcontractorLabel }}</dt>
            <dd class="text-sm text-foreground">{{ header?.subcontractor?.trim() || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ hc.inspectionLocationLabel }}</dt>
            <dd class="text-sm text-foreground">{{ header?.inspectionLocation?.trim() || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ hc.inspectionDateLabel }}</dt>
            <dd class="text-sm text-foreground">{{ header?.inspectionDate?.trim() || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ hc.timingSectionLabel }}</dt>
            <dd class="text-sm text-foreground">{{ timingLabel(header?.timingOptionId) }}</dd>
          </div>
        </dl>
      </div>

      <div
        v-for="block in hub.blocks"
        :key="block.id"
        class="space-y-4 rounded-lg border border-border bg-card p-4 md:p-6"
      >
        <div>
          <h3 class="text-lg font-medium text-foreground">{{ block.title }}</h3>
          <p v-if="block.description" class="mt-1 text-sm text-muted-foreground">
            {{ block.description }}
          </p>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr class="border-b border-border">
                <th class="bg-muted/30 px-3 py-2 text-left font-medium text-foreground">
                  檢查項目
                </th>
                <th class="bg-muted/30 px-3 py-2 text-left font-medium text-foreground">
                  規範標準
                </th>
                <th class="bg-muted/30 px-3 py-2 text-left font-medium text-foreground">
                  實際情形
                </th>
                <th class="bg-muted/30 px-3 py-2 text-left font-medium text-foreground">
                  {{ hc.resultSectionLabel }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="it in block.items"
                :key="it.id"
                class="border-b border-border align-top last:border-0"
              >
                <td class="px-3 py-2 text-foreground">
                  <span class="text-muted-foreground">{{ it.categoryLabel }}</span>
                  <div class="font-medium">{{ it.itemName }}</div>
                </td>
                <td class="px-3 py-2 text-muted-foreground">{{ it.standardText }}</td>
                <td class="px-3 py-2 text-foreground">
                  {{ items[it.id]?.actualText?.trim() || '—' }}
                </td>
                <td class="px-3 py-2 text-foreground">
                  {{ resultLabel(items[it.id]?.resultOptionId) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
