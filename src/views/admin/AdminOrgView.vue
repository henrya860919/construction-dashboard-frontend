<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick, provide } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ROUTE_PATH } from '@/constants'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import {
  fetchOrgTree,
  adminListOrgDepartments,
  adminCreateOrgDepartment,
  adminUpdateOrgDepartment,
  adminDeleteOrgDepartment,
  type OrgTreeResponse,
  type OrgDepartmentDto,
  type OrgDeptTreeNode,
} from '@/api/organization'
import { orgDeptAdminKey } from '@/composables/org-dept-admin-context'
import { orgDeptDetailKey } from '@/composables/org-dept-detail-context'
import OrgDeptTree from '@/components/org/OrgDeptTree.vue'
import OrgDeptDetailPanel from '@/components/org/OrgDeptDetailPanel.vue'
import OrgNetworkDiagram from '@/components/org/OrgNetworkDiagram.vue'
import { getAdminTenantInfo } from '@/api/admin'
import StateCard from '@/components/common/StateCard.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Loader2, Plus, Building2, Users, Network } from 'lucide-vue-next'

const authStore = useAuthStore()
const adminStore = useAdminStore()
const route = useRoute()
const router = useRouter()

const tenantIdQuery = computed(() => {
  if (authStore.isPlatformAdmin) return adminStore.selectedTenantId ?? undefined
  return authStore.user?.tenantId ?? undefined
})

const platformNeedsTenant = computed(
  () => authStore.isPlatformAdmin && !adminStore.selectedTenantId
)

const activeTab = ref<'chart' | 'network'>('chart')

function syncOrgTabFromQuery() {
  const raw = route.query.tab
  const t = Array.isArray(raw) ? raw[0] : raw
  if (t === 'network' || t === 'chart') {
    activeTab.value = t
  }
}

watch(
  () => route.query.tab,
  () => {
    const raw = route.query.tab
    const t = Array.isArray(raw) ? raw[0] : raw
    if (t === 'people') {
      void router.replace({ path: ROUTE_PATH.HR_ORG_MEMBERS })
      return
    }
    syncOrgTabFromQuery()
  },
  { immediate: true }
)

const loading = ref(true)
const errorMessage = ref('')
const tree = ref<OrgTreeResponse | null>(null)
const flatDepts = ref<OrgDepartmentDto[]>([])
const tenantDisplayName = ref('')
const orgNetworkRef = ref<InstanceType<typeof OrgNetworkDiagram> | null>(null)
/** 組織網路圖節點是否列出成員／職稱 */
const showOrgNetworkMembers = ref(true)

const dialogOpen = ref(false)
const formName = ref('')
const formParentId = ref<string>('__root__')
const submitting = ref(false)
const formError = ref('')

function findNodeById(nodes: OrgDeptTreeNode[], id: string): OrgDeptTreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNodeById(n.children, id)
    if (found) return found
  }
  return null
}

function collectDescendantIds(root: OrgDeptTreeNode): Set<string> {
  const s = new Set<string>()
  function walk(n: OrgDeptTreeNode) {
    s.add(n.id)
    for (const c of n.children) walk(c)
  }
  walk(root)
  return s
}

const editDialogOpen = ref(false)
const editingDeptId = ref<string | null>(null)
const editFormName = ref('')
const editFormParentId = ref<string>('__root__')
const editFormStatus = ref<'active' | 'archived'>('active')
const editFormError = ref('')
const editSubmitting = ref(false)

const deleteTarget = ref<OrgDeptTreeNode | null>(null)
const deleteSubmitting = ref(false)
const deleteErrorMessage = ref('')

const editExcludedIds = computed(() => {
  if (!tree.value || !editingDeptId.value) return new Set<string>()
  const node = findNodeById(tree.value.departments, editingDeptId.value)
  if (!node) return new Set<string>()
  return collectDescendantIds(node)
})

