<script setup lang="ts">
import type { AlertDialogActionProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { AlertDialogAction } from "reka-ui"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const props = defineProps<AlertDialogActionProps & { class?: HTMLAttributes["class"] }>()

const delegated = reactiveOmit(props, "class", "asChild")
</script>

<template>
  <AlertDialogAction as-child v-bind="delegated">
    <Button type="button" :class="cn(props.class)">
      <slot />
    </Button>
  </AlertDialogAction>
</template>
