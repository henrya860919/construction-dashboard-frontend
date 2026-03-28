<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import type { ElectronicFormFieldItem } from '@/api/electronic-form-definitions'
import { electronicFormFillPreviewValuesKey } from '@/lib/electronic-form-fill-preview'
import ElectronicFormFillPreviewDepth from './ElectronicFormFillPreviewDepth.vue'

const props = withDefaults(
  defineProps<{
    allFields: ElectronicFormFieldItem[]
    formTitle: string
    /** 建構器中央內嵌時使用較精簡的標題區 */
    embedded?: boolean
  }>(),
  { embedded: false }
)

const values = ref<Record<string, unknown>>({})
provide(electronicFormFillPreviewValuesKey, values)

const rootFields = computed(() =>
  props.allFields.filter((f) => f.parentFieldId == null).sort((a, b) => a.sortOrder - b.sortOrder)
)
</script>

<template>
  <div :class="embedded ? 'space-y-3' : 'space-y-4'">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">{{ formTitle }}</h1>
      <p v-if="embedded" class="mt-1 text-sm text-muted-foreground">
        試填預覽，不會儲存。條件顯示會隨輸入連動。
      </p>
      <p v-else class="mt-1 text-sm text-muted-foreground">
        可試填欄位；不會寫入後端。若欄位有設定條件顯示，會依其他欄位的值即時顯示或隱藏。
      </p>
    </div>
    <div class="space-y-4">
      <ElectronicFormFillPreviewDepth
        v-for="f in rootFields"
        :key="f.id"
        :field="f"
        :all-fields="allFields"
      />
      <p v-if="rootFields.length === 0" class="text-sm text-muted-foreground">此表單尚無欄位。</p>
    </div>
  </div>
</template>
