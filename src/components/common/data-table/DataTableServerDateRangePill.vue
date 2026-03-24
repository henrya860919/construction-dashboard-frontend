<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { CalendarIcon } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'

const props = withDefaults(
  defineProps<{
    title?: string
    from: string
    to: string
    disabled?: boolean
  }>(),
  { title: '時間區間', disabled: false },
)

const emit = defineEmits<{
  'update:from': [value: string]
  'update:to': [value: string]
}>()

const open = ref(false)
const draftFrom = ref('')
const draftTo = ref('')

watch(open, (isOpen) => {
  if (isOpen) {
    draftFrom.value = props.from
    draftTo.value = props.to
  }
})

const summary = computed(() => {
  if (!props.from && !props.to) return null
  if (props.from && props.to) return `${props.from}～${props.to}`
  if (props.from) return `${props.from} 起`
  return `至 ${props.to}`
})

function apply() {
  emit('update:from', draftFrom.value)
  emit('update:to', draftTo.value)
  open.value = false
}

function clearRange() {
  draftFrom.value = ''
  draftTo.value = ''
  emit('update:from', '')
  emit('update:to', '')
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="h-8 shrink-0 gap-1.5 border-dashed bg-background"
        :disabled="disabled"
      >
        <CalendarIcon class="size-4 shrink-0" />
        {{ title }}
        <template v-if="summary">
          <Separator orientation="vertical" class="mx-1 h-4" />
          <span class="text-muted-foreground max-w-[160px] truncate font-normal">{{ summary }}</span>
        </template>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-4" align="start">
      <div class="grid gap-3">
        <div class="grid gap-2">
          <Label class="text-xs text-muted-foreground">起日</Label>
          <Input v-model="draftFrom" type="date" class="h-8 bg-background" />
        </div>
        <div class="grid gap-2">
          <Label class="text-xs text-muted-foreground">迄日</Label>
          <Input v-model="draftTo" type="date" class="h-8 bg-background" />
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" class="h-8" @click="clearRange">
            清除
          </Button>
          <Button type="button" size="sm" class="h-8" @click="apply">套用</Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
