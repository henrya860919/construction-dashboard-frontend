<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2, ImageIcon } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { getDefectRecord } from '@/api/defect-improvements'
import { usePhotoViewer } from '@/composables/usePhotoViewer'
import type { DefectExecutionRecordItem } from '@/types/defect-improvement'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)
const defectId = computed(() => route.params.defectId as string)
const recordId = computed(() => route.params.recordId as string)

const loading = ref(true)
const record = ref<DefectExecutionRecordItem | null>(null)

async function fetchRecord() {
  if (!projectId.value || !defectId.value || !recordId.value) return
  loading.value = true
  try {
    record.value = await getDefectRecord(projectId.value, defectId.value, recordId.value)
  } finally {
    loading.value = false
  }
}

watch([projectId, defectId, recordId], fetchRecord, { immediate: true })

const fileBaseUrl = computed(() => {
  const base = import.meta.env.VITE_API_URL ?? ''
  return base.replace(/\/$/, '')
})

const photoViewer = usePhotoViewer()
function openPhotos(urls: string[], index: number) {
  photoViewer.open(urls, index)
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="mobile-page flex flex-col px-4 pb-6 pt-4">
    <div v-if="loading" class="flex flex-col items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" aria-hidden />
      <p class="mt-2 text-sm text-muted-foreground">載入中...</p>
    </div>

    <template v-else-if="record">
      <div class="mb-4">
        <h2 class="text-lg font-semibold text-foreground">執行紀錄</h2>
        <p class="mt-0.5 text-sm text-muted-foreground">
          {{ record.recordedBy?.name ?? '—' }} · {{ new Date(record.createdAt).toLocaleString('zh-TW') }}
        </p>
      </div>

      <div class="flex flex-1 flex-col gap-4">
        <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 class="mb-2 text-sm font-medium text-muted-foreground">紀錄內容</h3>
          <p class="whitespace-pre-wrap text-sm text-foreground">{{ record.content }}</p>
        </div>

        <div
          v-if="record.photos?.length"
          class="rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <h3 class="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <ImageIcon class="size-4" />
            照片
          </h3>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(photo, idx) in record.photos"
              :key="photo.id"
              type="button"
              class="rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-xs text-foreground underline-offset-2 hover:underline active:bg-muted/50"
              @click="openPhotos(record.photos!.map((p) => fileBaseUrl + p.url), idx)"
            >
              {{ photo.fileName }}
            </button>
          </div>
        </div>
      </div>

      <div class="mt-auto pt-4">
        <Button
          variant="outline"
          class="min-h-12 w-full touch-manipulation"
          @click="goBack"
        >
          返回缺失詳情
        </Button>
      </div>
    </template>

    <div
      v-else
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center"
    >
      <p class="text-sm text-muted-foreground">找不到該筆執行紀錄</p>
      <Button variant="outline" class="mt-4" @click="goBack">返回</Button>
    </div>
  </div>
</template>
