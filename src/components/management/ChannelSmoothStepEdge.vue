<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { BaseEdge, getSmoothStepPath, Position } from '@vue-flow/core'
import type { Position as PositionType } from '@vue-flow/core'

const props = withDefaults(
  defineProps<{
    sourceX: number
    sourceY: number
    targetX: number
    targetY: number
    sourcePosition?: PositionType
    targetPosition?: PositionType
    borderRadius?: number
    offset?: number
    centerX?: number
    centerY?: number
    pathOptions?: { centerX?: number; centerY?: number; borderRadius?: number; offset?: number }
  }>(),
  {
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    borderRadius: 8,
    offset: 20,
  }
)

const attrs = useAttrs()

const pathParams = computed(() => {
  const opts = (props.pathOptions ?? {}) as Record<string, unknown>
  const a = attrs as Record<string, unknown>
  return {
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition ?? Position.Right,
    targetPosition: props.targetPosition ?? Position.Left,
    borderRadius: (opts.borderRadius ?? a.borderRadius ?? props.borderRadius) as number,
    offset: (opts.offset ?? a.offset ?? props.offset) as number,
    centerX: (opts.centerX ?? a.centerX ?? props.centerX) as number | undefined,
    centerY: (opts.centerY ?? a.centerY ?? props.centerY) as number | undefined,
  }
})

const pathResult = computed(() => getSmoothStepPath(pathParams.value))
const path = computed(() => pathResult.value[0])
const labelX = computed(() => pathResult.value[1])
const labelY = computed(() => pathResult.value[2])
</script>

<template>
  <BaseEdge
    :path="path"
    :label-x="labelX"
    :label-y="labelY"
    v-bind="$attrs"
  />
</template>
