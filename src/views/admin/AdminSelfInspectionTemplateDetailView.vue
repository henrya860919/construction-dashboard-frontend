<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  getSelfInspectionTemplate,
  updateSelfInspectionTemplate,
  deleteSelfInspectionTemplate,
  createSelfInspectionBlock,
  updateSelfInspectionBlock,
  deleteSelfInspectionBlock,
  createSelfInspectionBlockItem,
  updateSelfInspectionBlockItem,
  deleteSelfInspectionBlockItem,
  type SelfInspectionTemplateDetailMeta,
  type SelfInspectionBlockWithItems,
  type SelfInspectionBlockItem,
  type HeaderConfig,
} from '@/api/self-inspection-templates'
import { useAuthStore } from '@/stores/auth'
import { useSelfInspectionTemplateBreadcrumbStore } from '@/stores/selfInspectionTemplateBreadcrumb'
import { ROUTE_NAME } from '@/constants/routes'
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  ArrowLeft,
} from 'lucide-vue-next'

const inputClass =
  'border-input flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
const textareaClass =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[80px] w-full resize-y rounded-md border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const breadcrumbStore = useSelfInspectionTemplateBreadcrumbStore()

const tenantId = computed(() => authStore.user?.tenantId ?? null)
const templateId = computed(() => route.params.templateId as string)

const loading = ref(true)
const loadError = ref('')
const template = ref<SelfInspectionTemplateDetailMeta | null>(null)
const blocks = ref<SelfInspectionBlockWithItems[]>([])

const headerForm = ref<HeaderConfig>({
  inspectionNameLabel: '檢查名稱',
  projectNameLabel: '工程名稱',
  subProjectLabel: '分項工程名稱',
  subcontractorLabel: '協力廠商',
  inspectionLocationLabel: '檢查位置',
  inspectionDateLabel: '檢查日期',
  timingSectionLabel: '檢查時機',
  timingOptions: [
    { id: 'before', label: '施工前' },
    { id: 'during', label: '施工中檢查' },
    { id: 'after', label: '施工完成檢查' },
  ],
  resultSectionLabel: '檢查結果',
  resultLegendOptions: [
    { id: 'pass', label: '○ 檢查合格' },
    { id: 'fail', label: '× 有缺失需改正' },
    { id: 'na', label: '/ 無此檢查項目' },
  ],
})
const headerSaving = ref(false)
const headerError = ref('')

/** 檢查時機「現場預覽」用：radio 單選，與實際填寫行為一致 */
const timingPreviewId = ref('')

watch(
  () => headerForm.value.timingOptions,
  (opts) => {
    if (!opts.length) {
      timingPreviewId.value = ''
      return
    }
    const ids = new Set(opts.map((o) => o.id.trim()).filter(Boolean))
    if (!timingPreviewId.value || !ids.has(timingPreviewId.value)) {
      timingPreviewId.value = opts[0]?.id?.trim() || ''
    }
  },
  { deep: true, immediate: true }
)

/** 檢查結果圖例「現場預覽」用：radio 單選（列填寫時亦同） */
const resultPreviewId = ref('')

watch(
  () => headerForm.value.resultLegendOptions,
  (opts) => {
    if (!opts.length) {
      resultPreviewId.value = ''
      return
    }
    const ids = new Set(opts.map((o) => o.id.trim()).filter(Boolean))
    if (!resultPreviewId.value || !ids.has(resultPreviewId.value)) {
      resultPreviewId.value = opts[0]?.id?.trim() || ''
    }
  },
  { deep: true, immediate: true }
)

const metaDialogOpen = ref(false)
const metaForm = ref({ name: '', description: '', status: 'active' as 'active' | 'archived' })
const metaSaving = ref(false)

const deleteTemplateOpen = ref(false)
const deleteTemplateLoading = ref(false)

const blockDialogOpen = ref(false)
const blockDialogMode = ref<'create' | 'edit'>('create')
const blockEditId = ref<string | null>(null)
const blockForm = ref({ title: '', description: '' })
const blockSaving = ref(false)
const blockError = ref('')

