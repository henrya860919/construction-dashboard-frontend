<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

export interface OrgTenantFlowData {
  name: string
  memberCount: number
  departmentCount: number
}

defineProps<{
  data: OrgTenantFlowData
}>()
</script>

<template>
  <div
    class="min-w-[240px] max-w-[300px] rounded-lg border-2 border-primary/40 bg-primary/10 px-3 py-3 shadow-md"
  >
    <div class="text-center text-sm font-medium uppercase tracking-wide text-primary">租戶</div>
    <div class="mt-1.5 text-center text-base font-semibold leading-tight text-foreground">
      {{ data.name }}
    </div>
    <div
      class="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-border/60 pt-2.5 text-sm text-muted-foreground"
    >
      <span>部門</span>
      <span class="tabular-nums text-foreground">{{ data.departmentCount }}</span>
      <span>成員</span>
      <span class="tabular-nums text-foreground">{{ data.memberCount }}</span>
    </div>
    <Handle
      type="source"
      :position="Position.Bottom"
      class="!-bottom-1 !left-1/2 !h-2 !w-2 !-translate-x-1/2 !border-2 !border-primary !bg-background"
    />
  </div>
</template>
