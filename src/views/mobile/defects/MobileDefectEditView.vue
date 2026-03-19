<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getDefectImprovement, updateDefectImprovement } from '@/api/defect-improvements'
import type { DefectPriority, DefectStatus } from '@/types/defect-improvement'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)
const defectId = computed(() => route.params.defectId as string)

const description = ref('')
const discoveredBy = ref('')
const priority = ref<DefectPriority>('medium')
const floor = ref('')
const location = ref('')
const status = ref<DefectStatus>('in_progress')
const loading = ref(true)
const submitting = ref(false)
const errorMessage = ref('')

const priorityOptions: { value: DefectPriority; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
]

const statusOptions: { value: DefectStatus; label: string }[] = [
  { value: 'in_progress', label: '進行中' },
  { value: 'completed', label: '已完成' },
]

async function loadDefect() {
  if (!projectId.value || !defectId.value) return
  loading.value = true
  try {
    const defect = await getDefectImprovement(projectId.value, defectId.value)
    if (defect) {
      description.value = defect.description
      discoveredBy.value = defect.discoveredBy
      priority.value = defect.priority
      floor.value = defect.floor ?? ''
      location.value = defect.location ?? ''
      status.value = defect.status
    }
  } finally {
    loading.value = false
  }
}

watch([projectId, defectId], loadDefect, { immediate: true })

async function submit() {
  const descTrim = description.value.trim()
  const byTrim = discoveredBy.value.trim()
  if (!descTrim) {
    errorMessage.value = '請填寫問題說明'
    return
  }
  if (!byTrim) {
    errorMessage.value = '請填寫發現人'
    return
  }
  if (!projectId.value || !defectId.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    await updateDefectImprovement(projectId.value, defectId.value, {
      description: descTrim,
      discoveredBy: byTrim,
      priority: priority.value,
      floor: floor.value.trim() || undefined,
      location: location.value.trim() || undefined,
      status: status.value,
    })
    // 用 back 移除編輯頁，上一頁才是詳情，避免再按返回又進編輯
    router.back()
  } catch (e) {
    errorMessage.value = (e as Error)?.message ?? '更新失敗'
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="mobile-page flex flex-col px-4 pb-6 pt-4">
    <div class="mb-4">
      <h2 class="text-lg font-semibold text-foreground">編輯缺失</h2>
      <p class="mt-0.5 text-sm text-muted-foreground">修改問題說明、發現人、優先度等</p>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" aria-hidden />
      <p class="mt-2 text-sm text-muted-foreground">載入中...</p>
    </div>

    <form v-else class="flex flex-1 flex-col gap-4" @submit.prevent="submit">
      <div class="space-y-2">
        <Label for="description" class="text-foreground">問題說明 <span class="text-destructive">*</span></Label>
        <textarea
          id="description"
          v-model="description"
          placeholder="請描述問題..."
          rows="4"
          class="min-h-24 w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div class="space-y-2">
        <Label for="discoveredBy" class="text-foreground">發現人 <span class="text-destructive">*</span></Label>
        <input
          id="discoveredBy"
          v-model="discoveredBy"
          type="text"
          placeholder="請填寫發現人"
          class="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-2">
          <Label class="text-foreground">優先度</Label>
          <Select v-model="priority">
            <SelectTrigger class="w-full rounded-xl border-border bg-card">
              <SelectValue placeholder="選擇" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in priorityOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-2">
          <Label class="text-foreground">狀態</Label>
          <Select v-model="status">
            <SelectTrigger class="w-full rounded-xl border-border bg-card">
              <SelectValue placeholder="選擇" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in statusOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div class="space-y-2">
        <Label for="floor" class="text-foreground">樓層（選填）</Label>
        <input
          id="floor"
          v-model="floor"
          type="text"
          placeholder="例：B1、1F"
          class="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div class="space-y-2">
        <Label for="location" class="text-foreground">位置（選填）</Label>
        <input
          id="location"
          v-model="location"
          type="text"
          placeholder="請填寫位置"
          class="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

      <div class="mt-auto flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          class="min-h-12 flex-1 touch-manipulation"
          :disabled="submitting"
          @click="goBack"
        >
          取消
        </Button>
        <Button
          type="submit"
          class="min-h-12 flex-1 touch-manipulation"
          :disabled="submitting"
        >
          <Loader2 v-if="submitting" class="size-4 animate-spin" aria-hidden />
          <span v-else>儲存</span>
        </Button>
      </div>
    </form>
  </div>
</template>
