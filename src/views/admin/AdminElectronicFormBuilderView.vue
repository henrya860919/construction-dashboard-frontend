<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import { useElectronicFormBuilderBreadcrumbStore } from '@/stores/electronicFormBuilderBreadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { defaultConfigForElectronicFormFieldType } from '@/constants/electronic-form-field-contract'
import {
  ELECTRONIC_FORM_BUILDER_PALETTE,
  type ElectronicFormBuilderPaletteEntry,
} from '@/constants/electronic-form-builder-palette'
import {
  getElectronicFormDefinition,
  createElectronicFormDefinition,
  updateElectronicFormDefinition,
  addElectronicFormField,
  updateElectronicFormField,
  deleteElectronicFormField,
  reorderElectronicFormFields,
  publishElectronicFormDefinition,
  type ElectronicFormDefinitionDetail,
  type ElectronicFormFieldItem,
} from '@/api/electronic-form-definitions'
import { ROUTE_PATH, ROUTE_NAME } from '@/constants/routes'
import ElectronicFormFillPreview from '@/components/electronic-form/ElectronicFormFillPreview.vue'
import ElectronicFormBuilderDropGap from '@/components/electronic-form/ElectronicFormBuilderDropGap.vue'
import ElectronicFormBuilderFieldRow from '@/components/electronic-form/ElectronicFormBuilderFieldRow.vue'
import ElectronicFormBuilderFieldInspector, {
  type ElectronicFormInspectorApplyPayload,
  type ElectronicFormInspectorPreviewPayload,
} from '@/components/electronic-form/ElectronicFormBuilderFieldInspector.vue'
import { ELECTRONIC_FORM_FIELD_TYPE_ICONS } from '@/lib/electronic-form-field-icons'
import {
  assignmentsForDuplicateNextToSource,
  canDropField,
  moveFieldToContainer,
  type BuilderDropTarget,
  type ElectronicFormLayoutAssignment,
} from '@/lib/electronic-form-builder-layout'
import { useElectronicFormBuilderUndo } from '@/composables/useElectronicFormBuilderUndo'
import {
  buildClipboardPayloadFromSubtree,
  collectOrderedSubtreeFields,
  parseElectronicFormBuilderClipboard,
  serializeElectronicFormBuilderClipboard,
  type ElectronicFormBuilderClipboardPayload,
} from '@/lib/electronic-form-builder-field-clipboard'
import { setElectronicFormBuilderBlankDragImage } from '@/lib/electronic-form-builder-drag-ux'
import {
  parseElectronicFormPaletteEntryFromDataTransfer,
  setElectronicFormPaletteDragData,
  type ElectronicFormBuilderPaletteDropPlacement,
} from '@/lib/electronic-form-builder-palette-drag'
import { Loader2, ArrowLeft, GripVertical, Undo2 } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const adminStore = useAdminStore()
const breadcrumbStore = useElectronicFormBuilderBreadcrumbStore()

const { undoing: undoingBuilder, canUndo: canUndoBuilder, clear: clearUndoStack, push: pushUndoSnapshot, undo: performBuilderUndo } =
  useElectronicFormBuilderUndo()

const tenantIdQuery = computed(() => {
  if (authStore.isPlatformAdmin) return adminStore.selectedTenantId ?? undefined
  return authStore.user?.tenantId ?? undefined
})

const loading = ref(true)
const errorMsg = ref('')
const detail = ref<ElectronicFormDefinitionDetail | null>(null)
const formNameLocal = ref('')
const savingName = ref(false)
const selectedFieldId = ref<string | null>(null)
const addingPaletteId = ref<string | null>(null)
const applyingInspector = ref(false)
const publishOpen = ref(false)
const publishing = ref(false)
const deleteFieldOpen = ref(false)
const deletingField = ref(false)
const deleteTargetField = ref<ElectronicFormFieldItem | null>(null)
const duplicatingFieldId = ref<string | null>(null)
const reorderDraggingId = ref<string | null>(null)
const reorderDragOverKey = ref<string | null>(null)
const reordering = ref(false)
const builderCenterMode = ref<'edit' | 'preview'>('edit')
const pastingFields = ref(false)
const internalFieldClipboard = ref<ElectronicFormBuilderClipboardPayload | null>(null)
/** 左側元件庫項目正被拖曳（用於插入間隙高亮） */
const paletteDragging = ref(false)

