<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  getProjectSelfInspectionTemplateHub,
  createProjectSelfInspectionRecord,
} from '@/api/project-self-inspections'
import type { ProjectSelfInspectionTemplateHub } from '@/api/project-self-inspections'
import type { FilledPayload } from '@/api/project-self-inspections'
import { useProjectStore } from '@/stores/project'
import { useMobileSelfInspectionNavStore } from '@/stores/mobileSelfInspectionNav'

defineOptions({ name: 'MobileSelfInspectionRecordNewView' })

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const navStore = useMobileSelfInspectionNavStore()

const projectId = computed(() => (route.params.projectId as string) ?? '')
const templateId = computed(() => (route.params.templateId as string) ?? '')

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
  navStore.setTemplateTitle(null)
  try {
    const data = await getProjectSelfInspectionTemplateHub(pid, tid)
    hub.value = data
    navStore.setTemplateTitle(data.template.name)
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
  router.back()
}

async function submit() {
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
    await createProjectSelfInspectionRecord(pid, tid, { filledPayload })
    router.back()
  } catch {
    submitError.value = '送出失敗，請稍後再試'
  } finally {
    submitting.value = false
  }
}

onUnmounted(() => {
  navStore.setTemplateTitle(null)
})
</script>

<template>
  <div class="mobile-page min-h-full px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-2">
    <div v-if="loading" class="flex flex-col items-center py-16">
      <Loader2 class="size-8 animate-spin text-muted-foreground" aria-hidden />
      <p class="mt-2 text-sm text-muted-foreground">載入樣板…</p>
    </div>

    <div
      v-else-if="loadError"
      class="rounded-xl border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive"
    >
      {{ loadError }}
    </div>

    <form v-else-if="hub && hc" class="space-y-6" @submit.prevent="submit">
      <div
        v-if="isArchived"
        class="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground"
      >
        此樣板已封存，無法新增查驗紀錄。
      </div>

      <section v-else class="space-y-4 rounded-xl border border-border bg-card p-4">
        <h3 class="text-base font-semibold text-foreground">表頭</h3>

        <div class="space-y-2">
          <Label :for="'m-sin-insp'" class="text-foreground">{{ inspectionNameFieldLabel }}</Label>
          <input
            id="m-sin-insp"
            v-model="headerInspectionName"
            type="text"
            class="field-input"
            :placeholder="inspectionNameFieldLabel"
          />
        </div>
        <div class="space-y-2">
          <Label :for="'m-sin-pn'" class="text-foreground">{{ hc.projectNameLabel }}</Label>
          <input id="m-sin-pn" v-model="headerProjectName" type="text" class="field-input" />
        </div>
        <div class="space-y-2">
          <Label :for="'m-sin-sp'" class="text-foreground">{{ hc.subProjectLabel }}</Label>
          <input id="m-sin-sp" v-model="headerSubProject" type="text" class="field-input" />
        </div>
        <div class="space-y-2">
          <Label :for="'m-sin-sc'" class="text-foreground">{{ hc.subcontractorLabel }}</Label>
          <input id="m-sin-sc" v-model="headerSubcontractor" type="text" class="field-input" />
        </div>
        <div class="space-y-2">
          <Label :for="'m-sin-loc'" class="text-foreground">{{ hc.inspectionLocationLabel }}</Label>
          <input id="m-sin-loc" v-model="headerLocation" type="text" class="field-input" />
        </div>
        <div class="space-y-2">
          <Label :for="'m-sin-dt'" class="text-foreground">{{ hc.inspectionDateLabel }}</Label>
          <input id="m-sin-dt" v-model="headerDate" type="date" class="field-input" />
        </div>

        <div class="space-y-2">
          <p class="text-sm font-medium text-foreground">{{ hc.timingSectionLabel }}</p>
          <div class="flex flex-col gap-2" role="radiogroup" :aria-label="hc.timingSectionLabel">
            <label
              v-for="opt in hc.timingOptions"
              :key="opt.id"
              class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground touch-manipulation has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                v-model="timingOptionId"
                type="radio"
                name="m-timing-opt"
                :value="opt.id"
                class="size-4 accent-primary"
              />
              {{ opt.label }}
            </label>
          </div>
        </div>
      </section>

      <template v-if="!isArchived">
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

          <p class="text-xs text-muted-foreground">{{ hc.resultSectionLabel }}（每項擇一）</p>

          <div
            v-for="it in block.items"
            :key="it.id"
            class="space-y-3 rounded-lg border border-border/80 bg-background/80 p-3"
          >
            <div>
              <p class="text-xs text-muted-foreground">{{ it.categoryLabel }}</p>
              <p class="text-sm font-medium text-foreground">{{ it.itemName }}</p>
            </div>
            <div>
              <p class="text-xs font-medium text-muted-foreground">規範標準</p>
              <p class="text-sm text-foreground">{{ it.standardText }}</p>
            </div>
            <div class="space-y-2">
              <Label :for="'m-act-' + it.id" class="text-foreground">實際情形</Label>
              <textarea
                :id="'m-act-' + it.id"
                v-model="itemState[it.id].actualText"
                rows="2"
                class="field-textarea"
                placeholder="選填"
              />
            </div>
            <div class="space-y-2">
              <p class="text-sm font-medium text-foreground">{{ hc.resultSectionLabel }}</p>
              <div class="flex flex-col gap-2" role="radiogroup" :aria-label="it.itemName">
                <label
                  v-for="opt in hc.resultLegendOptions"
                  :key="opt.id"
                  class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground touch-manipulation has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    v-model="itemState[it.id].resultOptionId"
                    type="radio"
                    :name="'m-res-' + it.id"
                    :value="opt.id"
                    class="size-4 accent-primary"
                  />
                  {{ opt.label }}
                </label>
              </div>
            </div>
          </div>
        </section>
      </template>

      <p v-if="submitError" class="text-sm text-destructive">{{ submitError }}</p>

      <div
        v-if="!isArchived"
        class="form-action-bar border-border bg-card pwa-fixed-bottom"
      >
        <div class="mx-auto flex max-w-lg gap-3 px-4 py-3">
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
            <span v-else>送出紀錄</span>
          </Button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
.field-input,
.field-textarea {
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  background: var(--card);
  padding: 0.625rem 0.75rem;
  font-size: 16px;
  color: var(--foreground);
}
.field-input::placeholder,
.field-textarea::placeholder {
  color: var(--muted-foreground);
}
.field-input:focus,
.field-textarea:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--ring);
}
.field-textarea {
  min-height: 4.5rem;
  resize: none;
}

.form-action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(3.9rem + env(safe-area-inset-bottom, 0px));
  z-index: 25;
  border-top-width: 1px;
  border-top-style: solid;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