const deleteBlockOpen = ref(false)
const deleteBlockTarget = ref<SelfInspectionBlockWithItems | null>(null)
const deleteBlockLoading = ref(false)

const itemDialogOpen = ref(false)
const itemDialogMode = ref<'create' | 'edit'>('create')
const itemBlockId = ref<string | null>(null)
const itemEditId = ref<string | null>(null)
const itemForm = ref({ categoryLabel: '', itemName: '', standardText: '' })
const itemSaving = ref(false)
const itemError = ref('')

const deleteItemOpen = ref(false)
const deleteItemCtx = ref<{ blockId: string; item: SelfInspectionBlockItem } | null>(null)
const deleteItemLoading = ref(false)

function cloneHeader(c: HeaderConfig): HeaderConfig {
  return {
    ...c,
    inspectionNameLabel: c.inspectionNameLabel?.trim() || '檢查名稱',
    timingOptions: c.timingOptions.map((o) => ({ ...o })),
    resultLegendOptions: c.resultLegendOptions.map((o) => ({ ...o })),
  }
}

function rowsWithCategorySpan(items: SelfInspectionBlockItem[]) {
  const sorted = [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.id.localeCompare(b.id)
  })
  return sorted.map((item, idx) => {
    if (idx > 0 && sorted[idx - 1].categoryLabel === item.categoryLabel) {
      return { item, showCategory: false, categoryRowspan: 0 }
    }
    let span = 1
    for (let j = idx + 1; j < sorted.length; j++) {
      if (sorted[j].categoryLabel === item.categoryLabel) span++
      else break
    }
    return { item, showCategory: true, categoryRowspan: span }
  })
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await getSelfInspectionTemplate(templateId.value, tenantId.value)
    template.value = res.template
    blocks.value = res.blocks
    headerForm.value = cloneHeader(res.template.headerConfig)
    breadcrumbStore.setCurrentTitle(res.template.name)
  } catch {
    loadError.value = '無法載入樣板'
    template.value = null
    blocks.value = []
    breadcrumbStore.setCurrentTitle(null)
  } finally {
    loading.value = false
  }
}

onMounted(() => load())
onUnmounted(() => breadcrumbStore.setCurrentTitle(null))

watch(templateId, () => load())

function openMetaEdit() {
  if (!template.value) return
  metaForm.value = {
    name: template.value.name,
    description: template.value.description ?? '',
    status: template.value.status === 'archived' ? 'archived' : 'active',
  }
  metaDialogOpen.value = true
}

async function submitMeta() {
  if (!template.value) return
  metaSaving.value = true
  try {
    const updated = await updateSelfInspectionTemplate(
      template.value.id,
      {
        name: metaForm.value.name.trim() || undefined,
        description: metaForm.value.description.trim() || null,
        status: metaForm.value.status,
      },
      tenantId.value
    )
    template.value = {
      ...template.value,
      ...updated,
      headerConfig: updated.headerConfig ?? template.value.headerConfig,
    }
    if (updated.headerConfig) {
      headerForm.value = cloneHeader(updated.headerConfig)
    }
    breadcrumbStore.setCurrentTitle(updated.name)
    metaDialogOpen.value = false
  } finally {
    metaSaving.value = false
  }
}

async function saveHeaderConfig() {
  if (!template.value) return
  headerError.value = ''
  for (const opt of headerForm.value.timingOptions) {
    if (!opt.id.trim() || !opt.label.trim()) {
      headerError.value = '檢查時機選項的代碼與文字皆須填寫'
      return
    }
  }
  for (const opt of headerForm.value.resultLegendOptions) {
    if (!opt.id.trim() || !opt.label.trim()) {
      headerError.value = '檢查結果圖例選項的代碼與文字皆須填寫'
      return
    }
  }
  headerSaving.value = true
  try {
    const updated = await updateSelfInspectionTemplate(
      template.value.id,
      { headerConfig: headerForm.value },
      tenantId.value
    )
    if (template.value && updated.headerConfig) {
      template.value = { ...template.value, ...updated, headerConfig: updated.headerConfig }
      headerForm.value = cloneHeader(updated.headerConfig)
    }
  } catch {
    headerError.value = '儲存失敗'
  } finally {
    headerSaving.value = false
  }
}

