<script setup lang="ts">
import { ref, computed, watch, onUnmounted, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2 } from 'lucide-vue-next'
import {
  getProjectSelfInspectionTemplateHub,
  createProjectSelfInspectionRecord,
} from '@/api/project-self-inspections'
import type { ProjectSelfInspectionTemplateHub } from '@/api/project-self-inspections'
import type { FilledPayload } from '@/api/project-self-inspections'
import { ROUTE_NAME } from '@/constants/routes'
import { useSelfCheckBreadcrumbStore } from '@/stores/selfCheckBreadcrumb'
import { useProjectStore } from '@/stores/project'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { ensureProjectPermission, toastPermissionDenied } from '@/lib/permission-toast'

const inputClass =
  'border-input flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
const textareaClass =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[72px] w-full resize-y rounded-md border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

const route = useRoute()
const router = useRouter()
const selfCheckBreadcrumbStore = useSelfCheckBreadcrumbStore()
const projectStore = useProjectStore()

const projectId = computed(() => (route.params.projectId as string) ?? '')
const templateId = computed(() => (route.params.templateId as string) ?? '')
const inspectionPerm = useProjectModuleActions(projectId, 'construction.inspection')

const loading = ref(true)
const loadError = ref('')
const hub = ref<ProjectSelfInspectionTemplateHub | null>(null)

const headerInspectionName = ref('')
const headerProjectName = ref('')
const headerSubProject = ref('')
const headerSubcontractor = ref('')
const headerLocation = ref('')
const headerDate = ref('')
const timingOptionId = ref('')

const itemState = ref<Record<string, { actualText: string; resultOptionId: string }>>({})

const submitting = ref(false)
const submitError = ref('')

const hc = computed(() => hub.value?.template.headerConfig)
const isArchived = computed(() => hub.value?.template.status === 'archived')

const inspectionNameFieldLabel = computed(
  () => hc.value?.inspectionNameLabel?.trim() || '檢查名稱'
)

function applyProjectNamePrefill() {
  const pid = projectId.value
  if (!pid) return
  const fromMap = projectStore.projectNameMap[pid]?.trim()
  const fromCurrent =
    projectStore.currentProjectId === pid ? projectStore.currentProjectName?.trim() : ''
  const name = fromMap || fromCurrent || ''
  if (name) headerProjectName.value = name
}

function initFromHub(h: ProjectSelfInspectionTemplateHub) {
  headerInspectionName.value = ''
  headerProjectName.value = ''
  headerSubProject.value = ''
  headerSubcontractor.value = ''
  headerLocation.value = ''
  headerDate.value = ''
  const next: Record<string, { actualText: string; resultOptionId: string }> = {}
  for (const b of h.blocks) {
    for (const it of b.items) {
      next[it.id] = { actualText: '', resultOptionId: '' }
    }
  }
  itemState.value = next
  const opts = h.template.headerConfig.timingOptions
  timingOptionId.value = opts[0]?.id ?? ''
  applyProjectNamePrefill()
}

async function loadHub() {
  const pid = projectId.value
  const tid = templateId.value
  if (!pid || !tid) return
  loading.value = true
  loadError.value = ''
  hub.value = null
  selfCheckBreadcrumbStore.setTemplateTitle(null)
  try {
    const data = await getProjectSelfInspectionTemplateHub(pid, tid)
    hub.value = data
    selfCheckBreadcrumbStore.setTemplateTitle(data.template.name)
    initFromHub(data)
  } catch {
    loadError.value = '無法載入樣板'
  } finally {
    loading.value = false
  }
}

watch(
  [projectId, templateId],
  () => {
    loadHub()
  },
  { immediate: true }
)

function goBack() {
  router.push({
    name: ROUTE_NAME.PROJECT_CONSTRUCTION_SELF_CHECK_TEMPLATE,
    params: { projectId: projectId.value, templateId: templateId.value },
  })
}

async function submit() {
  if (!ensureProjectPermission(inspectionPerm.canCreate.value, 'create')) return
  const pid = projectId.value
  const tid = templateId.value
  const h = hub.value
  if (!pid || !tid || !h || isArchived.value) return
  submitting.value = true
  submitError.value = ''
  const header: FilledPayload['header'] = {
    inspectionName: headerInspectionName.value.trim() || undefined,
    projectName: headerProjectName.value.trim() || undefined,
    subProjectName: headerSubProject.value.trim() || undefined,
    subcontractor: headerSubcontractor.value.trim() || undefined,
    inspectionLocation: headerLocation.value.trim() || undefined,
    inspectionDate: headerDate.value.trim() || undefined,
    timingOptionId: timingOptionId.value.trim() || undefined,
  }
  const items: NonNullable<FilledPayload['items']> = {}
  for (const [id, row] of Object.entries(itemState.value)) {
    const at = row.actualText.trim()
    const rid = row.resultOptionId.trim()
    if (at || rid) {
      items[id] = {
        ...(at ? { actualText: at } : {}),
        ...(rid ? { resultOptionId: rid } : {}),
      }
    }
  }
  const filledPayload: FilledPayload = {
    header,
    ...(Object.keys(items).length ? { items } : {}),
  }
  try {
    const created = await createProjectSelfInspectionRecord(pid, tid, { filledPayload })
    router.push({
      name: ROUTE_NAME.PROJECT_CONSTRUCTION_SELF_CHECK_RECORD,
      params: { projectId: pid, templateId: tid, recordId: created.id },
    })
  } catch {
    submitError.value = '送出失敗，請稍後再試'
  } finally {
    submitting.value = false
  }
}