type InspectorPreviewOverlay = { fieldId: string } & ElectronicFormInspectorPreviewPayload
const inspectorPreviewOverlay = ref<InspectorPreviewOverlay | null>(null)

const isDraft = computed(() => detail.value?.status === 'draft')

const paletteInteractionsDisabled = computed(
  () =>
    !isDraft.value ||
    addingPaletteId.value !== null ||
    builderCenterMode.value === 'preview' ||
    pastingFields.value
)

const canvasDragActive = computed(() => reorderDraggingId.value != null || paletteDragging.value)

const displayFields = computed((): ElectronicFormFieldItem[] => {
  const fs = detail.value?.fields ?? []
  const ov = inspectorPreviewOverlay.value
  if (!ov || fs.length === 0) return fs
  return fs.map((f) =>
    f.id === ov.fieldId
      ? {
          ...f,
          fieldKey: ov.fieldKey,
          label: ov.label,
          placeholder: ov.placeholder,
          required: ov.required,
          config: ov.config,
        }
      : f
  )
})

const rootFields = computed(() => {
  const fs = displayFields.value
  return fs.filter((f) => f.parentFieldId == null).sort((a, b) => a.sortOrder - b.sortOrder)
})

const selectedField = computed(() =>
  detail.value?.fields.find((f) => f.id === selectedFieldId.value) ?? null
)

watch(selectedFieldId, () => {
  inspectorPreviewOverlay.value = null
})

watch(builderCenterMode, (m) => {
  if (m === 'preview') {
    selectedFieldId.value = null
    inspectorPreviewOverlay.value = null
  }
})

function onInspectorPreviewChange(payload: ElectronicFormInspectorPreviewPayload) {
  const id = selectedFieldId.value
  if (!id) return
  inspectorPreviewOverlay.value = { fieldId: id, ...payload }
}

async function loadDetail(id: string) {
  const d = await getElectronicFormDefinition(id, tenantIdQuery.value)
  detail.value = d
  inspectorPreviewOverlay.value = null
  formNameLocal.value = d.name
  breadcrumbStore.setCurrentTitle(d.name)
  if (selectedFieldId.value && !d.fields.some((x) => x.id === selectedFieldId.value)) {
    selectedFieldId.value = null
  }
}

async function initFromRoute() {
  errorMsg.value = ''
  clearUndoStack()
  internalFieldClipboard.value = null
  if (authStore.isPlatformAdmin && !adminStore.selectedTenantId) {
    errorMsg.value = '請先於後台選擇租戶。'
    loading.value = false
    return
  }

  const id = route.params.id as string
  loading.value = true
  try {
    if (id === 'new') {
      const created = await createElectronicFormDefinition(tenantIdQuery.value, {
        name: '未命名表單',
      })
      await router.replace({
        name: ROUTE_NAME.ADMIN_ELECTRONIC_FORM_BUILDER,
        params: { id: created.id },
      })
      return
    }
    await loadDetail(id)
  } catch (e: unknown) {
    errorMsg.value =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message ?? '載入失敗'
        : '載入失敗'
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params.id,
  () => {
    builderCenterMode.value = 'edit'
    void initFromRoute()
  },
  { immediate: true }
)

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

function onBuilderHotkeys(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey
  if (!mod || e.altKey) return
  if (!detail.value || !isDraft.value || builderCenterMode.value === 'preview') return
  if (isTextEditingTarget(e.target)) return
  if (publishOpen.value || deleteFieldOpen.value) return

  const key = e.key.toLowerCase()

  if (key === 'z' && !e.shiftKey) {
    if (!canUndoBuilder.value || undoingBuilder.value) return
    e.preventDefault()
    void runBuilderUndo()
    return
  }

  if (key === 'c') {
    if (!selectedFieldId.value) return
    e.preventDefault()
    void copySelectedFieldSubtreeToClipboard()
    return
  }

  if (key === 'v') {
    if (pastingFields.value || duplicatingFieldId.value !== null || addingPaletteId.value !== null) return
    e.preventDefault()
    void pasteFieldSubtreeFromClipboard()
  }
}

async function runBuilderUndo() {
  await performBuilderUndo({
    detail,
    formNameLocal,
    tenantId: () => tenantIdQuery.value,
    loadDetail,
    setError: (msg) => {
      errorMsg.value = msg
    },
    onRestoreLocal: () => {
      selectedFieldId.value = null
      inspectorPreviewOverlay.value = null
    },
  })
}

onMounted(() => {
  window.addEventListener('keydown', onBuilderHotkeys)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onBuilderHotkeys)
  breadcrumbStore.setCurrentTitle(null)
})