const editParentOptions = computed(() => {
  const roots = { label: '（頂層）', value: '__root__' as const }
  const ex = editExcludedIds.value
  return [
    roots,
    ...flatDepts.value.filter((d) => !ex.has(d.id)).map((d) => ({ label: d.name, value: d.id })),
  ]
})

function openEditDept(node: OrgDeptTreeNode) {
  editingDeptId.value = node.id
  editFormName.value = node.name
  editFormParentId.value = node.parentId ?? '__root__'
  editFormStatus.value = node.status === 'archived' ? 'archived' : 'active'
  editFormError.value = ''
  editDialogOpen.value = true
}

function openDeleteDept(node: OrgDeptTreeNode) {
  deleteTarget.value = node
  deleteErrorMessage.value = ''
}

provide(orgDeptAdminKey, {
  disabled: platformNeedsTenant,
  edit: openEditDept,
  delete: openDeleteDept,
})

const selectedDeptDetail = ref<OrgDeptTreeNode | null>(null)
const deptDetailSheetOpen = ref(false)

function openDeptDetail(node: OrgDeptTreeNode) {
  selectedDeptDetail.value = node
  deptDetailSheetOpen.value = true
}

const detailParentName = computed(() => {
  const d = selectedDeptDetail.value
  if (!d?.parentId) return null
  const p = flatDepts.value.find((x) => x.id === d.parentId)
  return p?.name ?? null
})

function onDeptDetailSheetOpenChange(v: boolean) {
  deptDetailSheetOpen.value = v
  if (!v) selectedDeptDetail.value = null
}

provide(orgDeptDetailKey, { openDetail: openDeptDetail })

const parentOptions = computed(() => {
  const roots = { label: '（頂層）', value: '__root__' as const }
  return [roots, ...flatDepts.value.map((d) => ({ label: d.name, value: d.id }))]
})

const rootDeptCount = computed(() => tree.value?.departments.length ?? 0)

async function loadChart() {
  if (platformNeedsTenant.value) {
    tree.value = null
    flatDepts.value = []
    tenantDisplayName.value = ''
    loading.value = false
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const tid = tenantIdQuery.value
    const [t, flat, tenantInfo] = await Promise.all([
      fetchOrgTree(tid),
      adminListOrgDepartments(tid),
      getAdminTenantInfo(tid).catch(() => null),
    ])
    tree.value = t
    flatDepts.value = flat
    tenantDisplayName.value = tenantInfo?.name?.trim() || ''
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    errorMessage.value = ax.response?.data?.error?.message ?? '無法載入組織資料'
    tree.value = null
    tenantDisplayName.value = ''
  } finally {
    loading.value = false
  }
}

async function submitEditDept() {
  if (!editingDeptId.value) return
  editFormError.value = ''
  const name = editFormName.value.trim()
  if (!name) {
    editFormError.value = '請輸入部門名稱'
    return
  }
  editSubmitting.value = true
  try {
    await adminUpdateOrgDepartment(
      editingDeptId.value,
      {
        name,
        parentId: editFormParentId.value === '__root__' ? null : editFormParentId.value,
        status: editFormStatus.value,
      },
      tenantIdQuery.value
    )
    editDialogOpen.value = false
    editingDeptId.value = null
    await loadChart()
    if (activeTab.value === 'network') nextTick(() => orgNetworkRef.value?.fitView?.())
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    editFormError.value = ax.response?.data?.error?.message ?? '更新失敗'
  } finally {
    editSubmitting.value = false
  }
}

async function confirmDeleteDept() {
  if (!deleteTarget.value) return
  deleteErrorMessage.value = ''
  deleteSubmitting.value = true
  try {
    await adminDeleteOrgDepartment(deleteTarget.value.id, tenantIdQuery.value)
    deleteTarget.value = null
    await loadChart()
    if (activeTab.value === 'network') nextTick(() => orgNetworkRef.value?.fitView?.())
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    deleteErrorMessage.value = ax.response?.data?.error?.message ?? '刪除失敗'
  } finally {
    deleteSubmitting.value = false
  }
}

