<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Building2,
  FileText,
  CalendarRange,
  User,
  Pencil,
  Loader2,
} from 'lucide-vue-next'
import { getProject, updateProject } from '@/api/project'
import type { ProjectDetail } from '@/types'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { ensureProjectPermission } from '@/lib/permission-toast'

const route = useRoute()

function getProjectId(): string {
  return (route.params.projectId as string) ?? ''
}

const projectId = computed(() => getProjectId())
const overviewPerm = useProjectModuleActions(projectId, 'project.overview')
/** 頂層給模板用，v-if 才會正確解包；勿寫 v-if="overviewPerm.canUpdate"（巢狀 Computed 可能恆為真） */
const canUpdateOverview = overviewPerm.canUpdate

const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')

/** 預設唯讀；按「編輯」進入表單，按「儲存」送出後回到唯讀 */
const isEditMode = ref(false)

/** 表單資料（預定完工 = 開工+工期，預定竣工 = 開工+工期+調整天數，由 API 回傳） */
const form = ref({
  projectName: '',
  designUnit: '',
  supervisionUnit: '',
  contractor: '',
  summary: '',
  benefits: '',
  startDate: '',
  plannedDurationDays: '' as number | string,
  plannedEndDate: '',
  revisedEndDate: '',
  siteManager: '',
  contactPhone: '',
  projectStaff: '',
})

/** 用於顯示的空白佔位 */
const emptyPlaceholder = '—'

function displayValue(value: string | undefined): string {
  return value?.trim() || emptyPlaceholder
}

/** 預定完工日期 = 開工 + 工期（僅顯示用） */
const computedPlannedEndDisplay = computed(() => {
  const start = form.value.startDate?.trim()
  const days = form.value.plannedDurationDays
  if (!start || days === '' || (typeof days === 'number' && days < 0)) return ''
  const d = new Date(start)
  if (Number.isNaN(d.getTime())) return ''
  const numDays = typeof days === 'number' ? days : parseInt(String(days), 10)
  if (Number.isNaN(numDays) || numDays < 0) return ''
  d.setDate(d.getDate() + numDays)
  return d.toISOString().slice(0, 10)
})

/** 預定竣工（依工期調整）：API 回傳的 revisedEndDate，無則顯示預定完工 */
const effectivePlannedEndDisplay = computed(() => {
  const revised = form.value.revisedEndDate?.trim()
  const planned = form.value.plannedEndDate?.trim()
  const computed = computedPlannedEndDisplay.value
  const effective = revised || planned || computed
  return displayValue(effective)
})

/** 工期區塊副說明：預定完工 = 開工+工期；預定竣工 = 開工+工期+調整天數 */
const plannedEndSubtext = computed(() => {
  const planned = form.value.plannedEndDate?.trim()
  const revised = form.value.revisedEndDate?.trim()
  const computed = computedPlannedEndDisplay.value
  const parts: string[] = []
  if (computed) parts.push(`預定完工 ${computed}（開工+工期）`)
  if (revised && revised !== computed) parts.push(`預定竣工 ${revised}`)
  if (!revised && planned && planned !== computed) parts.push(`原訂 ${planned}`)
  return parts.join(' · ')
})

function dateToInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function fillForm(project: ProjectDetail) {
  form.value = {
    projectName: project.name ?? '',
    designUnit: project.designUnit ?? '',
    supervisionUnit: project.supervisionUnit ?? '',
    contractor: project.contractor ?? '',
    summary: project.summary ?? '',
    benefits: project.benefits ?? '',
    startDate: dateToInputValue(project.startDate),
    plannedDurationDays: project.plannedDurationDays ?? '',
    plannedEndDate: dateToInputValue(project.plannedEndDate),
    revisedEndDate: dateToInputValue(project.revisedEndDate),
    siteManager: project.siteManager ?? '',
    contactPhone: project.contactPhone ?? '',
    projectStaff: project.projectStaff ?? '',
  }
}

async function loadProject() {
  const id = getProjectId()
  if (!id) return
  loading.value = true
  errorMessage.value = ''
  try {
    const project = await getProject(id)
    if (project) {
      fillForm(project)
      isEditMode.value = false
    }
  } catch {
    errorMessage.value = '無法載入專案資料'
  } finally {
    loading.value = false
  }
}