function nextFieldKey(): string {
  const used = new Set(detail.value?.fields.map((f) => f.fieldKey) ?? [])
  let n = 1
  let k = `field_${n}`
  while (used.has(k)) {
    n += 1
    k = `field_${n}`
  }
  return k
}

function onPaletteDragStart(e: DragEvent, entry: ElectronicFormBuilderPaletteEntry) {
  if (!detail.value || !isDraft.value || builderCenterMode.value === 'preview' || addingPaletteId.value !== null) {
    e.preventDefault()
    return
  }
  paletteDragging.value = true
  setElectronicFormBuilderBlankDragImage(e)
  setElectronicFormPaletteDragData(e, entry.id)
}

function onPaletteDragEnd() {
  paletteDragging.value = false
  reorderDragOverKey.value = null
}

async function onPaletteAddAt(
  entry: ElectronicFormBuilderPaletteEntry,
  placement: { parentFieldId: string | null; slotIndex: number | null }
) {
  if (!detail.value || !isDraft.value) return
  pushUndoSnapshot(detail.value, formNameLocal.value)
  addingPaletteId.value = entry.id
  errorMsg.value = ''
  const fieldType = entry.fieldType
  const config = {
    ...defaultConfigForElectronicFormFieldType(fieldType),
    ...(entry.configPatch ?? {}),
  }
  try {
    const created = await addElectronicFormField(detail.value.id, tenantIdQuery.value, {
      fieldKey: nextFieldKey(),
      fieldType,
      label: entry.label,
      config,
      parentFieldId: placement.parentFieldId ?? undefined,
      slotIndex: placement.slotIndex ?? undefined,
    })
    await loadDetail(detail.value.id)
    selectedFieldId.value = created.id
  } catch (e: unknown) {
    errorMsg.value =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message ?? '新增欄位失敗'
        : '新增欄位失敗'
  } finally {
    addingPaletteId.value = null
  }
}

async function onPaletteAdd(entry: ElectronicFormBuilderPaletteEntry) {
  await onPaletteAddAt(entry, { parentFieldId: null, slotIndex: null })
}

async function onPaletteInsertBefore(entry: ElectronicFormBuilderPaletteEntry, before: ElectronicFormFieldItem) {
  if (!detail.value || !isDraft.value) return
  pushUndoSnapshot(detail.value, formNameLocal.value)
  addingPaletteId.value = entry.id
  errorMsg.value = ''
  const fieldType = entry.fieldType
  const config = {
    ...defaultConfigForElectronicFormFieldType(fieldType),
    ...(entry.configPatch ?? {}),
  }
  const formId = detail.value.id
  try {
    const created = await addElectronicFormField(formId, tenantIdQuery.value, {
      fieldKey: nextFieldKey(),
      fieldType,
      label: entry.label,
      config,
      parentFieldId: before.parentFieldId ?? undefined,
      slotIndex: before.slotIndex ?? undefined,
    })
    await loadDetail(formId)
    const fresh = detail.value?.fields ?? []
    const assigns = moveFieldToContainer(
      fresh,
      created.id,
      before.parentFieldId ?? null,
      before.slotIndex ?? null,
      before.id
    )
    await reorderElectronicFormFields(formId, tenantIdQuery.value, assigns)
    await loadDetail(formId)
    selectedFieldId.value = created.id
  } catch (e: unknown) {
    errorMsg.value =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message ?? '新增欄位失敗'
        : '新增欄位失敗'
    await loadDetail(formId)
  } finally {
    addingPaletteId.value = null
  }
}

