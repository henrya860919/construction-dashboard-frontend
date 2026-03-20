<script setup lang="ts">
import type { AlertDialogCancelProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { AlertDialogCancel } from "reka-ui"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const props = defineProps<AlertDialogCancelProps & { class?: HTMLAttributes["class"] }>()

const delegated = reactiveOmit(props, "class", "asChild")
</script>

<template>
  <AlertDialogCancel as-child v-bind="delegated">
    <Button type="button" variant="outline" :class="cn('mt-2 sm:mt-0', props.class)">
      <slot />
    </Button>
  </AlertDialogCancel>
</template>
