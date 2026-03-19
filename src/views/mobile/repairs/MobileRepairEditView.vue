<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
import { getRepairRequest, updateRepairRequest } from '@/api/repair-requests'
import { REPAIR_PROBLEM_CATEGORY_OPTIONS } from '@/constants/repair'
import type { RepairRequestStatus } from '@/types/repair-request'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)
const repairId = computed(() => route.params.repairId as string)

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
const loading = ref(true)
const notFound = ref(false)
const submitting = ref(false)
const errorMessage = ref('')

const statusOptions: { value: RepairRequestStatus; label: string }[] = [
  { value: 'in_progress', label: '進行中' },
  { value: 'completed', label: '已完成' },
]

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function onSecondRepairChecked(v: boolean | 'indeterminate') {
  isSecondRepair.value = v === true
}

async function load() {
  if (!projectId.value || !repairId.value) return
  loading.value = true
  notFound.value = false
  try {
    const row = await getRepairRequest(projectId.value, repairId.value)
    if (!row) {
      notFound.value = true
      return
    }
    customerName.value = row.customerName
    contactPhone.value = row.contactPhone
    repairContent.value = row.repairContent
    unitLabel.value = row.unitLabel ?? ''
    remarks.value = row.remarks ?? ''
    problemCategory.value = row.problemCategory
    isSecondRepair.value = row.isSecondRepair
    deliveryDate.value = isoToDateInput(row.deliveryDate)
    repairDate.value = isoToDateInput(row.repairDate)
    status.value = row.status
  } finally {
    loading.value = false
  }
}

watch([projectId, repairId], load, { immediate: true })

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
  if (!projectId.value || !repairId.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    await updateRepairRequest(projectId.value, repairId.value, {
      customerName: nameTrim,
      contactPhone: phoneTrim,
      repairContent: contentTrim,
      unitLabel: unitLabel.value.trim() || null,
      remarks: remarks.value.trim() || null,
      problemCategory: problemCategory.value,
      isSecondRepair: isSecondRepair.value,
      deliveryDate: deliveryDate.value.trim() || null,
      repairDate: repairDate.value.trim() || null,
      status: status.value,
    })
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
      <h2 class="text-lg font-semibold text-foreground">編輯報修</h2>
      <p class="mt-0.5 text-sm text-muted-foreground">修改報修資料與狀態</p>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" aria-hidden />
      <p class="mt-2 text-sm text-muted-foreground">載入中...</p>
    </div>

    <div
      v-else-if="notFound"
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center"
    >
      <p class="text-sm text-muted-foreground">找不到該筆報修</p>
    </div>

    <form v-else class="flex flex-1 flex-col gap-4" @submit.prevent="submit">
      <div class="space-y-2">
        <Label for="customerName" class="text-foreground">客戶姓名 <span class="text-destructive">*</span></Label>
        <input
          id="customerName"
          v-model="customerName"
          type="text"
          autocomplete="name"
          class="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
          class="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div class="space-y-2">
        <Label for="repairContent" class="text-foreground">報修內容 <span class="text-destructive">*</span></Label>
        <textarea
          id="repairContent"
          v-model="repairContent"
          rows="4"
          class="min-h-24 w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div class="space-y-2">
        <Label for="unitLabel" class="text-foreground">戶別（選填）</Label>
        <input
          id="unitLabel"
          v-model="unitLabel"
          type="text"
          class="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div class="space-y-2">
        <Label for="remarks" class="text-foreground">備註（選填）</Label>
        <textarea
          id="remarks"
          v-model="remarks"
          rows="2"
          class="min-h-[4.5rem] w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
          <span v-else>儲存</span>
        </Button>
      </div>
    </form>
  </div>
</template>