async function onPaletteDrop(entry: ElectronicFormBuilderPaletteEntry, placement: ElectronicFormBuilderPaletteDropPlacement) {
  if (placement.kind === 'before-field') {
    await onPaletteInsertBefore(entry, placement.beforeField)
    return
  }
  if (placement.kind === 'root') {
    await onPaletteAddAt(entry, { parentFieldId: null, slotIndex: null })
    return
  }
  if (placement.kind === 'section-append') {
    await onPaletteAddAt(entry, { parentFieldId: placement.sectionId, slotIndex: null })
    return
  }
  await onPaletteAddAt(entry, {
    parentFieldId: placement.columnsId,
    slotIndex: placement.slotIndex,
  })
}

async function copySelectedFieldSubtreeToClipboard() {
  const rootId = selectedFieldId.value
  if (!rootId || !detail.value) return
  const ordered = collectOrderedSubtreeFields(rootId, detail.value.fields)
  if (ordered.length === 0) return
  const payload = buildClipboardPayloadFromSubtree(ordered)
  internalFieldClipboard.value = payload
  const text = serializeElectronicFormBuilderClipboard(payload)
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 權限或環境不支援時仍保留內部剪貼簿 */
  }
}

async function pasteFieldSubtreeFromClipboard() {
  if (!detail.value || !isDraft.value) return
  let payload = internalFieldClipboard.value
  if (!payload) {
    try {
      const t = await navigator.clipboard.readText()
      payload = parseElectronicFormBuilderClipboard(t)
    } catch {
      return
    }
  }
  if (!payload || payload.nodes.length === 0) return

  pushUndoSnapshot(detail.value, formNameLocal.value)
  pastingFields.value = true
  errorMsg.value = ''
  const formId = detail.value.id
  const usedKeys = new Set(detail.value.fields.map((f) => f.fieldKey))
  function nextKeyInPaste(): string {
    let n = 1
    let k = `field_${n}`
    while (usedKeys.has(k)) {
      n += 1
      k = `field_${n}`
    }
    usedKeys.add(k)
    return k
  }

  const idMap = new Map<string, string>()
  try {
    for (const node of payload.nodes) {
      const parentFieldId =
        node.parentOldId != null ? (idMap.get(node.parentOldId) ?? null) : node.externalParentFieldId
      const created = await addElectronicFormField(formId, tenantIdQuery.value, {
        fieldKey: nextKeyInPaste(),
        fieldType: node.fieldType,
        label: node.label,
        placeholder: node.placeholder,
        required: node.required,
        readonly: node.readonly,
        sortOrder: node.sortOrder,
        parentFieldId: parentFieldId ?? undefined,
        slotIndex: node.slotIndex ?? undefined,
        config: JSON.parse(JSON.stringify(node.config ?? {})) as Record<string, unknown>,
      })
      idMap.set(node.oldId, created.id)
    }
    await loadDetail(formId)
    const firstNewId = idMap.get(payload.nodes[0]!.oldId)
    if (firstNewId) selectedFieldId.value = firstNewId
  } catch (e: unknown) {
    errorMsg.value =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message ?? '貼上欄位失敗'
        : '貼上欄位失敗'
    await loadDetail(formId)
  } finally {
    pastingFields.value = false
  }
}

async function saveFormName() {
  if (!detail.value || !isDraft.value) return
  const name = formNameLocal.value.trim()
  if (!name || name === detail.value.name) return
  pushUndoSnapshot(detail.value, formNameLocal.value)
  savingName.value = true
  errorMsg.value = ''
  try {
    await updateElectronicFormDefinition(detail.value.id, tenantIdQuery.value, { name })
    await loadDetail(detail.value.id)
  } catch (e: unknown) {
    errorMsg.value =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message ?? '更新名稱失敗'
        : '更新名稱失敗'
  } finally {
    savingName.value = false
  }
}

