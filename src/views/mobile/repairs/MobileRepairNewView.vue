<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import MobilePhotoUpload from '@/views/mobile/components/MobilePhotoUpload.vue'
import { createRepairRequest } from '@/api/repair-requests'
import { uploadFile } from '@/api/files'
import { REPAIR_PROBLEM_CATEGORY_OPTIONS } from '@/constants/repair'
import type { RepairRequestStatus } from '@/types/repair-request'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)

const customerName = ref('')
const contactPhone = ref('')
const repairContent = ref('')
const unitLabel = ref('')
const remarks = ref('')
const problemCategory = ref('')
const isSecondRepair = ref(false)
const deliveryDate = ref('')
const repairDate = ref('')
const status = ref<RepairRequestStatus>('in_progress')
const photoAttachmentIds = ref<string[]>([])
const fileAttachmentIds = ref<string[]>([])
const fileNames = ref<{ id: string; name: string }[]>([])

const uploadingPhotos = ref(false)
const uploadingFiles = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const statusOptions: { value: RepairRequestStatus; label: string }[] = [
  { value: 'in_progress', label: '進行中' },
  { value: 'completed', label: '已完成' },
]

function onSecondRepairChecked(v: boolean | 'indeterminate') {
  isSecondRepair.value = v === true
}

async function onPhotoChange(files: FileList | null) {
  if (!files?.length || !projectId.value) return
  uploadingPhotos.value = true
  errorMessage.value = ''
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) continue
      const result = await uploadFile({
        file,
        projectId: projectId.value,
        category: 'repair_photo',
      })
      photoAttachmentIds.value = [...photoAttachmentIds.value, result.id]
    }
  } catch (e) {
    errorMessage.value = (e as Error)?.message ?? '上傳失敗'
  } finally {
    uploadingPhotos.value = false
  }
}

async function onFilesChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files?.length || !projectId.value) return
  uploadingFiles.value = true
  errorMessage.value = ''
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const result = await uploadFile({
        file,
        projectId: projectId.value,
        category: 'repair_attachment',
      })
      fileAttachmentIds.value = [...fileAttachmentIds.value, result.id]
      fileNames.value = [...fileNames.value, { id: result.id, name: file.name }]
    }
  } catch (e) {
    errorMessage.value = (e as Error)?.message ?? '附件上傳失敗'
  } finally {
    uploadingFiles.value = false
    input.value = ''
  }
}

function pickFiles() {
  fileInputRef.value?.click()
}

