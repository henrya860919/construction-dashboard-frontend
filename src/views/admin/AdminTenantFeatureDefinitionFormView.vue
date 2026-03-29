<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import { useFeatureDefinitionsStore } from '@/stores/featureDefinitions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  listAdminTenantFeatureDefinitions,
  createAdminTenantFeatureDefinition,
  updateAdminTenantFeatureDefinition,
  type TenantFeatureDefinitionAdminRow,
} from '@/api/tenant-feature-definitions'
import {
  listElectronicFormDefinitions,
  type ElectronicFormDefinitionListItem,
} from '@/api/electronic-form-definitions'
import { SYSTEM_MODULES } from '@/constants/modules'
import { ROUTE_NAME } from '@/constants/routes'
import { Loader2 } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const adminStore = useAdminStore()
const featureDefinitionsStore = useFeatureDefinitionsStore()

const isNew = computed(() => route.name === ROUTE_NAME.ADMIN_TENANT_FEATURE_DEFINITION_NEW)
const editFeatureId = computed(() => route.params.featureId as string | undefined)

const tenantIdQuery = computed(() => {
  if (authStore.isPlatformAdmin) return adminStore.selectedTenantId ?? undefined
  return authStore.user?.tenantId ?? undefined
})

const pageLoading = ref(true)
const formsLoading = ref(false)
const formOptions = ref<ElectronicFormDefinitionListItem[]>([])
const submitLoading = ref(false)
const formError = ref('')
const loadRowError = ref('')

const formName = ref('')
const formDescription = ref('')
const formSystemModule = ref('engineering')
const formFormId = ref('')
const formCloseFormId = ref('__none__')
const formStatus = ref<'active' | 'inactive'>('active')
const formSortOrderInput = ref('')

function formStatusLabel(status: string): string {
  if (status === 'draft') return '草稿'
  if (status === 'published') return '已發布'
  if (status === 'archived') return '已封存'
  return status
}

async function refreshFeatureCaches() {
  await Promise.all(
    (['engineering', 'procurement', 'hr', 'finance'] as const).map((m) =>
      featureDefinitionsStore.refresh(m)
    )
  )
}

async function loadForms() {
  const tid = tenantIdQuery.value
  if (authStore.isPlatformAdmin && !tid) {
    formOptions.value = []
    return
  }
  formsLoading.value = true
  try {
    const res = await listElectronicFormDefinitions(tid, { page: 1, limit: 200 })
    formOptions.value = res.items
  } catch {
    formOptions.value = []
  } finally {
    formsLoading.value = false
  }
}

function resetFormForCreate() {
  formName.value = ''
  formDescription.value = ''
  formSystemModule.value = 'engineering'
  formFormId.value = ''
  formCloseFormId.value = '__none__'
  formStatus.value = 'active'
  formSortOrderInput.value = ''
  formError.value = ''
  loadRowError.value = ''
}

function applyRow(row: TenantFeatureDefinitionAdminRow) {
  formName.value = row.name
  formDescription.value = row.description ?? ''
  formSystemModule.value = row.systemModule
  formFormId.value = row.formId ?? ''
  formCloseFormId.value = row.closeFormId ?? '__none__'
  formStatus.value = row.status === 'inactive' ? 'inactive' : 'active'
  formSortOrderInput.value = String(row.tenantSortOrder)
  formError.value = ''
  loadRowError.value = ''
}

async function loadEditRow() {
  const tid = tenantIdQuery.value
  const id = editFeatureId.value
  if (!id) {
    loadRowError.value = '無效的功能編號'
    pageLoading.value = false
    return
  }
  pageLoading.value = true
  loadRowError.value = ''
  try {
    const rows = await listAdminTenantFeatureDefinitions(tid)
    const row = rows.find((r) => r.id === id)
    if (!row) {
      loadRowError.value = '找不到此自訂功能，可能已刪除。'
      return
    }
    applyRow(row)
  } catch {
    loadRowError.value = '無法載入功能資料'
  } finally {
    pageLoading.value = false
  }
}

async function initPage() {
  const tid = tenantIdQuery.value
  if (authStore.isPlatformAdmin && !tid) {
    pageLoading.value = false
    loadRowError.value = '請先於平台後台選擇租戶'
    return
  }
  loadRowError.value = ''
  if (isNew.value) {
    resetFormForCreate()
    pageLoading.value = false
    await loadForms()
    return
  }
  await Promise.all([loadForms(), loadEditRow()])
}

watch(
  () => [isNew.value, editFeatureId.value, tenantIdQuery.value] as const,
  () => {
    void initPage()
  }
)

onMounted(() => {
  void initPage()
})

function goBack() {
  router.push({ name: ROUTE_NAME.ADMIN_TENANT_FEATURE_DEFINITIONS })
}

