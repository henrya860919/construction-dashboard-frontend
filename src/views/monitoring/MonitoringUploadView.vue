<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Upload, FileSpreadsheet, ArrowRight, AlertCircle, X } from 'lucide-vue-next'
import { buildProjectPath } from '@/constants/routes'
import { API_PATH } from '@/constants/api'
import { useUploadQueue } from '@/composables/useUploadQueue'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => (route.params.projectId as string) ?? '')
const uploadPerm = useProjectModuleActions(projectId, 'construction.upload')
const { enqueueAndRun } = useUploadQueue()

/** 步驟二上傳區：僅 canCreate 顯示，不採常駐＋toast（見 docs/project-module-frontend-ui-gating.md） */

/** 選定的檔案（待上傳，可多選） */
const selectedFiles = ref<File[]>([])
/** 是否正在上傳 */
const isUploading = ref(false)
/** 上傳結果訊息（本頁顯示用；進度與清單請至 Header「檔案上傳進度」查看） */
const uploadMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

const hasFiles = computed(() => selectedFiles.value.length > 0)
const fileName = computed(() =>
  selectedFiles.value.length === 1
    ? selectedFiles.value[0].name
    : selectedFiles.value.length > 1
      ? `已選 ${selectedFiles.value.length} 個檔案`
      : ''
)

const acceptAttr = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv'

/** 下載 Excel 樣板：之後可改為呼叫 API_PATH.MONITORING_TEMPLATE 或開啟新視窗下載 */
function handleDownloadTemplate() {
  // TODO: 串接 GET API_PATH.MONITORING_TEMPLATE 取得檔案並觸發下載
  // 暫時：可改為 window.open(API_PATH.MONITORING_TEMPLATE) 或 axios.get(..., { responseType: 'blob' })
  uploadMessage.value = null
  console.log('下載樣板', API_PATH.MONITORING_TEMPLATE)
}

const acceptRegex = /\.(xlsx|xls|csv)$/i

function filterAccepted(files: FileList | File[]): File[] {
  return Array.from(files).filter((f) => acceptRegex.test(f.name))
}

/** 選擇檔案（可多選） */
function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const newFiles = input.files ? filterAccepted(input.files) : []
  if (newFiles.length) {
    selectedFiles.value = [...selectedFiles.value, ...newFiles]
    uploadMessage.value = null
  }
  input.value = ''
}

/** 拖曳進入 */
function onDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
}

/** 拖曳放下（可多檔） */
function onDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  const dropped = e.dataTransfer?.files ? filterAccepted(e.dataTransfer.files) : []
  if (dropped.length) {
    selectedFiles.value = [...selectedFiles.value, ...dropped]
    uploadMessage.value = null
  }
}

function removeSelectedFile(index: number) {
  selectedFiles.value = selectedFiles.value.filter((_, i) => i !== index)
}

/** 上傳：多檔並行，經由統一上傳佇列，進度顯示於 Header「檔案上傳進度」 */
async function handleUpload() {
  const files = selectedFiles.value
  if (!files.length || !projectId.value) return
  isUploading.value = true
  uploadMessage.value = null
  const runOne = async (onProgress: (p: number) => void) => {
    // TODO: 改為實際 API，例如 apiClient.post(API_PATH.MONITORING_UPLOAD, formData, { onUploadProgress: (e) => e.total && onProgress(Math.round((e.loaded / e.total) * 100)) })
    onProgress(0)
    await new Promise((r) => setTimeout(r, 400))
    onProgress(50)
    await new Promise((r) => setTimeout(r, 400))
    onProgress(100)
  }
  const results = await Promise.allSettled(
    files.map((file) =>
      enqueueAndRun(
        {
          fileName: file.name,
          fileSize: file.size,
          projectId: projectId.value,
          source: 'monitoring',
        },
        runOne
      )
    )
  )
  const succeeded = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length
  selectedFiles.value = []
  if (failed === 0) {
    uploadMessage.value = { type: 'success', text: '上傳成功，歷史數據已更新。' }
  } else {
    uploadMessage.value = {
      type: 'error',
      text: succeeded > 0 ? `${succeeded} 個成功，${failed} 個失敗，請至「檔案上傳進度」查看。` : '上傳失敗，請檢查檔案格式後重試。',
    }
  }
  isUploading.value = false
}

/** 清除已選檔案 */
function clearFiles() {
  selectedFiles.value = []
  uploadMessage.value = null
}