async function submit() {
  const nameTrim = customerName.value.trim()
  const phoneTrim = contactPhone.value.trim()
  const contentTrim = repairContent.value.trim()
  if (!nameTrim) {
    errorMessage.value = '請填寫客戶姓名'
    return
  }
  if (!phoneTrim) {
    errorMessage.value = '請填寫聯絡電話'
    return
  }
  if (!contentTrim) {
    errorMessage.value = '請填寫報修內容'
    return
  }
  if (!problemCategory.value) {
    errorMessage.value = '請選擇問題類別'
    return
  }
  if (!projectId.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    await createRepairRequest(projectId.value, {
      customerName: nameTrim,
      contactPhone: phoneTrim,
      repairContent: contentTrim,
      unitLabel: unitLabel.value.trim() || undefined,
      remarks: remarks.value.trim() || undefined,
      problemCategory: problemCategory.value,
      isSecondRepair: isSecondRepair.value,
      deliveryDate: deliveryDate.value.trim() || undefined,
      repairDate: repairDate.value.trim() || undefined,
      status: status.value,
      photoAttachmentIds: photoAttachmentIds.value.length ? photoAttachmentIds.value : undefined,
      fileAttachmentIds: fileAttachmentIds.value.length ? fileAttachmentIds.value : undefined,
    })
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
      <h2 class="text-lg font-semibold text-foreground">新增報修</h2>
      <p class="mt-0.5 text-sm text-muted-foreground">填寫客戶資料、報修內容與附件</p>
    </div>

    <form class="flex flex-1 flex-col gap-4" @submit.prevent="submit">
      <div class="space-y-2">
        <Label for="customerName" class="text-foreground">客戶姓名 <span class="text-destructive">*</span></Label>
        <input
          id="customerName"
          v-model="customerName"
          type="text"
          autocomplete="name"
          placeholder="請填寫客戶姓名"
          class="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div class="space-y-2">
        <Label for="contactPhone" class="text-foreground">聯絡電話 <span class="text-destructive">*</span></Label>
        <input
          id="contactPhone"
          v-model="contactPhone"
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          placeholder="請填寫聯絡電話"
          class="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div class="space-y-2">
        <Label for="repairContent" class="text-foreground">報修內容 <span class="text-destructive">*</span></Label>
        <textarea
          id="repairContent"
          v-model="repairContent"
          placeholder="請描述報修內容..."
          rows="4"
          class="min-h-24 w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div class="space-y-2">
        <Label for="unitLabel" class="text-foreground">戶別（選填）</Label>
        <input
          id="unitLabel"
          v-model="unitLabel"
          type="text"
          placeholder="例：A棟 3F-1"
          class="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div class="space-y-2">
        <Label for="remarks" class="text-foreground">備註（選填）</Label>
        <textarea
          id="remarks"
          v-model="remarks"
          placeholder="其他說明..."
          rows="2"
          class="min-h-[4.5rem] w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div class="space-y-2">
        <Label class="text-foreground">問題類別 <span class="text-destructive">*</span></Label>
        <Select v-model="problemCategory">
          <SelectTrigger class="w-full rounded-xl border-border bg-card">
            <SelectValue placeholder="請選擇" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="opt in REPAIR_PROBLEM_CATEGORY_OPTIONS" :key="opt" :value="opt">
              {{ opt }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3">
        <Checkbox
          id="isSecondRepair"
          :checked="isSecondRepair"
          class="size-5"
          @update:checked="onSecondRepairChecked"
        />
        <Label for="isSecondRepair" class="cursor-pointer text-sm font-normal text-foreground">
          是否二次維修
        </Label>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-2">
          <Label for="deliveryDate" class="text-foreground">交付日期（選填）</Label>
          <input
            id="deliveryDate"
            v-model="deliveryDate"
            type="date"
            class="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div class="space-y-2">
          <Label for="repairDate" class="text-foreground">報修日期（選填）</Label>
          <input
            id="repairDate"
            v-model="repairDate"
            type="date"
            class="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div class="space-y-2">
        <Label class="text-foreground">狀態</Label>
        <Select v-model="status">
          <SelectTrigger class="w-full rounded-xl border-border bg-card">
            <SelectValue placeholder="選擇" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="space-y-2">
        <Label class="text-foreground">照片（選填）</Label>
        <MobilePhotoUpload @change="onPhotoChange" />
        <p v-if="uploadingPhotos" class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 class="size-3.5 animate-spin" /> 上傳中...
        </p>
        <p v-else-if="photoAttachmentIds.length" class="text-xs text-muted-foreground">
          已選 {{ photoAttachmentIds.length }} 張
        </p>
      </div>

      <div class="space-y-2">
        <Label class="text-foreground">附件（選填）</Label>
        <input
          ref="fileInputRef"
          type="file"
          multiple
          class="sr-only"
          @change="onFilesChange"
        />
        <Button type="button" variant="outline" class="w-full min-h-12 touch-manipulation" @click="pickFiles">
          選擇檔案
        </Button>
        <p v-if="uploadingFiles" class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 class="size-3.5 animate-spin" /> 上傳中...
        </p>
        <ul v-else-if="fileNames.length" class="space-y-1 text-xs text-muted-foreground">
          <li v-for="f in fileNames" :key="f.id" class="truncate">{{ f.name }}</li>
        </ul>
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
        <Button type="submit" class="min-h-12 flex-1 touch-manipulation" :disabled="submitting">
          <Loader2 v-if="submitting" class="size-4 animate-spin" aria-hidden />
          <span v-else>送出</span>
        </Button>
      </div>
    </form>
  </div>
</template>