async function submit() {
  const tid = tenantIdQuery.value
  if (authStore.isPlatformAdmin && !tid) {
    formError.value = '請先選擇租戶'
    return
  }
  const name = formName.value.trim()
  if (!name) {
    formError.value = '請輸入功能名稱'
    return
  }
  if (!formFormId.value) {
    formError.value = '請選擇綁定的電子表單'
    return
  }
  formError.value = ''
  const sortRaw = formSortOrderInput.value.trim()
  let tenantSortOrder: number | undefined
  if (sortRaw !== '') {
    const n = Number.parseInt(sortRaw, 10)
    if (Number.isNaN(n) || n < 0) {
      formError.value = '排序須為非負整數'
      return
    }
    tenantSortOrder = n
  }
  submitLoading.value = true
  try {
    const closeId = formCloseFormId.value === '__none__' ? null : formCloseFormId.value
    if (isNew.value) {
      await createAdminTenantFeatureDefinition(tid, {
        name,
        description: formDescription.value.trim() || null,
        systemModule: formSystemModule.value,
        formId: formFormId.value,
        closeFormId: closeId,
        ...(tenantSortOrder !== undefined ? { tenantSortOrder } : {}),
      })
    } else if (editFeatureId.value) {
      await updateAdminTenantFeatureDefinition(tid, editFeatureId.value, {
        name,
        description: formDescription.value.trim() || null,
        systemModule: formSystemModule.value,
        formId: formFormId.value,
        closeFormId: closeId,
        status: formStatus.value,
        ...(tenantSortOrder !== undefined ? { tenantSortOrder } : {}),
      })
    }
    await refreshFeatureCaches()
    await router.push({ name: ROUTE_NAME.ADMIN_TENANT_FEATURE_DEFINITIONS })
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message
        : null
    formError.value = msg ?? '儲存失敗'
  } finally {
    submitLoading.value = false
  }
}

const pageTitle = computed(() => (isNew.value ? '新增自訂功能' : '編輯自訂功能'))
const formDisabled = computed(() => pageLoading.value && !isNew.value)
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">{{ pageTitle }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        必須選擇一張同租戶的電子表單；可先至「電子表單」建立並發布表單定義。
      </p>
    </div>

    <div v-if="pageLoading && !isNew" class="flex items-center justify-center py-12 text-muted-foreground">
      <Loader2 class="size-8 animate-spin" />
    </div>

    <div
      v-else-if="loadRowError"
      class="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground"
    >
      {{ loadRowError }}
      <div class="mt-4">
        <Button variant="outline" size="sm" @click="goBack">返回列表</Button>
      </div>
    </div>

    <div v-else class="rounded-lg border border-border bg-card p-6">
      <div class="mx-auto grid max-w-md gap-4">
        <div class="grid gap-2">
          <Label for="tf-name">功能名稱</Label>
          <Input
            id="tf-name"
            v-model="formName"
            placeholder="例：材料進場申請"
            class="bg-background"
            :disabled="formDisabled"
          />
        </div>
        <div class="grid gap-2">
          <Label for="tf-desc">說明（選填）</Label>
          <Input
            id="tf-desc"
            v-model="formDescription"
            placeholder="簡短說明"
            class="bg-background"
            :disabled="formDisabled"
          />
        </div>
        <div class="grid gap-2">
          <Label>系統模組</Label>
          <Select v-model="formSystemModule" :disabled="formDisabled">
            <SelectTrigger class="bg-background">
              <SelectValue placeholder="選擇模組" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="m in SYSTEM_MODULES" :key="m.key" :value="m.key">
                {{ m.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="grid gap-2">
          <Label>綁定電子表單</Label>
          <Select v-model="formFormId" :disabled="formDisabled || formsLoading">
            <SelectTrigger class="bg-background">
              <SelectValue placeholder="選擇表單" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="f in formOptions"
                :key="f.id"
                :value="f.id"
                class="whitespace-normal"
              >
                {{ f.name }}（{{ formStatusLabel(f.status) }}）
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="formsLoading" class="text-xs text-muted-foreground">載入表單列表中…</p>
        </div>
        <div class="grid gap-2">
          <Label>結案表單（選填）</Label>
          <Select v-model="formCloseFormId" :disabled="formDisabled || formsLoading">
            <SelectTrigger class="bg-background">
              <SelectValue placeholder="無" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">無</SelectItem>
              <SelectItem
                v-for="f in formOptions"
                :key="`close-${f.id}`"
                :value="f.id"
                class="whitespace-normal"
              >
                {{ f.name }}（{{ formStatusLabel(f.status) }}）
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div v-if="!isNew" class="grid gap-2">
          <Label>功能狀態</Label>
          <Select v-model="formStatus" :disabled="formDisabled">
            <SelectTrigger class="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">啟用（顯示於側欄）</SelectItem>
              <SelectItem value="inactive">停用（隱藏）</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="grid gap-2">
          <Label for="tf-sort">排序數字（選填，愈小愈前）</Label>
          <Input
            id="tf-sort"
            v-model="formSortOrderInput"
            type="number"
            min="0"
            class="bg-background tabular-nums"
            :disabled="formDisabled"
          />
        </div>
        <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>

        <div class="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="outline" :disabled="submitLoading" @click="goBack">
            取消
          </Button>
          <Button type="button" :disabled="submitLoading || formDisabled" @click="submit">
            <Loader2 v-if="submitLoading" class="mr-2 size-4 animate-spin" />
            儲存
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
