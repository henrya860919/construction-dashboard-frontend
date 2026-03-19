<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import {
  getProjectSelfInspectionRecord,
  getProjectSelfInspectionTemplateHub,
} from '@/api/project-self-inspections'
import type { SelfInspectionRecordItem } from '@/api/project-self-inspections'
import type { ProjectSelfInspectionTemplateHub } from '@/api/project-self-inspections'
import { useMobileSelfInspectionNavStore } from '@/stores/mobileSelfInspectionNav'

defineOptions({ name: 'MobileSelfInspectionRecordDetailView' })

const route = useRoute()
const navStore = useMobileSelfInspectionNavStore()

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
  navStore.setTemplateTitle(null)
  try {
    const rec = await getProjectSelfInspectionRecord(pid, tid, rid)
    record.value = rec
    if (rec.structureSnapshot) {
      hub.value = rec.structureSnapshot
    } else {
      hub.value = await getProjectSelfInspectionTemplateHub(pid, tid)
    }
    navStore.setTemplateTitle(hub.value?.template.name ?? null)
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

onUnmounted(() => {
  navStore.setTemplateTitle(null)
})

const header = computed(() => record.value?.filledPayload?.header)
const items = computed(() => record.value?.filledPayload?.items ?? {})
</script>

<template>
  <div class="mobile-page space-y-4 px-4 pb-8 pt-2">
    <div v-if="loading" class="flex flex-col items-center py-16">
      <Loader2 class="size-8 animate-spin text-muted-foreground" aria-hidden />
      <p class="mt-2 text-sm text-muted-foreground">載入中…</p>
    </div>

    <div
      v-else-if="loadError || !record || !hub || !hc"
      class="rounded-xl border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive"
    >
      {{ loadError || '找不到紀錄' }}
    </div>

    <template v-else>
      <section class="rounded-xl border border-border bg-card p-4">
        <h2 class="text-lg font-semibold text-foreground">{{ hub.template.name }}</h2>
        <p class="mt-1 text-sm text-muted-foreground">填寫時間 {{ formatDateTime(record.createdAt) }}</p>
        <p class="mt-2 text-sm text-muted-foreground">
          填寫者：
          <span class="text-foreground">{{
            record.filledBy?.name?.trim() || record.filledBy?.email || '—'
          }}</span>
        </p>

        <dl class="mt-4 space-y-3">
          <div>
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
      </section>

      <section
        v-for="block in hub.blocks"
        :key="block.id"
        class="space-y-3 rounded-xl border border-border bg-card p-4"
      >
        <div>
          <h3 class="text-base font-semibold text-foreground">{{ block.title }}</h3>
          <p v-if="block.description" class="mt-1 text-sm text-muted-foreground">
            {{ block.description }}
          </p>
        </div>

        <div
          v-for="it in block.items"
          :key="it.id"
          class="space-y-2 rounded-lg border border-border/80 bg-background/80 p-3"
        >
          <div>
            <p class="text-xs text-muted-foreground">{{ it.categoryLabel }}</p>
            <p class="text-sm font-medium text-foreground">{{ it.itemName }}</p>
          </div>
          <div>
            <p class="text-xs font-medium text-muted-foreground">規範標準</p>
            <p class="text-sm text-foreground">{{ it.standardText }}</p>
          </div>
          <div>
            <p class="text-xs font-medium text-muted-foreground">實際情形</p>
            <p class="text-sm text-foreground">{{ items[it.id]?.actualText?.trim() || '—' }}</p>
          </div>
          <div>
            <p class="text-xs font-medium text-muted-foreground">{{ hc.resultSectionLabel }}</p>
            <p class="text-sm text-foreground">{{ resultLabel(items[it.id]?.resultOptionId) }}</p>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
