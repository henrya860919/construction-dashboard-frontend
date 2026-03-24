<script setup lang="ts">
import type { CheckboxRootProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { CheckIcon, MinusIcon } from '@radix-icons/vue'
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from "reka-ui"
import { cn } from "@/lib/utils"

type CheckedState = boolean | 'indeterminate'

const props = defineProps<CheckboxRootProps & {
  class?: HTMLAttributes["class"]
  /** 對應 reka-ui modelValue，支援全選／半選（indeterminate） */
  checked?: CheckedState
}>()

const emit = defineEmits<{
  'update:checked': [value: CheckedState]
}>()

const delegatedProps = reactiveOmit(props, "class", "checked")

const forwarded = useForwardPropsEmits(delegatedProps, emit as (name: string, ...args: unknown[]) => void)

const modelValue = computed({
  get: () => props.checked ?? false,
  set: (v: boolean | 'indeterminate') => emit('update:checked', v),
})
</script>

<template>
  <CheckboxRoot
    v-slot="slotProps"
    data-slot="checkbox"
    v-bind="forwarded"
    :model-value="modelValue"
    @update:model-value="(v: boolean | 'indeterminate') => emit('update:checked', v)"
    :class="
      cn('peer border-input data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
         props.class)"
  >
    <CheckboxIndicator
      data-slot="checkbox-indicator"
      class="grid place-content-center text-current transition-none"
    >
      <slot v-bind="slotProps">
        <MinusIcon v-if="slotProps.state === 'indeterminate'" class="size-3.5" />
        <CheckIcon v-else-if="slotProps.state === true" class="size-3.5" />
      </slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