async function submitCreate() {
  formError.value = ''
  const name = formName.value.trim()
  if (!name) {
    formError.value = '請輸入部門名稱'
    return
  }
  submitting.value = true
  try {
    await adminCreateOrgDepartment(
      {
        name,
        parentId: formParentId.value === '__root__' ? null : formParentId.value,
      },
      tenantIdQuery.value
    )
    dialogOpen.value = false
    formName.value = ''
    formParentId.value = '__root__'
    await loadChart()
    if (activeTab.value === 'network') nextTick(() => orgNetworkRef.value?.fitView?.())
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    formError.value = ax.response?.data?.error?.message ?? '建立失敗'
  } finally {
    submitting.value = false
  }
}

watch(tenantIdQuery, () => {
  void loadChart()
  if (activeTab.value === 'network') nextTick(() => orgNetworkRef.value?.fitView?.())
})

watch(activeTab, (t, prev) => {
  if (prev === 'network' && t !== 'network') {
    deptDetailSheetOpen.value = false
    selectedDeptDetail.value = null
  }
  if (t === 'network') nextTick(() => orgNetworkRef.value?.fitView?.())
})

function onEditDialogOpenChange(open: boolean) {
  if (!open) editingDeptId.value = null
}

function onDeleteDialogOpenChange(open: boolean) {
  if (!open && !deleteSubmitting.value) {
    deleteTarget.value = null
    deleteErrorMessage.value = ''
  }
}

onMounted(() => {
  void loadChart()
  if (activeTab.value === 'network') nextTick(() => orgNetworkRef.value?.fitView?.())
})
</script>