function addTimingOption() {
  headerForm.value.timingOptions.push({
    id: `opt-${Date.now()}`,
    label: '',
  })
}

function removeTimingOption(index: number) {
  if (headerForm.value.timingOptions.length <= 1) return
  headerForm.value.timingOptions.splice(index, 1)
}

function addResultLegendOption() {
  headerForm.value.resultLegendOptions.push({
    id: `result-${Date.now()}`,
    label: '',
  })
}

function removeResultLegendOption(index: number) {
  if (headerForm.value.resultLegendOptions.length <= 1) return
  headerForm.value.resultLegendOptions.splice(index, 1)
}

async function confirmDeleteTemplate() {
  if (!template.value) return
  deleteTemplateLoading.value = true
  try {
    await deleteSelfInspectionTemplate(template.value.id, tenantId.value)
    deleteTemplateOpen.value = false
    router.push({ name: ROUTE_NAME.ADMIN_SELF_INSPECTION_TEMPLATES })
  } finally {
    deleteTemplateLoading.value = false
  }
}

function openCreateBlock() {
  blockDialogMode.value = 'create'
  blockEditId.value = null
  blockForm.value = { title: '', description: '' }
  blockError.value = ''
  blockDialogOpen.value = true
}

function openEditBlock(b: SelfInspectionBlockWithItems) {
  blockDialogMode.value = 'edit'
  blockEditId.value = b.id
  blockForm.value = { title: b.title, description: b.description ?? '' }
  blockError.value = ''
  blockDialogOpen.value = true
}

async function submitBlock() {
  if (!template.value) return
  if (!blockForm.value.title.trim()) {
    blockError.value = '請填寫區塊標題'
    return
  }
  blockSaving.value = true
  blockError.value = ''
  try {
    if (blockDialogMode.value === 'create') {
      const row = await createSelfInspectionBlock(
        template.value.id,
        {
          title: blockForm.value.title.trim(),
          description: blockForm.value.description.trim() || null,
        },
        tenantId.value
      )
      blocks.value = [...blocks.value, row].sort((a, b) => a.sortOrder - b.sortOrder)
    } else if (blockEditId.value) {
      const row = await updateSelfInspectionBlock(
        template.value.id,
        blockEditId.value,
        {
          title: blockForm.value.title.trim(),
          description: blockForm.value.description.trim() || null,
        },
        tenantId.value
      )
      blocks.value = blocks.value.map((x) => (x.id === row.id ? row : x))
    }
    blockDialogOpen.value = false
    if (template.value) {
      template.value = { ...template.value, blockCount: blocks.value.length }
    }
  } catch {
    blockError.value = '儲存失敗'
  } finally {
    blockSaving.value = false
  }
}

function openDeleteBlock(b: SelfInspectionBlockWithItems) {
  deleteBlockTarget.value = b
  deleteBlockOpen.value = true
}

async function confirmDeleteBlock() {
  if (!template.value || !deleteBlockTarget.value) return
  deleteBlockLoading.value = true
  try {
    await deleteSelfInspectionBlock(
      template.value.id,
      deleteBlockTarget.value.id,
      tenantId.value
    )
    blocks.value = blocks.value.filter((x) => x.id !== deleteBlockTarget.value!.id)
    deleteBlockOpen.value = false
    template.value = { ...template.value, blockCount: blocks.value.length }
  } finally {
    deleteBlockLoading.value = false
  }
}

function openCreateItem(blockId: string) {
  itemDialogMode.value = 'create'
  itemBlockId.value = blockId
  itemEditId.value = null
  itemForm.value = { categoryLabel: '', itemName: '', standardText: '' }
  itemError.value = ''
  itemDialogOpen.value = true
}

function openEditItem(blockId: string, it: SelfInspectionBlockItem) {
  itemDialogMode.value = 'edit'
  itemBlockId.value = blockId
  itemEditId.value = it.id
  itemForm.value = {
    categoryLabel: it.categoryLabel,
    itemName: it.itemName,
    standardText: it.standardText,
  }
  itemError.value = ''
  itemDialogOpen.value = true
}

