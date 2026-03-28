<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-vue-next'
import type { ElectronicFormDefinitionListItem } from '@/api/electronic-form-definitions'
import { duplicateElectronicFormDefinitionAsDraft } from '@/api/electronic-form-definitions'
import { buildAdminElectronicFormBuilderPath } from '@/constants/routes'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import { toast } from '@/components/ui/sonner'

const props = defineProps<{
  row: ElectronicFormDefinitionListItem
}>()

const emit = defineEmits<{ duplicated: [] }>()

const router = useRouter()
const authStore = useAuthStore()
const adminStore = useAdminStore()
const duplicating = ref(false)

const tenantIdQuery = () => {
  if (authStore.isPlatformAdmin) return adminStore.selectedTenantId ?? undefined
  return authStore.user?.tenantId ?? undefined
}

function openBuilder() {
  void router.push(buildAdminElectronicFormBuilderPath(props.row.id))
}

async function duplicateAsDraft() {
  const tid = tenantIdQuery()
  if (authStore.isPlatformAdmin && !tid) {
    toast.error('請先選擇租戶')
    return
  }
  duplicating.value = true
  try {
    const detail = await duplicateElectronicFormDefinitionAsDraft(props.row.id, tid)
    toast.success('已複製為新草稿，可編輯後發布（同系列不可刪除或變更既有欄位鍵與類型）')
    emit('duplicated')
    void router.push(buildAdminElectronicFormBuilderPath(detail.id))
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message ?? '複製失敗'
        : '複製失敗'
    toast.error(msg)
  } finally {
    duplicating.value = false
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="size-8" aria-label="更多">
        <MoreHorizontal class="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-[12rem]">
      <DropdownMenuItem class="cursor-pointer" @click="openBuilder">開啟 Builder</DropdownMenuItem>
      <DropdownMenuItem
        class="cursor-pointer"
        :disabled="duplicating"
        @click="duplicateAsDraft"
      >
        {{ duplicating ? '複製中…' : '複製為新草稿（升版）' }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
