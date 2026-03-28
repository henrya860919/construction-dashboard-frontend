import { computed, ref, toRaw, type Ref } from 'vue'
import type { ElectronicFormDefinitionDetail } from '@/api/electronic-form-definitions'
import { reconcileElectronicFormDefinitionToSnapshot } from '@/lib/electronic-form-builder-reconcile'

export type ElectronicFormBuilderUndoSnapshot = {
  detail: ElectronicFormDefinitionDetail
  formNameLocal: string
}

/** Vue reactive / Proxy 無法用 structuredClone；表單詳情為 JSON 形狀，用 JSON 深拷貝最穩。 */
function cloneFormDefinitionDetail(detail: ElectronicFormDefinitionDetail): ElectronicFormDefinitionDetail {
  return JSON.parse(JSON.stringify(toRaw(detail))) as ElectronicFormDefinitionDetail
}

function cloneSnapshot(
  detail: ElectronicFormDefinitionDetail,
  formNameLocal: string
): ElectronicFormBuilderUndoSnapshot {
  return {
    detail: cloneFormDefinitionDetail(detail),
    formNameLocal,
  }
}

const MAX_UNDO = 5

export function useElectronicFormBuilderUndo() {
  const stack = ref<ElectronicFormBuilderUndoSnapshot[]>([])
  const undoing = ref(false)

  const canUndo = computed(() => stack.value.length > 0)

  function clear() {
    stack.value = []
  }

  function push(detail: ElectronicFormDefinitionDetail, formNameLocal: string) {
    stack.value.push(cloneSnapshot(detail, formNameLocal))
    while (stack.value.length > MAX_UNDO) {
      stack.value.shift()
    }
  }

  async function undo(opts: {
    detail: Ref<ElectronicFormDefinitionDetail | null>
    formNameLocal: Ref<string>
    tenantId: () => string | undefined
    loadDetail: (id: string) => Promise<void>
    setError: (msg: string) => void
    onRestoreLocal: () => void
  }): Promise<void> {
    if (stack.value.length === 0 || !opts.detail.value || undoing.value) return
    undoing.value = true
    opts.setError('')
    const formId = opts.detail.value.id
    try {
      const prev = stack.value.pop()!
      opts.detail.value = cloneFormDefinitionDetail(prev.detail)
      opts.formNameLocal.value = prev.formNameLocal
      opts.onRestoreLocal()
      await reconcileElectronicFormDefinitionToSnapshot(
        prev.detail.id,
        opts.tenantId(),
        prev.detail.fields,
        { name: opts.formNameLocal.value.trim() || prev.detail.name }
      )
      await opts.loadDetail(prev.detail.id)
    } catch (e: unknown) {
      opts.setError(
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
              ?.message ?? '復原失敗'
          : e instanceof Error
            ? e.message
            : '復原失敗'
      )
      await opts.loadDetail(formId)
    } finally {
      undoing.value = false
    }
  }

  return { undoing, canUndo, clear, push, undo }
}
