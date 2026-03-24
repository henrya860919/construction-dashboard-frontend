<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import MobilePhotoUpload from '@/views/mobile/components/MobilePhotoUpload.vue'
import { createDefectRecord } from '@/api/defect-improvements'
import { uploadFile } from '@/api/files'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)
const defectId = computed(() => route.params.defectId as string)

const content = ref('')
const attachmentIds = ref<string[]>([])
const uploading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')

async function onPhotoChange(files: FileList | null) {
  if (!files?.length || !projectId.value) return
  uploading.value = true
  errorMessage.value = ''
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) continue
      const result = await uploadFile({
        file,
        projectId: projectId.value,
        category: 'defect_record',
      })
      attachmentIds.value = [...attachmentIds.value, result.id]
    }
  } catch (e) {
    errorMessage.value = (e as Error)?.message ?? '上傳失敗'
  } finally {
    uploading.value = false
  }
}

async function submit() {
  const trimmed = content.value.trim()
  if (!trimmed) {
    errorMessage.value = '請填寫執行紀錄內容'
    return
  }
  if (!projectId.value || !defectId.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    await createDefectRecord(projectId.value, defectId.value, {
      content: trimmed,
      attachmentIds: attachmentIds.value.length ? attachmentIds.value : undefined,
    })
    // 用 back 移除新增頁；詳情頁 URL 需已帶 ?tab=records（詳情頁會同步 tab）
    router.back()
  } catch (e) {
    errorMessage.value = (e as Error)?.message ?? '送出失敗'
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
      <h2 class="text-lg font-semibold text-foreground">新增執行紀錄</h2>
      <p class="mt-0.5 text-sm text-muted-foreground">填寫改善執行內容與照片（選填）</p>
    </div>

    <form class="flex flex-1 flex-col gap-4" @submit.prevent="submit">
      <div class="space-y-2">
        <Label for="content" class="text-foreground">執行紀錄內容 <span class="text-destructive">*</span></Label>
        <textarea
          id="content"
          v-model="content"
          placeholder="請描述本次執行內容..."
          rows="5"
          class="min-h-28 w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div class="space-y-2">
        <Label class="text-foreground">照片（選填）</Label>
        <MobilePhotoUpload @change="onPhotoChange" />
        <p v-if="uploading" class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 class="size-3.5 animate-spin" /> 上傳中...
        </p>
        <p v-if="attachmentIds.length && !uploading" class="text-xs text-muted-foreground">
          已選 {{ attachmentIds.length }} 張（送出後會一併關聯）
        </p>
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
          <span v-else>送出</span>
        </Button>
      </div>
    </form>
  </div>
</template>