onMounted(loadProject)
watch(() => route.params.projectId, () => loadProject())

watch(
  () => canUpdateOverview.value,
  (can) => {
    if (!can) isEditMode.value = false
  }
)

function enterEditMode() {
  if (!ensureProjectPermission(canUpdateOverview.value, 'change')) return
  isEditMode.value = true
}

function onPrimaryAction() {
  if (isEditMode.value) void save()
  else enterEditMode()
}

async function save() {
  if (!ensureProjectPermission(canUpdateOverview.value, 'change')) return
  const id = getProjectId()
  if (!id) return
  if (!form.value.projectName.trim()) {
    errorMessage.value = '請輸入工程名稱'
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    await updateProject(id, {
      name: form.value.projectName.trim() || undefined,
      designUnit: form.value.designUnit.trim() || null,
      supervisionUnit: form.value.supervisionUnit.trim() || null,
      contractor: form.value.contractor.trim() || null,
      summary: form.value.summary.trim() || null,
      benefits: form.value.benefits.trim() || null,
      startDate: form.value.startDate || null,
      plannedDurationDays: form.value.plannedDurationDays === '' ? null : Number(form.value.plannedDurationDays),
      siteManager: form.value.siteManager.trim() || null,
      contactPhone: form.value.contactPhone.trim() || null,
      projectStaff: form.value.projectStaff.trim() || null,
    })
    isEditMode.value = false
    await loadProject()
  } catch (err: unknown) {
    const res =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        : null
    errorMessage.value = res?.message ?? '儲存失敗'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- 頁首：標題 + 編輯／儲存單鍵切換 -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-xl font-semibold tracking-tight text-foreground">
          專案資料
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          契約專案之基本資料、工期與聯絡資訊
        </p>
      </div>
      <Button
        v-if="canUpdateOverview"
        variant="default"
        class="shrink-0 gap-2"
        :disabled="saving"
        @click="onPrimaryAction"
      >
        <Loader2 v-if="saving" class="size-4 animate-spin" />
        <Pencil v-else-if="!isEditMode" class="size-4" />
        {{ saving ? '儲存中…' : isEditMode ? '儲存' : '編輯' }}
      </Button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>
    <p v-else-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

    <template v-else>
    <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
    <!-- 基本資訊 -->
    <Card class="overflow-hidden border-border">
      <CardHeader class="border-b border-border/50 bg-muted/20 pb-4">
        <div class="flex items-center gap-2">
          <div class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 class="size-5" />
          </div>
          <div>
            <CardTitle class="text-base">基本資訊</CardTitle>
            <CardDescription>工程與參與單位</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent class="grid gap-6 pt-6 sm:grid-cols-2">
        <template v-if="!isEditMode || !canUpdateOverview">
          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">工程名稱</p>
            <p class="text-sm font-medium text-foreground">{{ displayValue(form.projectName) }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">設計單位</p>
            <p class="text-sm font-medium text-foreground">{{ displayValue(form.designUnit) }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">監造單位</p>
            <p class="text-sm font-medium text-foreground">{{ displayValue(form.supervisionUnit) }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">施工廠商</p>
            <p class="text-sm font-medium text-foreground">{{ displayValue(form.contractor) }}</p>
          </div>
        </template>
        <template v-else>
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">工程名稱</label>
            <Input v-model="form.projectName" placeholder="請輸入工程名稱" class="mt-0.5" />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">設計單位</label>
            <Input v-model="form.designUnit" placeholder="請輸入設計單位" class="mt-0.5" />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">監造單位</label>
            <Input v-model="form.supervisionUnit" placeholder="請輸入監造單位" class="mt-0.5" />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">施工廠商</label>
            <Input v-model="form.contractor" placeholder="請輸入施工廠商" class="mt-0.5" />
          </div>
        </template>
      </CardContent>
    </Card>

    <!-- 工程內容 -->
    <Card class="overflow-hidden border-border">
      <CardHeader class="border-b border-border/50 bg-muted/20 pb-4">
        <div class="flex items-center gap-2">
          <div class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText class="size-5" />
          </div>
          <div>
            <CardTitle class="text-base">工程內容</CardTitle>
            <CardDescription>概要與效益</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent class="space-y-6 pt-6">
        <template v-if="!isEditMode || !canUpdateOverview">
          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">工程概要</p>
            <p class="text-sm leading-relaxed text-foreground whitespace-pre-line">{{ displayValue(form.summary) }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">工程效益</p>
            <p class="text-sm leading-relaxed text-foreground whitespace-pre-line">{{ displayValue(form.benefits) }}</p>
          </div>
        </template>
        <template v-else>
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">工程概要</label>
            <textarea
              v-model="form.summary"
              placeholder="請輸入工程概要"
              rows="3"
              class="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px] disabled:opacity-50"
            />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">工程效益</label>
            <textarea
              v-model="form.benefits"
              placeholder="請輸入工程效益"
              rows="3"
              class="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px] disabled:opacity-50"
            />
          </div>
        </template>
      </CardContent>
    </Card>

    <!-- 工期 -->
    <Card class="overflow-hidden border-border">
      <CardHeader class="border-b border-border/50 bg-muted/20 pb-4">
        <div class="flex items-center gap-2">
          <div class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarRange class="size-5" />
          </div>
          <div>
            <CardTitle class="text-base">工期</CardTitle>
            <CardDescription>開竣工日期</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent class="grid gap-6 pt-6 sm:grid-cols-2">
        <template v-if="!isEditMode || !canUpdateOverview">
          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">開工日期</p>
            <p class="text-sm font-medium text-foreground">{{ displayValue(form.startDate) }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">工期（天）</p>
            <p class="text-sm font-medium text-foreground">{{ form.plannedDurationDays !== '' ? form.plannedDurationDays : emptyPlaceholder }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">預定完工日期</p>
            <p class="text-sm font-medium text-foreground">{{ displayValue(computedPlannedEndDisplay) || emptyPlaceholder }}</p>
            <p class="mt-0.5 text-xs text-muted-foreground">開工 + 工期</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">預定竣工（依工期調整）</p>
            <p class="text-sm font-medium text-foreground">{{ effectivePlannedEndDisplay }}</p>
            <p v-if="plannedEndSubtext" class="mt-0.5 text-xs text-muted-foreground">{{ plannedEndSubtext }}</p>
          </div>
        </template>
        <template v-else>
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">開工日期</label>
            <Input v-model="form.startDate" type="date" class="mt-0.5" />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">工期（天）</label>
            <Input
              v-model="form.plannedDurationDays"
              type="number"
              min="0"
              step="1"
              placeholder="開工後天數"
              class="mt-0.5"
            />
            <p class="mt-0.5 text-xs text-muted-foreground">預定完工 = 開工 + 工期；預定竣工 = 開工 + 工期 + 工期調整</p>
          </div>
        </template>
      </CardContent>
    </Card>

    <!-- 聯絡與人員 -->
    <Card class="overflow-hidden border-border">
      <CardHeader class="border-b border-border/50 bg-muted/20 pb-4">
        <div class="flex items-center gap-2">
          <div class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <User class="size-5" />
          </div>
          <div>
            <CardTitle class="text-base">聯絡與人員</CardTitle>
            <CardDescription>工地負責人與專案人員</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent class="grid gap-6 pt-6 sm:grid-cols-2">
        <template v-if="!isEditMode || !canUpdateOverview">
          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">工地負責人</p>
            <p class="text-sm font-medium text-foreground">{{ displayValue(form.siteManager) }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">聯絡電話</p>
            <p class="text-sm font-medium text-foreground">{{ displayValue(form.contactPhone) }}</p>
          </div>
          <div class="space-y-1 sm:col-span-2">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">專案工程人員</p>
            <p class="text-sm leading-relaxed text-foreground">{{ displayValue(form.projectStaff) }}</p>
          </div>
        </template>
        <template v-else>
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">工地負責人</label>
            <Input v-model="form.siteManager" placeholder="請輸入工地負責人" class="mt-0.5" />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">聯絡電話</label>
            <Input v-model="form.contactPhone" placeholder="請輸入聯絡電話" type="tel" class="mt-0.5" />
          </div>
          <div class="space-y-2 sm:col-span-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">專案工程人員</label>
            <textarea
              v-model="form.projectStaff"
              placeholder="請輸入專案工程人員，多人可用逗號或換行分隔"
              rows="2"
              class="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px] disabled:opacity-50"
            />
          </div>
        </template>
      </CardContent>
    </Card>

    </template>
  </div>
</template>