/** 前往歷史數據頁查看 */
function goToMetrics() {
  if (projectId.value) router.push(buildProjectPath(projectId.value, '/monitoring/history'))
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-foreground">監測數據上傳</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        以「日」為單位填寫各監測項目，
        <template v-if="uploadPerm.canCreate">下載 Excel 樣板後填寫再上傳，系統將更新歷史數據。</template>
        <template v-else>可下載 Excel 樣板備用；上傳與更新歷史數據需具建立權限。</template>
      </p>
    </div>

    <!-- 步驟一：下載樣板 -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-base">
          <FileSpreadsheet class="size-5 text-muted-foreground" />
          步驟一：下載 Excel 樣板
        </CardTitle>
        <CardDescription>
          樣板內含多個分頁，對應溫度、濕度、PM2.5、風速、雨量、水位等監測項目，每個分頁以「日期」與「當日最高 / 最低 / 平均」欄位填寫。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="default"
          class="gap-2"
          @click="handleDownloadTemplate"
        >
          <Download class="size-4" />
          下載 Excel 樣板
        </Button>
      </CardContent>
    </Card>

    <!-- 步驟二：上傳填寫後的檔案 -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-base">
          <Upload class="size-5 text-muted-foreground" />
          步驟二：上傳填寫後的資料
        </CardTitle>
        <CardDescription>
          上傳前請確認已依樣板格式填寫，支援 .xlsx、.xls、.csv，可多選檔案一次上傳。
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <p
          v-if="!uploadPerm.canCreate"
          class="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
        >
          您沒有上傳監測資料的權限；如需使用請洽專案管理員。
        </p>
        <!-- 拖曳 / 選擇檔案區（可多選） -->
        <div
          v-else
          class="relative flex min-h-[160px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 transition-colors hover:bg-muted/50"
          :class="{ 'border-primary bg-primary/5': hasFiles }"
          @dragover="onDragOver"
          @drop="onDrop"
        >
          <input
            type="file"
            :accept="acceptAttr"
            multiple
            class="absolute inset-0 cursor-pointer opacity-0"
            @change="onFileSelect"
          >
          <Upload class="size-10 shrink-0 text-muted-foreground" />
          <p class="mt-2 text-sm font-medium text-foreground">
            {{ hasFiles ? fileName : '拖曳檔案到這裡，或點擊選擇檔案（可多選）' }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            支援 .xlsx、.xls、.csv
          </p>
          <Button
            v-if="hasFiles"
            type="button"
            variant="ghost"
            size="sm"
            class="mt-3"
            @click.stop="clearFiles"
          >
            清除全部
          </Button>
        </div>

        <!-- 已選檔案清單 -->
        <ul
          v-if="selectedFiles.length"
          class="space-y-1 rounded-md border border-border bg-muted/30 p-2 max-h-40 overflow-y-auto"
        >
          <li
            v-for="(f, idx) in selectedFiles"
            :key="idx"
            class="flex items-center justify-between gap-2 text-sm text-foreground"
          >
            <span class="truncate">{{ f.name }}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-7 shrink-0"
              aria-label="移除"
              @click="removeSelectedFile(idx)"
            >
              <X class="size-4" />
            </Button>
          </li>
        </ul>

        <!-- 上傳按鈕與結果訊息 -->
        <div
          v-if="uploadPerm.canCreate"
          class="flex flex-wrap items-center gap-3"
        >
          <Button
            type="button"
            variant="default"
            class="gap-2"
            :disabled="!hasFiles || isUploading"
            @click="handleUpload"
          >
            <Upload class="size-4" />
            {{ isUploading ? '上傳中…' : hasFiles ? `上傳 ${selectedFiles.length} 個檔案` : '上傳' }}
          </Button>
          <Button
            v-if="hasFiles"
            type="button"
            variant="outline"
            @click="clearFiles"
          >
            取消
          </Button>
        </div>

        <!-- 上傳成功 / 錯誤訊息 -->
        <div
          v-if="uploadMessage"
          class="flex items-start gap-2 rounded-md border p-3 text-sm"
          :class="
            uploadMessage.type === 'success'
              ? 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400'
              : 'border-destructive/50 bg-destructive/10 text-destructive'
          "
        >
          <AlertCircle class="size-4 shrink-0 mt-0.5" />
          <span>{{ uploadMessage.text }}</span>
        </div>

        <!-- 上傳成功後可引導至歷史數據 -->
        <div
          v-if="uploadMessage?.type === 'success'"
          class="pt-2"
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="gap-2"
            @click="goToMetrics"
          >
            前往歷史數據查看
            <ArrowRight class="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- 填寫說明（可選） -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">填寫說明</CardTitle>
        <CardDescription>
          每個分頁代表一種監測項目，請以「一天一列」方式填寫當日的最高、最低、平均數值；日期格式請依樣板範例（如 YYYY-MM-DD）。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul class="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>溫度（°C）、濕度（%）、PM2.5（µg/m³）、風速（m/s）、雨量（mm）、水位（m）等分頁請依實際需求填寫。</li>
          <li v-if="uploadPerm.canCreate">上傳後系統會更新歷史數據，您可在「歷史數據」頁面檢視圖表與列表。</li>
          <li v-else>具建立權限者上傳後會更新歷史數據；您仍可在「歷史數據」頁面檢視圖表與列表。</li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