async function submitItem() {
  if (!template.value || !itemBlockId.value) return
  if (!itemForm.value.categoryLabel.trim() || !itemForm.value.itemName.trim() || !itemForm.value.standardText.trim()) {
    itemError.value = '請填寫分類、檢查項目與檢查標準'
    return
  }
  itemSaving.value = true
  itemError.value = ''
  try {
    const bid = itemBlockId.value
    if (itemDialogMode.value === 'create') {
      const row = await createSelfInspectionBlockItem(
        template.value.id,
        bid,
        {
          categoryLabel: itemForm.value.categoryLabel.trim(),
          itemName: itemForm.value.itemName.trim(),
          standardText: itemForm.value.standardText.trim(),
        },
        tenantId.value
      )
      blocks.value = blocks.value.map((b) =>
        b.id === bid ? { ...b, items: [...b.items, row].sort((x, y) => x.sortOrder - y.sortOrder) } : b
      )
    } else if (itemEditId.value) {
      const row = await updateSelfInspectionBlockItem(
        template.value.id,
        bid,
        itemEditId.value,
        {
          categoryLabel: itemForm.value.categoryLabel.trim(),
          itemName: itemForm.value.itemName.trim(),
          standardText: itemForm.value.standardText.trim(),
        },
        tenantId.value
      )
      blocks.value = blocks.value.map((b) =>
        b.id === bid
          ? {
              ...b,
              items: b.items.map((x) => (x.id === row.id ? row : x)).sort((x, y) => x.sortOrder - y.sortOrder),
            }
          : b
      )
    }
    itemDialogOpen.value = false
  } catch {
    itemError.value = '儲存失敗'
  } finally {
    itemSaving.value = false
  }
}

function openDeleteItem(blockId: string, it: SelfInspectionBlockItem) {
  deleteItemCtx.value = { blockId, item: it }
  deleteItemOpen.value = true
}