onUnmounted(() => {
  selfCheckBreadcrumbStore.setTemplateTitle(null)
})

const createDeniedToastShown = ref(false)
watchEffect(() => {
  if (loading.value || loadError.value || !hub.value) return
  if (!inspectionPerm.canCreate.value && !createDeniedToastShown.value) {
    createDeniedToastShown.value = true
    toastPermissionDenied('create')
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-3">
      <Button variant="outline" type="button" class="gap-1.5" @click="goBack">
        <ArrowLeft class="size-4" />
        返回
      </Button>
      <h1 class="text-xl font-semibold text-foreground">新增查驗紀錄</h1>
    </div>

    <div v-if="loading" class="flex items-center gap-2 text-muted-foreground">
      <Loader2 class="size-5 animate-spin" />
      載入樣板…
    </div>

    <div
      v-else-if="loadError"
      class="rounded-lg border border-destructive/50 bg-card px-4 py-3 text-sm text-destructive"
    >
      {{ loadError }}
    </div>

    <template v-else-if="hub && hc">
      <div
        v-if="isArchived"
        class="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground"
      >
        此樣板已封存，無法新增查驗紀錄；仍可從紀錄列表檢視歷史資料。
      </div>

      <div class="space-y-6 rounded-lg border border-border bg-card p-4 md:p-6">
        <h2 class="text-lg font-medium text-foreground">表頭資料</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2 sm:col-span-2">
            <Label :for="'sin-insp'">{{ inspectionNameFieldLabel }}</Label>
            <Input
              id="sin-insp"
              v-model="headerInspectionName"
              :disabled="isArchived"
              :class="inputClass"
            />
          </div>
          <div class="space-y-2">
            <Label :for="'sin-pn'">{{ hc.projectNameLabel }}</Label>
            <Input
              id="sin-pn"
              v-model="headerProjectName"
              :disabled="isArchived"
              :class="inputClass"
            />
          </div>
          <div class="space-y-2">
            <Label :for="'sin-sp'">{{ hc.subProjectLabel }}</Label>
            <Input
              id="sin-sp"
              v-model="headerSubProject"
              :disabled="isArchived"
              :class="inputClass"
            />
          </div>
          <div class="space-y-2">
            <Label :for="'sin-sc'">{{ hc.subcontractorLabel }}</Label>
            <Input
              id="sin-sc"
              v-model="headerSubcontractor"
              :disabled="isArchived"
              :class="inputClass"
            />
          </div>
          <div class="space-y-2">
            <Label :for="'sin-loc'">{{ hc.inspectionLocationLabel }}</Label>
            <Input
              id="sin-loc"
              v-model="headerLocation"
              :disabled="isArchived"
              :class="inputClass"
            />
          </div>
          <div class="space-y-2">
            <Label :for="'sin-dt'">{{ hc.inspectionDateLabel }}</Label>
            <Input
              id="sin-dt"
              v-model="headerDate"
              type="date"
              :disabled="isArchived"
              :class="inputClass"
            />
          </div>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-medium text-foreground">{{ hc.timingSectionLabel }}</p>
          <div class="flex flex-wrap gap-4" role="radiogroup" :aria-label="hc.timingSectionLabel">
            <label
              v-for="opt in hc.timingOptions"
              :key="opt.id"
              class="flex cursor-pointer items-center gap-2 text-sm text-foreground"
            >
              <input
                v-model="timingOptionId"
                type="radio"
                name="timing-opt"
                :value="opt.id"
                :disabled="isArchived"
                class="size-4 accent-primary"
              />
              {{ opt.label }}
            </label>
          </div>
        </div>

        <p class="text-xs text-muted-foreground">{{ hc.resultSectionLabel }}（各列擇一）</p>
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
                <td class="px-3 py-2">
                  <textarea
                    v-model="itemState[it.id].actualText"
                    :disabled="isArchived"
                    :class="textareaClass"
                    rows="2"
                  />
                </td>
                <td class="px-3 py-2">
                  <div class="flex flex-col gap-2" role="radiogroup" :aria-label="it.itemName">
                    <label
                      v-for="opt in hc.resultLegendOptions"
                      :key="opt.id"
                      class="flex cursor-pointer items-center gap-2 text-foreground"
                    >
                      <input
                        v-model="itemState[it.id].resultOptionId"
                        type="radio"
                        :name="`res-${it.id}`"
                        :value="opt.id"
                        :disabled="isArchived"
                        class="size-4 accent-primary"
                      />
                      <span class="text-xs sm:text-sm">{{ opt.label }}</span>
                    </label>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="submitError" class="text-sm text-destructive">{{ submitError }}</div>

      <div class="flex flex-wrap gap-3">
        <Button type="button" variant="outline" :disabled="submitting" @click="goBack">
          取消
        </Button>
        <Button
          type="button"
          :disabled="submitting || isArchived"
          @click="submit"
        >
          <Loader2 v-if="submitting" class="mr-2 size-4 animate-spin" />
          送出紀錄
        </Button>
      </div>
    </template>
  </div>
</template>
