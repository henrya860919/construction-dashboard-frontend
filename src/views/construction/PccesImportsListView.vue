<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { isAxiosError } from 'axios'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ROUTE_NAME } from '@/constants/routes'
import {
  listPccesImports,
  deletePccesImport,
  approvePccesImport,
  displayPccesVersionLabel,
  downloadPccesChangeListExcelTemplate,
  type PccesImportSummary,
} from '@/api/pcces-imports'
import { getApiErrorMessage } from '@/lib/api-error'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { toast } from '@/components/ui/sonner'
import {
  Loader2,
  Plus,
  ChevronDown,
  MoreHorizontal,
  Eye,
  Trash2,
  CheckCircle2,
  Download,
} from 'lucide-vue-next'

const route = useRoute()
const projectId = computed(() => (route.params.projectId as string) ?? '')
const perm = useProjectModuleActions(projectId, 'construction.pcces')

const list = ref<PccesImportSummary[]>([])
const loading = ref(true)

const deleteOpen = ref(false)
const deleteTarget = ref<PccesImportSummary | null>(null)
const deleteLoading = ref(false)
const approvingId = ref<string | null>(null)
const downloadingChangeListTemplate = ref(false)

/** 全量 XML 上傳（與明細頁帶入的 context 對齊） */
const uploadXmlRoute = computed(() => ({
  name: ROUTE_NAME.PROJECT_CONSTRUCTION_PCCES_UPLOAD,
  params: { projectId: projectId.value },
  query: { context: 'xml' },
}))

/** 列表新到舊，預設以最新一版為 Excel 變更基底 */
const excelChangeFromLatestRoute = computed(() => ({
  name: ROUTE_NAME.PROJECT_CONSTRUCTION_PCCES_EXCEL_CHANGE,
  params: { projectId: projectId.value },
  query:
    list.value.length > 0 ? { baseImportId: list.value[0].id } : ({} as Record<string, string>),
}))