async function onInspectorApply(payload: ElectronicFormInspectorApplyPayload) {
  if (!detail.value || !isDraft.value) return
  if (!detail.value.fields.some((x) => x.id === payload.fieldId)) return
  pushUndoSnapshot(detail.value, formNameLocal.value)
  applyingInspector.value = true
  errorMsg.value = ''
  try {
    const updated = await updateElectronicFormField(detail.value.id, payload.fieldId, tenantIdQuery.value, {
      fieldKey: payload.fieldKey,
      label: payload.label,
      placeholder: payload.placeholder,
      required: payload.required,
      config: payload.config,
    })
    detail.value = {
      ...detail.value,
      fields: detail.value.fields.map((x) => (x.id === updated.id ? updated : x)),
    }
    inspectorPreviewOverlay.value = null
  } catch (e: unknown) {
    errorMsg.value =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message ?? '更新欄位失敗'
        : '更新欄位失敗'
  } finally {
    applyingInspector.value = false
  }
}

function openDeleteField(target: ElectronicFormFieldItem | null) {
  const t = target ?? selectedField.value
  if (!t) return
  deleteTargetField.value = t
  deleteFieldOpen.value = true
}

async function confirmDeleteField() {
  const target = deleteTargetField.value ?? selectedField.value
  if (!detail.value || !target || !isDraft.value) return
  pushUndoSnapshot(detail.value, formNameLocal.value)
  deletingField.value = true
  errorMsg.value = ''
  try {
    await deleteElectronicFormField(detail.value.id, target.id, tenantIdQuery.value)
    if (selectedFieldId.value === target.id) {
      selectedFieldId.value = null
    }
    deleteTargetField.value = null
    deleteFieldOpen.value = false
    await loadDetail(detail.value.id)
  } catch (e: unknown) {
    errorMsg.value =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message ?? '刪除欄位失敗'
        : '刪除欄位失敗'
  } finally {
    deletingField.value = false
  }
}

async function duplicateField(sourceField: ElectronicFormFieldItem) {
  if (!detail.value || !isDraft.value) return
  pushUndoSnapshot(detail.value, formNameLocal.value)
  const formId = detail.value.id
  const sourceId = sourceField.id
  const source = detail.value.fields.find((f) => f.id === sourceId) ?? sourceField

  duplicatingFieldId.value = sourceId
  errorMsg.value = ''
  try {
    const config = JSON.parse(JSON.stringify(source.config ?? {})) as Record<string, unknown>
    const created = await addElectronicFormField(formId, tenantIdQuery.value, {
      fieldKey: nextFieldKey(),
      fieldType: source.fieldType,
      label: source.label,
      placeholder: source.placeholder,
      required: source.required,
      readonly: source.readonly,
      parentFieldId: source.parentFieldId ?? undefined,
      slotIndex: source.slotIndex ?? undefined,
      config,
    })

    await loadDetail(formId)
    const fresh = detail.value?.fields ?? []
    const assigns = assignmentsForDuplicateNextToSource(fresh, sourceId, created.id)
    await reorderElectronicFormFields(formId, tenantIdQuery.value, assigns)
    await loadDetail(formId)
    selectedFieldId.value = created.id
  } catch (e: unknown) {
    errorMsg.value =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message ?? '複製欄位失敗'
        : '複製欄位失敗'
  } finally {
    duplicatingFieldId.value = null
  }
}

function onReorderDragStart(e: DragEvent, fieldId: string) {
  if (!isDraft.value) return
  reorderDraggingId.value = fieldId
  e.dataTransfer?.setData('text/plain', fieldId)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  setElectronicFormBuilderBlankDragImage(e)
}

function onBuilderDragOver(key: string | null) {
  if (!canvasDragActive.value) return
  reorderDragOverKey.value = key
}

function onRootEndDragOver(e: DragEvent) {
  if (!canvasDragActive.value) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  reorderDragOverKey.value = 'root-end'
}

