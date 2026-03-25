<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2, ArrowLeft, Paperclip } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ROUTE_NAME } from '@/constants'
import { REPAIR_PROBLEM_CATEGORY_OPTIONS } from '@/constants/repair'
import { createRepairRequest } from '@/api/repair-requests'
import { uploadFile } from '@/api/files'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import type { RepairRequestStatus } from '@/types/repair-request'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)

const perm = useProjectModuleActions(projectId, 'repair.record')

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
const photoInputRef = ref<HTMLInputElement | null>(null)

const statusOptions: { value: RepairRequestStatus; label: string }[] = [
  { value: 'in_progress', label: '進行中' },
  { value: 'completed', label: '已完成' },
]

const textareaClass =
  'flex min-h-[4.5rem] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30'

function onSecondRepairChecked(v: boolean | 'indeterminate') {
  isSecondRepair.value = v === true
}

function goList() {
  router.push({
    name: ROUTE_NAME.PROJECT_REPAIR_RECORDS,
    params: { projectId: projectId.value },
  })
}

async function onPhotoInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
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
  } catch (err) {
    errorMessage.value = (err as Error)?.message ?? '上傳失敗'
  } finally {
    uploadingPhotos.value = false
    input.value = ''
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
  } catch (err) {
    errorMessage.value = (err as Error)?.message ?? '附件上傳失敗'
  } finally {
    uploadingFiles.value = false
    input.value = ''
  }
}

function pickPhotos() {
  photoInputRef.value?.click()
}

function pickFiles() {
  fileInputRef.value?.click()
}

async function submit() {
  if (!perm.canCreate.value) {
    errorMessage.value = '您沒有新增權限'
    return
  }
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
    const created = await createRepairRequest(projectId.value, {
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
    await router.push({
      name: ROUTE_NAME.PROJECT_REPAIR_RECORD_DETAIL,
      params: { projectId: projectId.value, repairId: created.id },
    })
  } catch (err) {
    errorMessage.value = (err as Error)?.message ?? '送出失敗'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-3">
      <Button variant="outline" class="gap-2" type="button" @click="goList">
        <ArrowLeft class="size-4" />
        返回列表
      </Button>
    </div>

    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">新增報修</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        建立報修單並上傳照片或附件；與手機現場版流程分開，資料寫入同一專案。
      </p>
    </div>

    <Card v-if="!perm.canCreate" class="border-border">
      <CardHeader>
        <CardTitle class="text-base">無法新增</CardTitle>
        <CardDescription>您沒有報修紀錄的新增權限。</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" type="button" @click="goList">返回報修紀錄表</Button>
      </CardContent>
    </Card>

    <Card v-else class="border-border">
      <CardHeader>
        <CardTitle class="text-base">報修資料</CardTitle>
        <CardDescription>標示為必填的欄位請完整填寫。</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-6" @submit.prevent="submit">
          <div class="grid gap-6 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="customerName" class="text-foreground">
                客戶姓名 <span class="text-destructive">*</span>
              </Label>
              <Input
                id="customerName"
                v-model="customerName"
                type="text"
                autocomplete="name"
                placeholder="請填寫客戶姓名"
              />
            </div>
            <div class="space-y-2">
              <Label for="contactPhone" class="text-foreground">
                聯絡電話 <span class="text-destructive">*</span>
              </Label>
              <Input
                id="contactPhone"
                v-model="contactPhone"
                type="tel"
                inputmode="tel"
                autocomplete="tel"
                placeholder="請填寫聯絡電話"
              />
            </div>
          </div>

          <div class="space-y-2">
            <Label for="repairContent" class="text-foreground">
              報修內容 <span class="text-destructive">*</span>
            </Label>
            <textarea
              id="repairContent"
              v-model="repairContent"
              :class="textareaClass"
              placeholder="請描述報修內容…"
              rows="4"
            />
          </div>

          <div class="grid gap-6 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="unitLabel" class="text-foreground">戶別（選填）</Label>
              <Input id="unitLabel" v-model="unitLabel" type="text" placeholder="例：A棟 3F-1" />
            </div>
            <div class="space-y-2">
              <Label class="text-foreground">問題類別 <span class="text-destructive">*</span></Label>
              <Select v-model="problemCategory">
                <SelectTrigger class="w-full bg-background">
                  <SelectValue placeholder="請選擇" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt in REPAIR_PROBLEM_CATEGORY_OPTIONS" :key="opt" :value="opt">
                    {{ opt }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="space-y-2">
            <Label for="remarks" class="text-foreground">備註（選填）</Label>
            <textarea
              id="remarks"
              v-model="remarks"
              :class="textareaClass"
              placeholder="其他說明…"
              rows="2"
            />
          </div>

          <div class="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3">
            <Checkbox
              id="isSecondRepair"
              :checked="isSecondRepair"
              @update:checked="onSecondRepairChecked"
            />
            <Label for="isSecondRepair" class="cursor-pointer text-sm font-normal text-foreground">
              是否二次維修
            </Label>
          </div>

          <div class="grid gap-6 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="deliveryDate" class="text-foreground">交付日期（選填）</Label>
              <Input id="deliveryDate" v-model="deliveryDate" type="date" />
            </div>
            <div class="space-y-2">
              <Label for="repairDate" class="text-foreground">報修日期（選填）</Label>
              <Input id="repairDate" v-model="repairDate" type="date" />
            </div>
          </div>

          <div class="space-y-2 sm:max-w-xs">
            <Label class="text-foreground">狀態</Label>
            <Select v-model="status">
              <SelectTrigger class="w-full bg-background">
                <SelectValue placeholder="選擇" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2 border-t border-border pt-6">
            <Label class="text-foreground">照片（選填）</Label>
            <input
              ref="photoInputRef"
              type="file"
              accept="image/*"
              multiple
              class="sr-only"
              @change="onPhotoInputChange"
            />
            <Button type="button" variant="outline" size="sm" class="h-8" @click="pickPhotos">
              選擇圖片
            </Button>
            <p v-if="uploadingPhotos" class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 class="size-3.5 animate-spin" />
              上傳中…
            </p>
            <p v-else-if="photoAttachmentIds.length" class="text-xs text-muted-foreground">
              已上傳 {{ photoAttachmentIds.length }} 張
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
            <Button type="button" variant="outline" size="sm" class="h-8 gap-1.5" @click="pickFiles">
              <Paperclip class="size-3.5" />
              選擇檔案
            </Button>
            <p v-if="uploadingFiles" class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 class="size-3.5 animate-spin" />
              上傳中…
            </p>
            <ul v-else-if="fileNames.length" class="space-y-1 text-xs text-muted-foreground">
              <li v-for="f in fileNames" :key="f.id" class="truncate">{{ f.name }}</li>
            </ul>
          </div>

          <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

          <div class="flex flex-wrap gap-3 border-t border-border pt-6">
            <Button type="button" variant="outline" :disabled="submitting" @click="goList">
              取消
            </Button>
            <Button type="submit" :disabled="submitting">
              <Loader2 v-if="submitting" class="mr-2 size-4 animate-spin" />
              建立報修單
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
