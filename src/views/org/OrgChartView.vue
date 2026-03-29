<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchOrgTree, type OrgTreeResponse } from '@/api/organization'
import OrgDeptTree from '@/components/org/OrgDeptTree.vue'
import { Loader2 } from 'lucide-vue-next'

const loading = ref(true)
const errorMessage = ref('')
const tree = ref<OrgTreeResponse | null>(null)

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    tree.value = await fetchOrgTree()
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    errorMessage.value = ax.response?.data?.error?.message ?? '無法載入組織資料'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="p-4 md:p-6">
    <h1 class="text-xl font-semibold tracking-tight text-foreground">組織架構</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      依部門檢視<strong class="font-medium text-foreground">內部成員</strong>與職稱（唯讀）；外部協力不列入此圖。
    </p>

    <div v-if="loading" class="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 class="size-8 animate-spin" aria-hidden="true" />
    </div>
    <p v-else-if="errorMessage" class="mt-6 text-sm text-destructive">{{ errorMessage }}</p>
    <template v-else-if="tree">
      <div
        class="mt-6 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
      >
        共 {{ tree.departmentCount }} 個部門、{{ tree.memberCount }} 位內部組織成員
      </div>
      <div class="mt-6">
        <OrgDeptTree v-if="tree.departments.length" :nodes="tree.departments" />
        <p v-else class="text-sm text-muted-foreground">尚未建立部門。</p>
      </div>
    </template>
  </div>
</template>