function onEmptyCanvasDragOver(e: DragEvent) {
  if (!canvasDragActive.value) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onReorderDragEnd() {
  reorderDraggingId.value = null
  reorderDragOverKey.value = null
}

async function syncFieldLayout(assignments: ElectronicFormLayoutAssignment[]) {
  if (!detail.value || !isDraft.value) return
  pushUndoSnapshot(detail.value, formNameLocal.value)
  reordering.value = true
  errorMsg.value = ''
  try {
    await reorderElectronicFormFields(detail.value.id, tenantIdQuery.value, assignments)
    await loadDetail(detail.value.id)
  } catch (e: unknown) {
    errorMsg.value =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message ?? '排序失敗'
        : '排序失敗'
  } finally {
    reordering.value = false
    onReorderDragEnd()
  }
}

async function onSyncLayoutFromBuilder(assignments: ElectronicFormLayoutAssignment[]) {
  await syncFieldLayout(assignments)
}

async function onReorderDropAtRootEnd(e: DragEvent) {
  const paletteEntry = parseElectronicFormPaletteEntryFromDataTransfer(e.dataTransfer)
  if (paletteEntry) {
    await onPaletteDrop(paletteEntry, { kind: 'root' })
    onReorderDragEnd()
    onPaletteDragEnd()
    return
  }
  const dragId =
    e.dataTransfer?.getData('text/plain') || reorderDraggingId.value || ''
  if (!detail.value || !dragId) {
    onReorderDragEnd()
    return
  }
  const target: BuilderDropTarget = { type: 'append-root' }
  if (!canDropField(detail.value.fields, dragId, target)) {
    onReorderDragEnd()
    return
  }
  const assignments = moveFieldToContainer(detail.value.fields, dragId, null, null, null)
  await syncFieldLayout(assignments)
}

async function onDropPaletteOnEmptyCanvas(e: DragEvent) {
  const entry = parseElectronicFormPaletteEntryFromDataTransfer(e.dataTransfer)
  if (!entry) return
  await onPaletteDrop(entry, { kind: 'root' })
  onPaletteDragEnd()
}

async function doPublish() {
  if (!detail.value) return
  publishing.value = true
  errorMsg.value = ''
  try {
    await publishElectronicFormDefinition(detail.value.id, tenantIdQuery.value)
    publishOpen.value = false
    await loadDetail(detail.value.id)
  } catch (e: unknown) {
    errorMsg.value =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message ?? '發布失敗'
        : '發布失敗'
  } finally {
    publishing.value = false
  }
}
</script>

<template>
  <!-- 固定視窗內高度，避免 DefaultLayout 主區整頁捲動；捲動僅發生在三欄內各自 overflow -->
  <div
    class="flex h-[calc(100dvh-10rem)] max-h-[calc(100dvh-10rem)] min-h-0 flex-col gap-4 overflow-hidden"
  >
    <div class="flex shrink-0 flex-wrap items-center gap-3">
      <Button variant="outline" size="sm" class="h-8 gap-2" as-child>
        <RouterLink :to="ROUTE_PATH.ADMIN_ELECTRONIC_FORM_DEFINITIONS">
          <ArrowLeft class="size-4" />
          返回列表
        </RouterLink>
      </Button>
      <div v-if="detail" class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Input
          v-model="formNameLocal"
          class="h-8 max-w-md"
          :disabled="!isDraft || savingName"
          @blur="saveFormName"
          @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        />
        <span class="text-sm text-muted-foreground">
          {{ detail.status === 'draft' ? '草稿' : detail.status === 'published' ? '已發布' : '已封存' }}
        </span>
        <Button
          size="sm"
          class="h-8"
          :variant="builderCenterMode === 'edit' ? 'default' : 'outline'"
          @click="builderCenterMode = 'edit'"
        >
          編輯畫布
        </Button>
        <Button
          size="sm"
          class="h-8"
          :variant="builderCenterMode === 'preview' ? 'default' : 'outline'"
          :disabled="detail.fields.length === 0"
          @click="builderCenterMode = 'preview'"
        >
          預覽填寫
        </Button>
        <Button
          v-if="isDraft"
          size="sm"
          class="h-8 gap-1.5"
          variant="outline"
          :disabled="!canUndoBuilder || undoingBuilder || publishing"
          title="復原上一步（最多 5 次）"
          @click="runBuilderUndo"
        >
          <Undo2 class="size-3.5" aria-hidden="true" />
          上一步
        </Button>
        <Button
          v-if="isDraft"
          size="sm"
          class="h-8"
          variant="secondary"
          :disabled="publishing"
          @click="publishOpen = true"
        >
          發布
        </Button>
      </div>
    </div>

    <p v-if="errorMsg" class="shrink-0 text-sm text-destructive">{{ errorMsg }}</p>

    <div
      v-if="loading"
      class="flex min-h-0 flex-1 items-center justify-center text-muted-foreground"
    >
      <Loader2 class="size-8 animate-spin" />
    </div>

    <div
      v-else-if="detail"
      class="flex min-h-0 flex-1 gap-0 overflow-hidden rounded-lg border border-border bg-card"
    >
      <!-- 左：元件庫（預覽填寫時隱藏） -->
      <aside
        v-if="builderCenterMode !== 'preview'"
        class="flex min-h-0 w-52 shrink-0 flex-col overflow-hidden border-r border-border bg-muted/30"
      >
        <div class="border-b border-border px-3 py-2 text-sm font-medium text-foreground">元件庫</div>
        <ScrollArea class="min-h-0 flex-1">
          <div class="space-y-1 p-2">
            <div
              v-for="entry in ELECTRONIC_FORM_BUILDER_PALETTE"
              :key="entry.id"
              role="button"
              tabindex="0"
              class="flex h-9 w-full cursor-grab touch-none items-center gap-2 rounded-md border border-input bg-background px-2.5 text-left text-sm font-normal shadow-xs outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
              :class="paletteInteractionsDisabled ? 'pointer-events-none opacity-50' : ''"
              :draggable="!paletteInteractionsDisabled"
              @click="onPaletteAdd(entry)"
              @keydown.enter.prevent="onPaletteAdd(entry)"
              @dragstart="onPaletteDragStart($event, entry)"
              @dragend="onPaletteDragEnd"
            >
              <component
                :is="ELECTRONIC_FORM_FIELD_TYPE_ICONS[entry.fieldType]"
                class="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span class="min-w-0 truncate">{{ entry.label }}</span>
            </div>
          </div>
        </ScrollArea>
      </aside>

      <!-- 中：編輯畫布或預覽填寫（僅此欄垂直捲動） -->
      <main class="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
        <template v-if="builderCenterMode === 'preview'">
          <div class="mx-auto max-w-3xl">
            <ElectronicFormFillPreview
              :key="`fill-${detail.id}`"
              embedded
              :all-fields="displayFields"
              :form-title="formNameLocal.trim() || detail.name"
            />
          </div>
        </template>
        <template v-else>
          <p v-if="!isDraft" class="mb-4 shrink-0 text-sm text-muted-foreground">
            此表單已發布或封存，無法再編輯結構；請切換為「預覽填寫」於中央試填（不會儲存）。
          </p>
          <p
            v-if="isDraft && detail.fields.length > 0"
            class="mb-3 text-xs text-muted-foreground"
          >
            草稿：拖曳
            <GripVertical class="inline size-3.5 align-text-bottom text-muted-foreground" aria-hidden="true" />
            可調整順序；可從左側元件庫拖入欄位至畫布、區塊底部或多欄槽；選取卡片後可用 Cmd/Ctrl+C、Cmd/Ctrl+V 複製貼上整段子樹（含區塊內欄位）。
          </p>
          <div class="mx-auto max-w-3xl space-y-3">
            <div
              v-if="isDraft && rootFields.length === 0"
              class="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground transition-colors"
              @dragover.prevent="onEmptyCanvasDragOver"
              @drop.prevent="onDropPaletteOnEmptyCanvas($event)"
            >
              <p>尚未加入欄位。</p>
              <p class="text-xs">從左側拖曳元件類型至此，或點擊元件庫項目加入。</p>
            </div>
            <template v-for="f in rootFields" :key="f.id">
              <ElectronicFormBuilderDropGap
                v-if="isDraft"
                :before-field="f"
                :all-fields="displayFields"
                :is-draft="isDraft"
                :reordering="reordering"
                :reorder-drag-over-key="reorderDragOverKey"
                :canvas-drag-active="canvasDragActive"
                @drag-over="onBuilderDragOver"
                @drag-end="onReorderDragEnd"
                @sync-layout="onSyncLayoutFromBuilder"
                @palette-drop="(entry, placement) => void onPaletteDrop(entry, placement)"
              />
              <ElectronicFormBuilderFieldRow
                :field="f"
                :all-fields="displayFields"
                :selected-field-id="selectedFieldId"
                :is-draft="isDraft"
                :reordering="reordering"
                :duplicating-field-id="duplicatingFieldId"
                :actions-locked="pastingFields"
                :canvas-drag-active="canvasDragActive"
                :reorder-dragging-id="reorderDraggingId"
                :reorder-drag-over-key="reorderDragOverKey"
                @select="selectedFieldId = $event"
                @duplicate="duplicateField"
                @delete-request="openDeleteField($event)"
                @drag-start="onReorderDragStart"
                @drag-end="onReorderDragEnd"
                @drag-over="onBuilderDragOver"
                @sync-layout="onSyncLayoutFromBuilder"
                @palette-drop="(entry, placement) => void onPaletteDrop(entry, placement)"
              />
            </template>
            <div
              v-if="isDraft && rootFields.length > 0"
              class="flex min-h-[3.25rem] flex-col items-center justify-center rounded-lg border border-dashed px-3 py-2 text-center text-xs transition-all duration-150"
              :class="
                reorderDragOverKey === 'root-end'
                  ? 'border-primary/45 bg-card text-muted-foreground shadow-sm ring-1 ring-ring/25'
                  : 'border-border/60 text-muted-foreground hover:border-border hover:bg-muted/20'
              "
              @dragover.prevent="onRootEndDragOver"
              @drop.prevent="onReorderDropAtRootEnd($event)"
            >
              <span v-if="reorderDragOverKey === 'root-end'">放開以加到根層最後</span>
              <span v-else>拖到最底：插入根層最後，或放開元件庫項目</span>
            </div>
          </div>
        </template>
      </main>

      <!-- 右：屬性（預覽填寫時隱藏，中央留較大試填空間） -->
      <aside
        v-if="builderCenterMode !== 'preview'"
        class="flex min-h-0 w-80 shrink-0 flex-col overflow-hidden border-l border-border bg-muted/20"
      >
        <div class="shrink-0 border-b border-border px-3 py-2 text-sm font-medium text-foreground">
          欄位屬性
        </div>
        <div v-if="!selectedField" class="p-3 text-sm text-muted-foreground">請點選畫布上的欄位。</div>
        <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
          <ElectronicFormBuilderFieldInspector
            :key="selectedField.id"
            :field="selectedField"
            :is-draft="isDraft"
            :all-fields="displayFields"
            :busy="applyingInspector"
            @preview-change="onInspectorPreviewChange"
            @apply="onInspectorApply"
            @delete-request="openDeleteField(null)"
          />
        </div>
      </aside>
    </div>

    <AlertDialog v-model:open="publishOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>發布表單</AlertDialogTitle>
          <AlertDialogDescription>
            發布後將無法再編輯欄位與結構；專案內僅能使用已發布之表單建立填寫紀錄。確定要發布嗎？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="publishing">取消</AlertDialogCancel>
          <AlertDialogAction :disabled="publishing" @click="doPublish">確定發布</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog v-model:open="deleteFieldOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>刪除欄位</AlertDialogTitle>
          <AlertDialogDescription>
            確定要刪除此欄位嗎？草稿狀態下可透過「上一步」或 Cmd/Ctrl+Z 復原（最多五次）。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deletingField">取消</AlertDialogCancel>
          <AlertDialogAction :disabled="deletingField" @click="confirmDeleteField">刪除</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