<template>
  <div
    class="flex h-[calc(100dvh-10.75rem)] max-h-[calc(100dvh-10.75rem)] min-h-0 flex-col gap-4 overflow-hidden md:h-[calc(100dvh-9.5rem)] md:max-h-[calc(100dvh-9.5rem)]"
  >
    <div class="shrink-0">
      <h1 class="text-xl font-semibold tracking-tight text-foreground">組織管理</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        以組織圖／網路圖管理部門樹。內部成員之組織指派請至側欄「
        <RouterLink
          :to="ROUTE_PATH.HR_ORG_MEMBERS"
          class="text-primary underline-offset-4 hover:underline"
        >
          組織成員
        </RouterLink>
        」；外部成員為組織外協力，不顯示於組織圖。租戶帳號、內外部類型與權限範本請至
        <RouterLink
          :to="ROUTE_PATH.ADMIN_MEMBERS"
          class="text-primary underline-offset-4 hover:underline"
        >
          租戶成員
        </RouterLink>
        。專案內權限仍於各專案「專案成員」管理。
      </p>
      <p v-if="platformNeedsTenant" class="mt-2 text-sm text-destructive">
        請先於平台後台選擇租戶後再管理組織。
      </p>
    </div>

    <Tabs v-model="activeTab" class="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden">
      <TabsList class="grid w-full max-w-md shrink-0 grid-cols-2">
        <TabsTrigger value="chart">組織圖</TabsTrigger>
        <TabsTrigger value="network">網路圖</TabsTrigger>
      </TabsList>

      <TabsContent value="chart" class="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-3">
          <Button variant="outline" size="sm" as-child>
            <RouterLink :to="ROUTE_PATH.HR_POSITIONS">職位管理</RouterLink>
          </Button>
          <Dialog v-model:open="dialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" :disabled="platformNeedsTenant">
                <Plus class="size-4" aria-hidden="true" />
                新增部門
              </Button>
            </DialogTrigger>
            <DialogContent class="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>新增部門</DialogTitle>
                <DialogDescription>建立租戶內部門節點，可稍後再調整排序或上層。</DialogDescription>
              </DialogHeader>
              <div class="grid gap-4 py-2">
                <div class="grid gap-2">
                  <Label for="org-dept-name">名稱</Label>
                  <Input id="org-dept-name" v-model="formName" placeholder="例如：工程部" />
                </div>
                <div class="grid gap-2">
                  <Label>上層部門</Label>
                  <Select v-model="formParentId">
                    <SelectTrigger>
                      <SelectValue placeholder="選擇上層" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="opt in parentOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" @click="dialogOpen = false">取消</Button>
                <Button type="button" :disabled="submitting" @click="submitCreate">
                  {{ submitting ? '建立中…' : '建立' }}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div
          v-if="loading"
          class="flex shrink-0 items-center justify-center py-16 text-muted-foreground"
        >
          <Loader2 class="size-8 animate-spin" aria-hidden="true" />
        </div>
        <p v-else-if="errorMessage" class="shrink-0 text-sm text-destructive">{{ errorMessage }}</p>
        <template v-else-if="tree">
          <div class="grid shrink-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StateCard title="部門數">
              <template #icon>
                <Building2 class="size-6 text-muted-foreground" />
              </template>
              <div class="text-3xl font-bold tabular-nums text-foreground">
                {{ tree.departmentCount }}
              </div>
              <p class="text-xs text-muted-foreground">租戶內有效部門</p>
            </StateCard>
            <StateCard title="組織人員">
              <template #icon>
                <Users class="size-6 text-muted-foreground" />
              </template>
              <div class="text-3xl font-bold tabular-nums text-foreground">
                {{ tree.memberCount }}
              </div>
              <p class="text-xs text-muted-foreground">內部成員之進行中指派</p>
            </StateCard>
            <StateCard title="頂層部門">
              <template #icon>
                <Network class="size-6 text-muted-foreground" />
              </template>
              <div class="text-3xl font-bold tabular-nums text-foreground">
                {{ rootDeptCount }}
              </div>
              <p class="text-xs text-muted-foreground">無上層之父節點數</p>
            </StateCard>
          </div>
          <div
            class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-muted/30 md:flex-row md:items-stretch"
          >
            <div class="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-1">
              <OrgDeptTree v-if="tree.departments.length" :nodes="tree.departments" />
              <p v-else class="p-3 text-sm text-muted-foreground">尚未建立部門，請使用「新增部門」。</p>
            </div>
            <aside
              v-if="deptDetailSheetOpen && selectedDeptDetail"
              class="flex max-h-[min(45vh,320px)] w-full shrink-0 flex-col overflow-y-auto overscroll-contain border-t border-border bg-background md:max-h-none md:w-[17.5rem] md:border-t-0 md:border-l"
            >
              <OrgDeptDetailPanel
                class="min-h-0 flex-1 md:h-full"
                :department="selectedDeptDetail"
                :parent-name="detailParentName"
                compact
                show-close
                @close="onDeptDetailSheetOpenChange(false)"
              />
            </aside>
          </div>
        </template>
      </TabsContent>

      <TabsContent value="network" class="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div class="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <Switch id="org-network-show-members" v-model="showOrgNetworkMembers" />
            <Label
              for="org-network-show-members"
              class="cursor-pointer text-sm font-normal text-muted-foreground"
            >
              網路圖顯示成員
            </Label>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-3">
          <Button variant="outline" size="sm" as-child>
            <RouterLink :to="ROUTE_PATH.HR_POSITIONS">職位管理</RouterLink>
          </Button>
          <Dialog v-model:open="dialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" :disabled="platformNeedsTenant">
                <Plus class="size-4" aria-hidden="true" />
                新增部門
              </Button>
            </DialogTrigger>
            <DialogContent class="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>新增部門</DialogTitle>
                <DialogDescription>建立租戶內部門節點，可稍後再調整排序或上層。</DialogDescription>
              </DialogHeader>
              <div class="grid gap-4 py-2">
                <div class="grid gap-2">
                  <Label for="org-dept-name-net">名稱</Label>
                  <Input id="org-dept-name-net" v-model="formName" placeholder="例如：工程部" />
                </div>
                <div class="grid gap-2">
                  <Label>上層部門</Label>
                  <Select v-model="formParentId">
                    <SelectTrigger>
                      <SelectValue placeholder="選擇上層" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="opt in parentOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" @click="dialogOpen = false">取消</Button>
                <Button type="button" :disabled="submitting" @click="submitCreate">
                  {{ submitting ? '建立中…' : '建立' }}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div
          v-if="loading"
          class="flex shrink-0 items-center justify-center py-16 text-muted-foreground"
        >
          <Loader2 class="size-8 animate-spin" aria-hidden="true" />
        </div>
        <p v-else-if="errorMessage" class="shrink-0 text-sm text-destructive">{{ errorMessage }}</p>
        <template v-else-if="tree">
          <div
            class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-muted/30 md:flex-row md:items-stretch"
          >
            <div class="flex min-h-0 min-w-0 flex-1 flex-col">
              <OrgNetworkDiagram
                ref="orgNetworkRef"
                embedded
                :departments="tree.departments"
                :tenant-label="tenantDisplayName"
                :member-count="tree.memberCount"
                :department-count="tree.departmentCount"
                :show-dept-members="showOrgNetworkMembers"
              />
            </div>
            <aside
              v-if="deptDetailSheetOpen && selectedDeptDetail"
              class="flex max-h-[min(45vh,320px)] w-full shrink-0 flex-col overflow-y-auto overscroll-contain border-t border-border bg-background md:max-h-none md:w-[17.5rem] md:border-t-0 md:border-l"
            >
              <OrgDeptDetailPanel
                class="min-h-0 flex-1 md:h-full"
                :department="selectedDeptDetail"
                :parent-name="detailParentName"
                compact
                show-close
                @close="onDeptDetailSheetOpenChange(false)"
              />
            </aside>
          </div>
        </template>
      </TabsContent>
    </Tabs>

    <Dialog v-model:open="editDialogOpen" @update:open="onEditDialogOpenChange">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>編輯部門</DialogTitle>
          <DialogDescription
            >變更名稱、上層部門或狀態。不可將上層設為自己或子部門。</DialogDescription
          >
        </DialogHeader>
        <div class="grid gap-4 py-2">
          <div class="grid gap-2">
            <Label for="org-dept-edit-name">名稱</Label>
            <Input id="org-dept-edit-name" v-model="editFormName" placeholder="例如：工程部" />
          </div>
          <div class="grid gap-2">
            <Label>上層部門</Label>
            <Select v-model="editFormParentId">
              <SelectTrigger>
                <SelectValue placeholder="選擇上層" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in editParentOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label>狀態</Label>
            <Select v-model="editFormStatus">
              <SelectTrigger>
                <SelectValue placeholder="狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">啟用</SelectItem>
                <SelectItem value="archived">已封存</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p v-if="editFormError" class="text-sm text-destructive">{{ editFormError }}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" @click="editDialogOpen = false">取消</Button>
          <Button type="button" :disabled="editSubmitting" @click="submitEditDept">
            {{ editSubmitting ? '儲存中…' : '儲存' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog :open="!!deleteTarget" @update:open="onDeleteDialogOpenChange">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>刪除部門？</AlertDialogTitle>
          <AlertDialogDescription class="space-y-2">
            <span v-if="deleteTarget">
              即將刪除「{{ deleteTarget.name }}」。需無子部門且無進行中之組織指派才可刪除。
            </span>
            <span v-if="deleteErrorMessage" class="block text-destructive">
              {{ deleteErrorMessage }}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleteSubmitting">取消</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            :disabled="deleteSubmitting"
            @click="confirmDeleteDept"
          >
            {{ deleteSubmitting ? '刪除中…' : '刪除' }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