async function fetchList() {
  if (!projectId.value) return
  loading.value = true
  try {
    list.value = await listPccesImports(projectId.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => fetchList())
watch(projectId, () => fetchList())

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 施工日誌選版用之「生效」日曆日顯示 */
function formatDailyLogEffective(row: PccesImportSummary) {
  if (!row.approvedAt) return '—'
  if (row.approvalEffectiveAt) return formatDate(row.approvalEffectiveAt)
  return `同核定 ${formatDate(row.approvedAt)}`
}

function openDelete(row: PccesImportSummary) {
  deleteTarget.value = row
  deleteOpen.value = true
}

function closeDeleteDialog() {
  deleteOpen.value = false
  deleteTarget.value = null
}

async function approveImport(row: PccesImportSummary) {
  if (!projectId.value) return
  if (!perm.canUpdate.value) {
    toast.error('您沒有核定權限')
    return
  }
  if (row.approvedAt) return
  approvingId.value = row.id
  try {
    await approvePccesImport(projectId.value, row.id)
    toast.success(`第 ${row.version} 版已核定`)
    await fetchList()
  } catch (e) {
    const msg = isAxiosError(e)
      ? (e.response?.data as { error?: { message?: string } })?.error?.message
      : null
    toast.error(msg ?? '核定失敗')
  } finally {
    approvingId.value = null
  }
}

async function downloadChangeListTemplateFile() {
  if (!projectId.value || downloadingChangeListTemplate.value) return
  downloadingChangeListTemplate.value = true
  try {
    await downloadPccesChangeListExcelTemplate(projectId.value)
    toast.success('已下載樣板')
  } catch (e) {
    toast.error('下載樣板失敗', { description: getApiErrorMessage(e) })
  } finally {
    downloadingChangeListTemplate.value = false
  }
}

async function confirmDelete() {
  if (!projectId.value || !deleteTarget.value) return
  if (!perm.canDelete.value) {
    toast.error('您沒有刪除權限')
    return
  }
  deleteLoading.value = true
  try {
    await deletePccesImport(projectId.value, deleteTarget.value.id)
    toast.success(`已刪除第 ${deleteTarget.value.version} 版匯入`)
    closeDeleteDialog()
    await fetchList()
  } catch (e) {
    const msg = isAxiosError(e)
      ? (e.response?.data as { error?: { message?: string } })?.error?.message
      : null
    toast.error(msg ?? '刪除失敗')
  } finally {
    deleteLoading.value = false
  }
}
</script>

<template>
  <div class="min-w-0 space-y-4">
    <div>
      <h1 class="text-xl font-semibold text-foreground">PCCES 匯入紀錄</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        依版次新到舊排列；第 1 版顯示為「原契約」，其餘版本名稱於上傳或 Excel
        確認時自訂，可於明細修改。各版可另填「核定生效時間」供施工日誌依填表日對應契約欄位版本。可刪除整次匯入（軟刪除，無法復原）。
      </p>
    </div>

    <div v-if="!perm.canRead.value" class="text-sm text-muted-foreground">
      您沒有 PCCES 匯入檢視權限（<code class="rounded bg-muted px-1 py-0.5 text-xs">construction.pcces</code>）。
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="outline"
          :disabled="downloadingChangeListTemplate || loading"
          @click="downloadChangeListTemplateFile"
        >
          <Download
            class="size-4"
            :class="{ 'animate-pulse': downloadingChangeListTemplate }"
            aria-hidden="true"
          />
          {{ downloadingChangeListTemplate ? '下載中…' : '下載樣板' }}
        </Button>
        <template v-if="perm.canCreate.value">
          <Button v-if="loading" disabled class="gap-2">
            <Loader2 class="size-4 animate-spin" />
            載入中…
          </Button>
          <Button v-else-if="list.length === 0" class="gap-2" as-child>
            <RouterLink :to="uploadXmlRoute" class="inline-flex items-center gap-2">
              <Plus class="size-4" />
              首次匯入（XML）
            </RouterLink>
          </Button>
          <DropdownMenu v-else>
            <DropdownMenuTrigger as-child>
              <Button type="button" class="gap-2">
                <Plus class="size-4" />
                新增版本
                <ChevronDown class="size-4 opacity-70" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-[min(20rem,calc(100vw-2rem))]">
              <DropdownMenuItem as-child class="cursor-pointer">
                <RouterLink :to="uploadXmlRoute" class="flex w-full flex-col items-start gap-0.5 py-2">
                  <span class="font-medium">上傳 PCCES XML</span>
                  <span class="text-xs font-normal text-muted-foreground">
                    完整 eTender 標單；與 Excel 變更產生的版本不同
                  </span>
                </RouterLink>
              </DropdownMenuItem>
              <DropdownMenuItem as-child class="cursor-pointer">
                <RouterLink
                  :to="excelChangeFromLatestRoute"
                  class="flex w-full flex-col items-start gap-0.5 py-2"
                >
                  <span class="font-medium">Excel 變更</span>
                  <span class="text-xs font-normal text-muted-foreground">
                    以目前列表最上方（最新）版本為基底；若要以其他版為基底，請至該版明細頁使用「Excel 變更」
                  </span>
                </RouterLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </template>
      </div>

      <div
        class="min-w-0 overflow-x-auto rounded-lg border border-border bg-card p-4 overscroll-x-contain"
      >
        <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 class="size-8 animate-spin" />
        </div>
        <div v-else-if="list.length === 0" class="text-sm text-muted-foreground">
          尚無匯入紀錄。
          <RouterLink
            v-if="perm.canCreate.value"
            :to="uploadXmlRoute"
            class="text-primary underline-offset-4 hover:underline"
          >
            前往首次匯入
          </RouterLink>
        </div>
        <!-- 由卡片負責水平捲動，避免寬表格撐開 main 造成整頁橫向捲動 -->
        <Table v-else :scroll-container="false">
          <TableHeader>
            <TableRow>
              <TableHead class="min-w-[8rem]">版次</TableHead>
              <TableHead>版本名稱</TableHead>
              <TableHead>檔名</TableHead>
              <TableHead>類型</TableHead>
              <TableHead>筆數</TableHead>
              <TableHead>匯入時間</TableHead>
              <TableHead class="min-w-[10rem]">生效（日誌）</TableHead>
              <TableHead class="text-center">核定</TableHead>
              <TableHead class="text-end">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in list" :key="row.id">
              <TableCell class="tabular-nums font-medium text-muted-foreground">
                第 {{ row.version }} 版
              </TableCell>
              <TableCell class="font-medium text-foreground">
                {{ displayPccesVersionLabel(row) }}
              </TableCell>
              <TableCell>{{ row.fileName }}</TableCell>
              <TableCell class="text-muted-foreground">{{ row.documentType ?? '—' }}</TableCell>
              <TableCell class="tabular-nums text-sm text-muted-foreground">
                {{ row.itemCount }}（葉節點 {{ row.generalCount }}）
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">{{ formatDate(row.createdAt) }}</TableCell>
              <TableCell class="text-xs text-muted-foreground">{{ formatDailyLogEffective(row) }}</TableCell>
              <TableCell class="text-center text-sm">
                <span v-if="row.approvedAt" class="text-muted-foreground">已核定</span>
                <span v-else class="font-medium text-foreground">待核定</span>
              </TableCell>
              <TableCell class="text-end">
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon" class="size-8 shrink-0" aria-label="更多">
                      <MoreHorizontal class="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-44">
                    <DropdownMenuItem as-child class="cursor-pointer gap-2">
                      <RouterLink
                        :to="{
                          name: ROUTE_NAME.PROJECT_CONSTRUCTION_PCCES_VERSION_DETAIL,
                          params: { projectId, importId: row.id },
                        }"
                        class="flex items-center gap-2"
                      >
                        <Eye class="size-4" />
                        查看工項
                      </RouterLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="perm.canUpdate.value && !row.approvedAt"
                      class="cursor-pointer gap-2"
                      :disabled="approvingId === row.id"
                      @click="approveImport(row)"
                    >
                      <Loader2
                        v-if="approvingId === row.id"
                        class="size-4 animate-spin"
                      />
                      <CheckCircle2 v-else class="size-4" />
                      核定此版本
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="perm.canDelete.value"
                      class="cursor-pointer gap-2 text-destructive focus:text-destructive"
                      @click="openDelete(row)"
                    >
                      <Trash2 class="size-4" />
                      刪除此版本
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </template>

    <AlertDialog :open="deleteOpen" @update:open="(v: boolean) => !v && closeDeleteDialog()">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>刪除此匯入版本？</AlertDialogTitle>
          <AlertDialogDescription>
            將一併移除第 {{ deleteTarget?.version }} 版的所有工項與歸檔 XML（軟刪除，後台無法復原）。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleteLoading">取消</AlertDialogCancel>
          <Button variant="destructive" :disabled="deleteLoading" @click="confirmDelete">
            <Loader2 v-if="deleteLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