async function confirmDeleteItem() {
  if (!template.value || !deleteItemCtx.value) return
  deleteItemLoading.value = true
  try {
    const { blockId, item } = deleteItemCtx.value
    await deleteSelfInspectionBlockItem(template.value.id, blockId, item.id, tenantId.value)
    blocks.value = blocks.value.map((b) =>
      b.id === blockId ? { ...b, items: b.items.filter((x) => x.id !== item.id) } : b
    )
    deleteItemOpen.value = false
  } finally {
    deleteItemLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-3">
      <Button variant="outline" @click="router.push({ name: ROUTE_NAME.ADMIN_SELF_INSPECTION_TEMPLATES })">
        <ArrowLeft class="mr-2 size-4" />
        返回列表
      </Button>
    </div>

    <div v-if="loading" class="flex justify-center py-16 text-muted-foreground">
      <Loader2 class="size-8 animate-spin" />
    </div>
    <p v-else-if="loadError" class="text-sm text-destructive">{{ loadError }}</p>

    <template v-else-if="template">
      <!-- 樣板資訊 -->
      <Card>
        <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div class="space-y-1">
            <CardTitle class="text-lg">{{ template.name }}</CardTitle>
            <CardDescription>
              {{ template.description || '無說明' }}
            </CardDescription>
            <div class="flex flex-wrap items-center gap-2 pt-2">
              <Badge :variant="template.status === 'archived' ? 'secondary' : 'outline'">
                {{ template.status === 'archived' ? '已封存' : '使用中' }}
              </Badge>
              <span class="text-xs text-muted-foreground">
                更新於 {{ new Date(template.updatedAt).toLocaleString('zh-TW') }}
              </span>
            </div>
          </div>
          <div class="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" @click="openMetaEdit">
              <Pencil class="mr-2 size-4" />
              編輯樣板資訊
            </Button>
            <Button variant="outline" class="text-destructive" @click="deleteTemplateOpen = true">
              <Trash2 class="mr-2 size-4" />
              刪除樣板
            </Button>
          </div>
        </CardHeader>
      </Card>

      <!-- 表單抬頭（對應紙本「基本資料」） -->
      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-foreground">表單抬頭（基本資料欄位）</h2>
          <Button type="button" :disabled="headerSaving" @click="saveHeaderConfig">
            <Loader2 v-if="headerSaving" class="mr-2 size-4 animate-spin" />
            儲存抬頭設定
          </Button>
        </div>
        <p v-if="headerError" class="text-sm text-destructive">{{ headerError }}</p>
        <div class="rounded-lg border border-border bg-card p-4 space-y-4">
          <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div class="space-y-2 md:col-span-2">
              <Label :for="'hdr-insp-name'">{{ headerForm.inspectionNameLabel }}（欄位標題）</Label>
              <Input id="hdr-insp-name" v-model="headerForm.inspectionNameLabel" :class="inputClass" />
              <p class="text-xs text-muted-foreground">現場填寫：單行文字</p>
            </div>
            <div class="space-y-2 md:col-span-2">
              <Label :for="'hdr-project'">{{ headerForm.projectNameLabel }}（欄位標題）</Label>
              <Input id="hdr-project" v-model="headerForm.projectNameLabel" :class="inputClass" />
              <p class="text-xs text-muted-foreground">現場填寫：單行文字；專案內新增查驗時預填為專案名稱</p>
            </div>
            <div class="space-y-2">
              <Label :for="'hdr-sub'">{{ headerForm.subProjectLabel }}（欄位標題）</Label>
              <Input id="hdr-sub" v-model="headerForm.subProjectLabel" :class="inputClass" />
            </div>
            <div class="space-y-2">
              <Label :for="'hdr-vendor'">{{ headerForm.subcontractorLabel }}（欄位標題）</Label>
              <Input id="hdr-vendor" v-model="headerForm.subcontractorLabel" :class="inputClass" />
            </div>
            <div class="space-y-2">
              <Label :for="'hdr-loc'">{{ headerForm.inspectionLocationLabel }}（欄位標題）</Label>
              <Input id="hdr-loc" v-model="headerForm.inspectionLocationLabel" :class="inputClass" />
            </div>
            <div class="space-y-2">
              <Label :for="'hdr-date'">{{ headerForm.inspectionDateLabel }}（欄位標題）</Label>
              <Input id="hdr-date" v-model="headerForm.inspectionDateLabel" :class="inputClass" />
              <p class="text-xs text-muted-foreground">現場填寫：日期</p>
            </div>
          </div>

          <div class="space-y-2 border-t border-border pt-4">
            <Label :for="'hdr-timing-title'">區塊標題：檢查時機</Label>
            <Input id="hdr-timing-title" v-model="headerForm.timingSectionLabel" :class="inputClass" />
            <p class="text-xs text-muted-foreground">
              選項設定；現場填寫時為單選（radio），僅可擇一。
            </p>
            <ul class="space-y-2">
              <li
                v-for="(opt, idx) in headerForm.timingOptions"
                :key="opt.id + '-' + idx"
                class="flex flex-wrap items-end gap-2"
              >
                <div class="grid min-w-0 flex-1 gap-1 sm:grid-cols-2 sm:gap-2">
                  <div class="space-y-1">
                    <span class="text-xs text-muted-foreground">代碼</span>
                    <Input v-model="opt.id" :class="inputClass" />
                  </div>
                  <div class="space-y-1">
                    <span class="text-xs text-muted-foreground">顯示文字</span>
                    <Input v-model="opt.label" :class="inputClass" />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  :disabled="headerForm.timingOptions.length <= 1"
                  @click="removeTimingOption(idx)"
                >
                  移除
                </Button>
              </li>
            </ul>
            <Button type="button" variant="outline" @click="addTimingOption">新增選項</Button>

            <div
              class="mt-3 space-y-2 rounded-md border border-dashed border-border bg-muted/30 p-3"
              role="region"
              aria-label="檢查時機現場預覽"
            >
              <p class="text-xs font-medium text-foreground">現場顯示預覽（radio）</p>
              <p class="text-sm text-muted-foreground">{{ headerForm.timingSectionLabel }}</p>
              <div
                class="flex flex-col gap-1 pt-1"
                role="radiogroup"
                :aria-label="headerForm.timingSectionLabel"
              >
                <label
                  v-for="opt in headerForm.timingOptions"
                  :key="opt.id"
                  class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted/60"
                >
                  <input
                    v-model="timingPreviewId"
                    type="radio"
                    name="self-inspection-timing-preview"
                    :value="opt.id"
                    class="size-4 shrink-0 border border-input bg-background text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                  <span>{{ opt.label.trim() || '（請填顯示文字）' }}</span>
                </label>
              </div>
            </div>
          </div>

          <div class="space-y-2 border-t border-border pt-4">
            <Label :for="'hdr-result-title'">區塊標題：檢查結果</Label>
            <Input id="hdr-result-title" v-model="headerForm.resultSectionLabel" :class="inputClass" />
            <p class="text-xs text-muted-foreground">
              圖例與列「檢查結果」欄共用選項；現場填寫為單選（radio），僅可擇一。
            </p>
            <ul class="space-y-2">
              <li
                v-for="(opt, idx) in headerForm.resultLegendOptions"
                :key="opt.id + '-r-' + idx"
                class="flex flex-wrap items-end gap-2"
              >
                <div class="grid min-w-0 flex-1 gap-1 sm:grid-cols-2 sm:gap-2">
                  <div class="space-y-1">
                    <span class="text-xs text-muted-foreground">代碼</span>
                    <Input v-model="opt.id" :class="inputClass" />
                  </div>
                  <div class="space-y-1">
                    <span class="text-xs text-muted-foreground">顯示文字（可含 ○×／ 等符號）</span>
                    <Input v-model="opt.label" :class="inputClass" />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  :disabled="headerForm.resultLegendOptions.length <= 1"
                  @click="removeResultLegendOption(idx)"
                >
                  移除
                </Button>
              </li>
            </ul>
            <Button type="button" variant="outline" @click="addResultLegendOption">新增選項</Button>

            <div
              class="mt-3 space-y-2 rounded-md border border-dashed border-border bg-muted/30 p-3"
              role="region"
              aria-label="檢查結果現場預覽"
            >
              <p class="text-xs font-medium text-foreground">現場顯示預覽（radio）</p>
              <p class="text-sm text-muted-foreground">{{ headerForm.resultSectionLabel }}（圖例／列選項）</p>
              <div
                class="flex flex-col gap-1 pt-1"
                role="radiogroup"
                :aria-label="headerForm.resultSectionLabel"
              >
                <label
                  v-for="opt in headerForm.resultLegendOptions"
                  :key="opt.id"
                  class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted/60"
                >
                  <input
                    v-model="resultPreviewId"
                    type="radio"
                    name="self-inspection-result-preview"
                    :value="opt.id"
                    class="size-4 shrink-0 border border-input bg-background text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                  <span>{{ opt.label.trim() || '（請填顯示文字）' }}</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 查驗區塊 -->
      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-foreground">查驗區塊</h2>
          <Button @click="openCreateBlock">
            <Plus class="mr-2 size-4" />
            新增區塊
          </Button>
        </div>

        <div v-if="!blocks.length" class="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          尚未新增區塊。每個區塊可設定名稱，並建立檢查項目表（分類、項目、檢查標準）。
        </div>

        <div v-for="b in blocks" :key="b.id" class="space-y-3 rounded-lg border border-border bg-card">
          <div class="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div class="min-w-0 flex-1 space-y-1">
              <p class="font-medium text-foreground">{{ b.title }}</p>
              <p v-if="b.description" class="text-sm text-muted-foreground">{{ b.description }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" @click="openCreateItem(b.id)">
                <Plus class="mr-2 size-4" />
                新增查驗項目
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-8 shrink-0" aria-label="區塊操作">
                    <MoreHorizontal class="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem class="cursor-pointer" @click="openEditBlock(b)">
                    <Pencil class="mr-2 size-4" />
                    編輯區塊
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    class="cursor-pointer text-destructive focus:text-destructive"
                    @click="openDeleteBlock(b)"
                  >
                    <Trash2 class="mr-2 size-4" />
                    刪除區塊
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div class="overflow-x-auto px-2 pb-4">
            <table class="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr class="border-b border-border text-left text-muted-foreground">
                  <th class="border border-border bg-muted/40 px-2 py-2 font-medium w-[140px]">檢查項目（分類）</th>
                  <th class="border border-border bg-muted/40 px-2 py-2 font-medium min-w-[140px]">檢查項目（名稱）</th>
                  <th class="border border-border bg-muted/40 px-2 py-2 font-medium min-w-[220px]">
                    設計圖說、規範之檢查標準（定量定性）
                  </th>
                  <th class="border border-border bg-muted/40 px-2 py-2 font-medium min-w-[120px]">
                    實際檢查情形<span class="block text-xs font-normal">（現場填寫）</span>
                  </th>
                  <th class="border border-border bg-muted/40 px-2 py-2 font-medium w-[100px]">
                    檢查結果<span class="block text-xs font-normal">（現場填寫）</span>
                  </th>
                  <th class="border border-border bg-muted/40 px-2 py-2 w-12" />
                </tr>
              </thead>
              <tbody>
                <template v-if="b.items.length">
                  <tr
                    v-for="row in rowsWithCategorySpan(b.items)"
                    :key="row.item.id"
                    class="border-b border-border"
                  >
                    <td
                      v-if="row.showCategory"
                      class="border border-border align-top px-2 py-2 text-foreground"
                      :rowspan="row.categoryRowspan"
                    >
                      {{ row.item.categoryLabel }}
                    </td>
                    <td class="border border-border align-top px-2 py-2 text-foreground">
                      {{ row.item.itemName }}
                    </td>
                    <td class="border border-border align-top px-2 py-2 text-foreground whitespace-pre-wrap">
                      {{ row.item.standardText }}
                    </td>
                    <td class="border border-border bg-muted/20 px-2 py-2 text-muted-foreground">—</td>
                    <td class="border border-border bg-muted/20 px-2 py-2 text-muted-foreground">—</td>
                    <td class="border border-border px-1 py-1 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                          <Button variant="ghost" size="icon" class="size-8" aria-label="項目操作">
                            <MoreHorizontal class="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem class="cursor-pointer" @click="openEditItem(b.id, row.item)">
                            <Pencil class="mr-2 size-4" />
                            編輯
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            class="cursor-pointer text-destructive focus:text-destructive"
                            @click="openDeleteItem(b.id, row.item)"
                          >
                            <Trash2 class="mr-2 size-4" />
                            刪除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                </template>
                <tr v-else>
                  <td colspan="6" class="px-4 py-6 text-center text-muted-foreground">
                    此區塊尚無查驗項目，請按「新增查驗項目」。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- 編輯樣板資訊 -->
    <Dialog :open="metaDialogOpen" @update:open="(v) => (metaDialogOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>編輯樣板資訊</DialogTitle>
          <DialogDescription>樣本名稱、說明與狀態</DialogDescription>
        </DialogHeader>
        <form class="grid gap-4 py-2" @submit.prevent="submitMeta">
          <div class="grid gap-2">
            <Label for="meta-name">名稱</Label>
            <Input id="meta-name" v-model="metaForm.name" class="bg-background" />
          </div>
          <div class="grid gap-2">
            <Label for="meta-desc">說明</Label>
            <Input id="meta-desc" v-model="metaForm.description" class="bg-background" />
          </div>
          <div class="grid gap-2">
            <Label for="meta-status">狀態</Label>
            <select
              id="meta-status"
              v-model="metaForm.status"
              class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="active">使用中</option>
              <option value="archived">已封存</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" @click="metaDialogOpen = false">取消</Button>
            <Button type="submit" :disabled="metaSaving">
              <Loader2 v-if="metaSaving" class="mr-2 size-4 animate-spin" />
              儲存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog :open="deleteTemplateOpen" @update:open="(v) => (deleteTemplateOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>刪除樣板</DialogTitle>
          <DialogDescription>
            確定刪除「{{ template?.name }}」？所有區塊與查驗項目將一併刪除。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="deleteTemplateLoading" @click="deleteTemplateOpen = false">
            取消
          </Button>
          <Button variant="destructive" :disabled="deleteTemplateLoading" @click="confirmDeleteTemplate">
            <Loader2 v-if="deleteTemplateLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="blockDialogOpen" @update:open="(v) => (blockDialogOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ blockDialogMode === 'create' ? '新增區塊' : '編輯區塊' }}</DialogTitle>
          <DialogDescription>區塊名稱與補充說明（選填）</DialogDescription>
        </DialogHeader>
        <form class="grid gap-4 py-2" @submit.prevent="submitBlock">
          <div class="grid gap-2">
            <Label for="blk-title">區塊名稱</Label>
            <Input
              id="blk-title"
              v-model="blockForm.title"
              placeholder="例：基樁施工自主檢查"
              class="bg-background"
            />
          </div>
          <div class="grid gap-2">
            <Label for="blk-desc">說明（選填）</Label>
            <Input id="blk-desc" v-model="blockForm.description" placeholder="檢查重點提示" class="bg-background" />
          </div>
          <p v-if="blockError" class="text-sm text-destructive">{{ blockError }}</p>
          <DialogFooter>
            <Button type="button" variant="outline" @click="blockDialogOpen = false">取消</Button>
            <Button type="submit" :disabled="blockSaving">
              <Loader2 v-if="blockSaving" class="mr-2 size-4 animate-spin" />
              儲存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog :open="deleteBlockOpen" @update:open="(v) => (deleteBlockOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>刪除區塊</DialogTitle>
          <DialogDescription>確定刪除「{{ deleteBlockTarget?.title }}」？下屬查驗項目將一併刪除。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="deleteBlockLoading" @click="deleteBlockOpen = false">取消</Button>
          <Button variant="destructive" :disabled="deleteBlockLoading" @click="confirmDeleteBlock">
            <Loader2 v-if="deleteBlockLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="itemDialogOpen" @update:open="(v) => (itemDialogOpen = v)">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ itemDialogMode === 'create' ? '新增查驗項目' : '編輯查驗項目' }}</DialogTitle>
          <DialogDescription>
            分類欄位相同且相鄰時，列表會合併顯示（如紙本「施工前」列首）。
          </DialogDescription>
        </DialogHeader>
        <form class="grid gap-4 py-2" @submit.prevent="submitItem">
          <div class="grid gap-2">
            <Label for="it-cat">檢查項目（分類）</Label>
            <Input id="it-cat" v-model="itemForm.categoryLabel" placeholder="例：施工前" class="bg-background" />
          </div>
          <div class="grid gap-2">
            <Label for="it-name">檢查項目（名稱）</Label>
            <Input id="it-name" v-model="itemForm.itemName" placeholder="例：樁心檢測" class="bg-background" />
          </div>
          <div class="grid gap-2">
            <Label for="it-std">檢查標準</Label>
            <textarea
              id="it-std"
              v-model="itemForm.standardText"
              rows="4"
              class="bg-background"
              :class="textareaClass"
              placeholder="例：水平位置偏差 &lt; 7.5cm…"
            />
          </div>
          <p v-if="itemError" class="text-sm text-destructive">{{ itemError }}</p>
          <DialogFooter>
            <Button type="button" variant="outline" @click="itemDialogOpen = false">取消</Button>
            <Button type="submit" :disabled="itemSaving">
              <Loader2 v-if="itemSaving" class="mr-2 size-4 animate-spin" />
              儲存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog :open="deleteItemOpen" @update:open="(v) => (deleteItemOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>刪除查驗項目</DialogTitle>
          <DialogDescription>
            確定刪除「{{ deleteItemCtx?.item.itemName }}」？
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="deleteItemLoading" @click="deleteItemOpen = false">取消</Button>
          <Button variant="destructive" :disabled="deleteItemLoading" @click="confirmDeleteItem">
            <Loader2 v-if="deleteItemLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
