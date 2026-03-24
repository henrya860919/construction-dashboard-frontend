<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROUTE_NAME } from '@/constants/routes'
import type { PccesImportSummary } from '@/api/pcces-imports'
import { Loader2, MoreHorizontal, Eye, Trash2, CheckCircle2 } from 'lucide-vue-next'

defineProps<{
  row: PccesImportSummary
  projectId: string
  showApprove: boolean
  canDelete: boolean
  approvingId: string | null
}>()

const emit = defineEmits<{
  approve: [row: PccesImportSummary]
  delete: [row: PccesImportSummary]
}>()
</script>

<template>
  <div class="flex justify-end">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" size="icon" class="size-8 shrink-0" aria-label="更多">
          <MoreHorizontal class="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-44">
        <DropdownMenuItem as-child class="cursor-pointer gap-2">
          <RouterLink
            :to="{
              name: ROUTE_NAME.PROJECT_CONSTRUCTION_PCCES_VERSION_DETAIL,
              params: { projectId, importId: row.id },
            }"
            class="flex items-center gap-2"
          >
            <Eye class="size-4" />
            查看工項
          </RouterLink>
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="showApprove"
          class="cursor-pointer gap-2"
          :disabled="approvingId === row.id"
          @click="emit('approve', row)"
        >
          <Loader2 v-if="approvingId === row.id" class="size-4 animate-spin" />
          <CheckCircle2 v-else class="size-4" />
          核定此版本
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="canDelete"
          class="cursor-pointer gap-2 text-destructive focus:text-destructive"
          @click="emit('delete', row)"
        >
          <Trash2 class="size-4" />
          刪除此版本
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
