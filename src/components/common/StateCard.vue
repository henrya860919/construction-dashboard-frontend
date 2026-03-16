<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const props = defineProps<{
  title: string
  progress?: number
  class?: string
}>()
</script>

<template>
  <Card :class="cn(props.class)">
    <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle class="text-lg font-medium text-foreground">
        {{ props.title }}
      </CardTitle>
      <slot name="icon" />
    </CardHeader>
    <CardContent>
      <slot />
      <div v-if="typeof props.progress === 'number'" class="mt-3">
        <Progress :model-value="props.progress" />
      </div>
    </CardContent>
  </Card>
</template>
