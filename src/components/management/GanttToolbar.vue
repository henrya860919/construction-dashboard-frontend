<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Flag } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    showActualPlan: boolean
    showCriticalPath: boolean
    showTodayLine: boolean
    showMilestoneLines: boolean
    showAssignee: boolean
    showProgress: boolean
    /** 為 false 時隱藏「新增里程碑線」（僅檢視甘特） */
    allowMilestoneMutations?: boolean
  }>(),
  { allowMilestoneMutations: true }
)

const emit = defineEmits<{
  'update:showActualPlan': [value: boolean]
  'update:showCriticalPath': [value: boolean]
  'update:showTodayLine': [value: boolean]
  'update:showMilestoneLines': [value: boolean]
  'update:showAssignee': [value: boolean]
  'update:showProgress': [value: boolean]
  addMilestoneLine: []
}>()
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-4 py-3"
  >
    <div class="flex flex-wrap items-center gap-4">
      <div class="flex items-center gap-2">
        <Switch
          :model-value="showActualPlan"
          @update:model-value="(v: boolean) => emit('update:showActualPlan', v)"
        />
        <Label class="text-muted-foreground cursor-pointer text-xs">
          實際／計劃
        </Label>
      </div>
      <div class="flex items-center gap-2">
        <Switch
          :model-value="showCriticalPath"
          @update:model-value="(v: boolean) => emit('update:showCriticalPath', v)"
        />
        <Label class="text-muted-foreground cursor-pointer text-xs">
          要徑
        </Label>
      </div>
      <div class="flex items-center gap-2">
        <Switch
          :model-value="showTodayLine"
          @update:model-value="(v: boolean) => emit('update:showTodayLine', v)"
        />
        <Label class="text-muted-foreground cursor-pointer text-xs">
          今日線
        </Label>
      </div>
      <div class="flex items-center gap-2">
        <Switch
          :model-value="showMilestoneLines"
          @update:model-value="(v: boolean) => emit('update:showMilestoneLines', v)"
        />
        <Label class="text-muted-foreground cursor-pointer text-xs">
          里程碑線
        </Label>
      </div>
      <div class="flex items-center gap-2">
        <Switch
          :model-value="showAssignee"
          @update:model-value="(v: boolean) => emit('update:showAssignee', v)"
        />
        <Label class="text-muted-foreground cursor-pointer text-xs">
          負責人
        </Label>
      </div>
      <div class="flex items-center gap-2">
        <Switch
          :model-value="showProgress"
          @update:model-value="(v: boolean) => emit('update:showProgress', v)"
        />
        <Label class="text-muted-foreground cursor-pointer text-xs">
          進度％
        </Label>
      </div>
    </div>
    <div v-if="allowMilestoneMutations" class="ml-auto flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        class="h-8"
        @click="emit('addMilestoneLine')"
      >
        <Flag class="mr-1 size-4" />
        新增里程碑線
      </Button>
    </div>
  </div>
</template>
