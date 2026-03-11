<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Upload, FileSpreadsheet, ArrowRight, AlertCircle } from 'lucide-vue-next'
import { ROUTE_PATH } from '@/constants'
import { API_PATH } from '@/constants/api'

const router = useRouter()

/** 選定的檔案（待上傳），之後可接實際上傳 API */
const selectedFile = ref<File | null>(null)
/** 是否正在上傳（之後接 API 時設為 true/false） */
const isUploading = ref(false)
/** 上傳結果訊息（之後接 API 成功/失敗時設定） */
const uploadMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

const hasFile = computed(() => !!selectedFile.value)
const fileName = computed(() => selectedFile.value?.name ?? '')

const acceptedExtensions = '.xlsx,.xls,.csv'
const acceptAttr = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv'

/** 下載 Excel 樣板：之後可改為呼叫 API_PATH.MONITORING_TEMPLATE 或開啟新視窗下載 */
function handleDownloadTemplate() {
  // TODO: 串接 GET API_PATH.MONITORING_TEMPLATE 取得檔案並觸發下載
  // 暫時：可改為 window.open(API_PATH.MONITORING_TEMPLATE) 或 axios.get(..., { responseType: 'blob' })
  uploadMessage.value = null
  console.log('下載樣板', API_PATH.MONITORING_TEMPLATE)
}

/** 選擇檔案 */
function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    selectedFile.value = file
    uploadMessage.value = null
  }
  input.value = ''
}

/** 拖曳進入 */
function onDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
}

/** 拖曳放下 */
function onDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  const file = e.dataTransfer?.files?.[0]
  if (file && /\.(xlsx|xls|csv)$/i.test(file.name)) {
    selectedFile.value = file
    uploadMessage.value = null
  }
}

/** 上傳：之後接 POST API_PATH.MONITORING_UPLOAD (FormData) */
async function handleUpload() {
  if (!selectedFile.value) return
  isUploading.value = true
  uploadMessage.value = null
  try {
    // TODO: 串接 API，例如：
    // const formData = new FormData(); formData.append('file', selectedFile.value);
    // await apiClient.post(API_PATH.MONITORING_UPLOAD, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    await new Promise((r) => setTimeout(r, 800))
    uploadMessage.value = { type: 'success', text: '上傳成功，歷史數據已更新。' }
    selectedFile.value = null
  } catch {
    uploadMessage.value = { type: 'error', text: '上傳失敗，請檢查檔案格式後重試。' }
  } finally {
    isUploading.value = false
  }
}

/** 清除已選檔案 */
function clearFile() {
  selectedFile.value = null
  uploadMessage.value = null
}

/** 前往歷史數據頁查看 */
function goToMetrics() {
  router.push(ROUTE_PATH.MONITORING_METRICS)
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-foreground">監測數據上傳</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        以「日」為單位填寫各監測項目，下載 Excel 樣板後填寫再上傳，系統將更新歷史數據。
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
          上傳前請確認已依樣板格式填寫，支援 .xlsx、.xls、.csv 格式。
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <!-- 拖曳 / 選擇檔案區 -->
        <div
          class="relative flex min-h-[160px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 transition-colors hover:bg-muted/50"
          :class="{ 'border-primary bg-primary/5': hasFile }"
          @dragover="onDragOver"
          @drop="onDrop"
        >
          <input
            type="file"
            :accept="acceptAttr"
            class="absolute inset-0 cursor-pointer opacity-0"
            @change="onFileSelect"
          >
          <Upload class="size-10 shrink-0 text-muted-foreground" />
          <p class="mt-2 text-sm font-medium text-foreground">
            {{ hasFile ? fileName : '拖曳檔案到這裡，或點擊選擇檔案' }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            支援 .xlsx、.xls、.csv
          </p>
          <Button
            v-if="hasFile"
            type="button"
            variant="ghost"
            size="sm"
            class="mt-3"
            @click.stop="clearFile"
          >
            清除
          </Button>
        </div>

        <!-- 上傳按鈕與結果訊息 -->
        <div class="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="default"
            class="gap-2"
            :disabled="!hasFile || isUploading"
            @click="handleUpload"
          >
            <Upload class="size-4" />
            {{ isUploading ? '上傳中…' : '上傳' }}
          </Button>
          <Button
            v-if="hasFile"
            type="button"
            variant="outline"
            @click="clearFile"
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
          <li>上傳後系統會更新歷史數據，您可在「歷史數據」頁面檢視圖表與列表。</li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
