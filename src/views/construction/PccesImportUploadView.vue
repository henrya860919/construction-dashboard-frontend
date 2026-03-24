<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { isAxiosError } from 'axios'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { buildProjectPath, ROUTE_PATH, ROUTE_NAME } from '@/constants/routes'
import { uploadPccesImport, listPccesImports } from '@/api/pcces-imports'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { toast } from '@/components/ui/sonner'
import { Loader2, Upload } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => (route.params.projectId as string) ?? '')
const perm = useProjectModuleActions(projectId, 'construction.pcces')

const fileInputRef = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const versionLabel = ref('')
const submitting = ref(false)
const error = ref('')
const hasAnyImport = ref<boolean | null>(null)

/** 由明細頁帶入：xml＝自 XML 版進入；excel＝自 Excel 變更版進入（僅文案提示） */
const uploadContext = computed(() => {
  const q = route.query.context
  return typeof q === 'string' ? q : ''
})

const versionsPath = computed(() =>
  buildProjectPath(projectId.value, ROUTE_PATH.PROJECT_CONSTRUCTION_PCCES_VERSIONS)
)

async function checkExisting() {
  if (!projectId.value) return
  try {
    const list = await listPccesImports(projectId.value)
    hasAnyImport.value = list.length > 0
  } catch {
    hasAnyImport.value = null
  }
}

onMounted(() => checkExisting())
watch(projectId, () => checkExisting())

watch(hasAnyImport, (v) => {
  if (v === false) {
    versionLabel.value = '原契約'
  } else if (v === true) {
    versionLabel.value = ''
  }
})

function pickFile() {
  fileInputRef.value?.click()
}

function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0]
  file.value = f ?? null
  error.value = ''
}

async function submit() {
  if (!projectId.value || !file.value) {
    error.value = '請選擇 XML 檔案'
    return
  }
  const trimmedLabel = versionLabel.value.trim()
  if (hasAnyImport.value === true && !trimmedLabel) {
    error.value = '請填寫版本名稱（不預設，請自行輸入）'
    return
  }
  if (!perm.canCreate.value) {
    toast.error('您沒有匯入權限')
    return
  }
  submitting.value = true
  error.value = ''
  try {
    const labelForUpload =
      hasAnyImport.value === true
        ? trimmedLabel
        : trimmedLabel || '原契約'
    const created = await uploadPccesImport(projectId.value, file.value, {
      versionLabel: labelForUpload,
    })
    toast.success(`已匯入第 ${created.version} 版，共 ${created.itemCount} 筆工項`)
    await router.push({
      name: ROUTE_NAME.PROJECT_CONSTRUCTION_PCCES_VERSION_DETAIL,
      params: { projectId: projectId.value, importId: created.id },
    })
  } catch (e) {
    const msg = isAxiosError(e)
      ? (e.response?.data as { error?: { message?: string } })?.error?.message
      : null
    error.value = msg ?? '匯入失敗，請確認檔案為 PCCES eTender XML'
    toast.error(error.value)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <Button variant="outline" as-child>
        <RouterLink :to="versionsPath">返回列表</RouterLink>
      </Button>
    </div>

    <div>
      <h1 class="text-xl font-semibold text-foreground">PCCES／XML 匯入</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        <template v-if="hasAnyImport === false">
          首次匯入請上傳 PCCES 產出之 XML；下方<strong class="text-foreground">版本名稱</strong>預設為「原契約」，可自行修改。
        </template>
        <template v-else-if="hasAnyImport === true">
          上傳<strong class="text-foreground">完整 PCCES XML 標單</strong>以新增一版（與「Excel
          變更」產生之版本不同）。請填寫<strong class="text-foreground">版本名稱</strong>（不預設）。
        </template>
        <template v-else> 上傳 PCCES eTender 標單 XML（PayItem 樹狀結構）。 </template>
      </p>
      <p
        v-if="uploadContext === 'excel'"
        class="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
      >
        您是從「Excel 變更版」明細進入此頁。此處僅能上傳
        <strong class="text-foreground">XML 全量標單</strong>
        ；若要以變更清單產生下一版，請使用該版明細上的「Excel 變更」。
      </p>
      <p
        v-else-if="uploadContext === 'xml'"
        class="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
      >
        目前為<strong class="text-foreground"> XML 全量匯入</strong>流程（.xml）。Excel 變更請至「新增版本」選單中的
        <strong class="text-foreground">Excel 變更</strong>，或從某一版明細進入。
      </p>
    </div>

    <Card class="border-border bg-card">
      <CardHeader>
        <div class="flex items-center gap-2">
          <Upload class="size-5 text-muted-foreground" aria-hidden="true" />
          <CardTitle class="text-lg">選擇檔案</CardTitle>
        </div>
        <CardDescription> 僅支援副檔名 .xml；檔案會解析後寫入資料庫並嘗試歸檔至檔案儲存。 </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <input
          ref="fileInputRef"
          type="file"
          accept=".xml,application/xml,text/xml"
          class="sr-only"
          @change="onFileChange"
        />
        <div v-if="hasAnyImport !== null" class="space-y-2">
          <Label for="pcces-upload-version-label">版本名稱</Label>
          <Input
            id="pcces-upload-version-label"
            v-model="versionLabel"
            class="bg-background"
            :placeholder="
              hasAnyImport === false
                ? '原契約'
                : '請輸入此版名稱，例如：契約變更後全量標單'
            "
            autocomplete="off"
          />
          <p v-if="hasAnyImport === false" class="text-xs text-muted-foreground">
            預設為「原契約」；可改成專案慣用稱呼。之後仍可在明細頁修改。
          </p>
          <p v-else class="text-xs text-muted-foreground">
            不會自動帶入名稱，請依實務自行命名；之後可在明細修改。
          </p>
        </div>
        <div class="space-y-2">
          <Label>XML 檔案</Label>
          <div class="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" :disabled="!perm.canCreate.value" @click="pickFile">
              選擇檔案
            </Button>
            <span class="text-sm text-muted-foreground">
              {{ file ? file.name : '未選擇檔案' }}
            </span>
          </div>
        </div>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <Button
          type="button"
          :disabled="!file || submitting || !perm.canCreate.value"
          @click="submit"
        >
          <Loader2 v-if="submitting" class="size-4 animate-spin" />
          <span v-if="submitting">匯入中…</span>
          <span v-else>開始匯入</span>
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
