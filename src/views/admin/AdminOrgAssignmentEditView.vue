<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import {
  adminGetOrgAssignment,
  adminListOrgDepartments,
  adminListOrgPositions,
  adminUpdateOrgAssignment,
  adminRemoveOrgAssignment,
  type OrgDepartmentDto,
  type OrgMemberRow,
  type OrgPositionDto,
} from '@/api/organization'
import { ROUTE_PATH } from '@/constants'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
import { Loader2, ArrowLeft, Pencil, Trash2 } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const adminStore = useAdminStore()

const assignmentId = computed(() => route.params.assignmentId as string)

const tenantIdQuery = computed(() => {
  if (authStore.isPlatformAdmin) return adminStore.selectedTenantId ?? undefined
  return authStore.user?.tenantId ?? undefined
})

const platformNeedsTenant = computed(
  () => authStore.isPlatformAdmin && !adminStore.selectedTenantId
)

const loading = ref(true)
const loadError = ref('')
const assignment = ref<OrgMemberRow | null>(null)

const departments = ref<OrgDepartmentDto[]>([])
const positions = ref<OrgPositionDto[]>([])
const departmentId = ref('')
const positionId = ref('')
const isPrimary = ref(false)
const isManager = ref(false)

const editDialogOpen = ref(false)
const submitError = ref('')
const submitting = ref(false)
const removeOpen = ref(false)
const removeSubmitting = ref(false)
const removeError = ref('')
/** 避免初次載入或還原表單時 departmentId watch 干擾 */
const syncingDept = ref(false)

const activeDepartments = computed(() => departments.value.filter((d) => d.status === 'active'))

const positionsGrouped = computed(() => {
  const dept = departmentId.value
  if (!dept) return { deptOnly: [] as OrgPositionDto[], shared: [] as OrgPositionDto[] }
  return {
    deptOnly: positions.value.filter((p) => p.departmentId === dept),
    shared: positions.value.filter((p) => p.departmentId == null),
  }
})

const hasAnyPositions = computed(
  () => positionsGrouped.value.deptOnly.length + positionsGrouped.value.shared.length > 0
)

const backToOrgPeople = computed(() => ({
  path: ROUTE_PATH.ADMIN_ORG,
  query: { tab: 'people' },
}))

const assignmentDetailGrid = computed(() => {
  const a = assignment.value
  if (!a) return [] as { label: string; value: string }[]
  return [
    {
      label: '部門路徑',
      value: a.departmentPath?.trim() ? a.departmentPath : '—',
    },
    {
      label: '職位',
      value: a.positionName?.trim() ? a.positionName : '—',
    },
    { label: '職等', value: `Lv.${a.level}` },
    { label: '核准上限', value: approvalLabel(a.approvalLimit) },
    {
      label: '帳號狀態',
      value: a.userStatus === 'suspended' ? '停用' : '啟用',
    },
    { label: '主要職位', value: a.isPrimary ? '是' : '否' },
    { label: '部門主管', value: a.isManager ? '是' : '否' },
  ]
})

async function loadPositionsForDept(deptId: string) {
  const tid = tenantIdQuery.value
  if (!tid || !deptId) {
    positions.value = []
    return
  }
  positions.value = await adminListOrgPositions(tid, deptId)
}

async function restoreFormFromAssignment() {
  const a = assignment.value
  if (!a) return
  syncingDept.value = true
  isPrimary.value = a.isPrimary
  isManager.value = a.isManager
  departmentId.value = a.departmentId
  await loadPositionsForDept(a.departmentId)
  positionId.value = positions.value.some((p) => p.id === a.positionId) ? a.positionId : ''
  syncingDept.value = false
}

async function bootstrap() {
  loadError.value = ''
  assignment.value = null
  if (platformNeedsTenant.value) {
    loading.value = false
    loadError.value = '請先在頂欄選擇要管理的租戶。'
    return
  }
  const tid = tenantIdQuery.value
  const aid = assignmentId.value
  if (!tid || !aid) {
    loading.value = false
    loadError.value = '無法載入：缺少租戶或指派編號。'
    return
  }
  loading.value = true
  syncingDept.value = true
  try {
    const [row, depts] = await Promise.all([
      adminGetOrgAssignment(aid, tid),
      adminListOrgDepartments(tid),
    ])
    assignment.value = row
    departments.value = depts
    await restoreFormFromAssignment()
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    loadError.value = ax.response?.data?.error?.message ?? '無法載入此指派'
    assignment.value = null
  } finally {
    syncingDept.value = false
    loading.value = false
  }
}

watch(departmentId, (dept, prev) => {
  if (syncingDept.value) return
  if (dept === prev) return
  const prevPos = positionId.value
  positionId.value = ''
  if (dept) {
    void loadPositionsForDept(dept).then(() => {
      if (prevPos && positions.value.some((p) => p.id === prevPos)) {
        positionId.value = prevPos
      }
    })
  } else {
    positions.value = []
  }
})

watch(
  () => [tenantIdQuery.value, assignmentId.value] as const,
  () => void bootstrap(),
  { immediate: true }
)

async function openEdit() {
  const a = assignment.value
  if (!a) return
  submitError.value = ''
  await restoreFormFromAssignment()
  editDialogOpen.value = true
}

function onEditDialogOpen(v: boolean) {
  editDialogOpen.value = v
  if (!v) {
    submitError.value = ''
    void restoreFormFromAssignment()
  }
}

async function submit() {
  submitError.value = ''
  const tid = tenantIdQuery.value
  const aid = assignmentId.value
  if (!tid || !aid || !assignment.value) return
  if (!departmentId.value) {
    submitError.value = '請選擇部門'
    return
  }
  if (!positionId.value) {
    submitError.value = '請選擇職位'
    return
  }
  submitting.value = true
  try {
    await adminUpdateOrgAssignment(
      aid,
      {
        departmentId: departmentId.value,
        positionId: positionId.value,
        isPrimary: isPrimary.value,
        isManager: isManager.value,
      },
      tid
    )
    editDialogOpen.value = false
    submitError.value = ''
    await bootstrap()
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    submitError.value = ax.response?.data?.error?.message ?? '儲存失敗'
  } finally {
    submitting.value = false
  }
}

async function confirmRemove() {
  removeError.value = ''
  const tid = tenantIdQuery.value
  const aid = assignmentId.value
  if (!tid || !aid) return
  removeSubmitting.value = true
  try {
    await adminRemoveOrgAssignment(aid, tid)
    removeOpen.value = false
    await router.push(backToOrgPeople.value)
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    removeError.value = ax.response?.data?.error?.message ?? '刪除失敗'
  } finally {
    removeSubmitting.value = false
  }
}

function approvalLabel(limit: string | null) {
  if (limit === null) return '無上限'
  return limit
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <Button variant="outline" type="button" class="gap-2" as-child>
        <RouterLink :to="backToOrgPeople">
          <ArrowLeft class="size-4" aria-hidden="true" />
          返回組織管理（成員）
        </RouterLink>
      </Button>
    </div>

    <div
      v-if="platformNeedsTenant"
      class="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground"
    >
      請先在頂欄選擇要管理的租戶。
    </div>

    <div
      v-else-if="loading"
      class="flex flex-col items-center justify-center py-16 text-muted-foreground"
    >
      <Loader2 class="size-8 animate-spin" aria-hidden="true" />
      <p class="mt-2 text-sm">載入中…</p>
    </div>

    <div
      v-else-if="loadError || !assignment"
      class="rounded-lg border border-border bg-card p-8 text-center"
    >
      <p class="text-sm text-destructive">{{ loadError || '無法顯示此指派' }}</p>
      <Button variant="outline" type="button" class="mt-4 gap-2" as-child>
        <RouterLink :to="backToOrgPeople">
          <ArrowLeft class="size-4" aria-hidden="true" />
          返回組織管理（成員）
        </RouterLink>
      </Button>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold text-foreground">組織指派詳情</h1>
        <div class="flex flex-wrap items-center gap-2">
          <Button variant="outline" type="button" class="gap-2" @click="openEdit">
            <Pencil class="size-4" aria-hidden="true" />
            編輯
          </Button>
          <Button
            variant="outline"
            type="button"
            class="gap-2 text-destructive hover:text-destructive"
            @click="removeOpen = true"
          >
            <Trash2 class="size-4" aria-hidden="true" />
            刪除
          </Button>
        </div>
      </div>

      <div class="rounded-lg border border-border bg-card p-6 space-y-6">
        <div>
          <h2 class="text-sm font-medium text-muted-foreground">成員</h2>
          <p class="mt-2 text-sm font-medium text-foreground">
            {{ assignment.name?.trim() || '—' }}
          </p>
          <p v-if="assignment.email?.trim()" class="mt-1 text-sm text-muted-foreground">
            {{ assignment.email }}
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="row in assignmentDetailGrid" :key="row.label" class="min-w-0">
            <h3 class="text-xs font-medium text-muted-foreground">{{ row.label }}</h3>
            <p class="mt-1 text-sm text-foreground break-words">{{ row.value }}</p>
          </div>
        </div>

        <p class="text-xs text-muted-foreground">
          帳號、系統角色與權限範本請至
          <RouterLink
            :to="ROUTE_PATH.ADMIN_MEMBERS"
            class="text-primary underline-offset-4 hover:underline"
          >
            租戶成員
          </RouterLink>
          管理。
        </p>
      </div>
    </template>

    <Dialog :open="editDialogOpen" @update:open="onEditDialogOpen">
      <DialogContent class="max-h-[min(90vh,36rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>編輯組織指派</DialogTitle>
          <DialogDescription>
            調整部門、職位與主要／主管註記。儲存後若變更職位，職等與核准上限將依新職位更新。
          </DialogDescription>
        </DialogHeader>

        <div class="grid gap-4 py-2">
          <div class="grid gap-2">
            <Label for="org-edit-dept" class="text-foreground">部門</Label>
            <Select v-model="departmentId" :disabled="activeDepartments.length === 0">
              <SelectTrigger id="org-edit-dept" class="bg-background">
                <SelectValue placeholder="選擇部門" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="d in activeDepartments" :key="d.id" :value="d.id">
                  {{ d.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="grid gap-2">
            <Label for="org-edit-pos" class="text-foreground">職位</Label>
            <Select v-model="positionId" :disabled="!departmentId || !hasAnyPositions">
              <SelectTrigger id="org-edit-pos" class="bg-background">
                <SelectValue placeholder="請先選部門" />
              </SelectTrigger>
              <SelectContent>
                <template v-if="positionsGrouped.deptOnly.length">
                  <SelectGroup>
                    <SelectLabel>此部門專用</SelectLabel>
                    <SelectItem v-for="p in positionsGrouped.deptOnly" :key="p.id" :value="p.id">
                      {{ p.name }}
                    </SelectItem>
                  </SelectGroup>
                </template>
                <SelectSeparator
                  v-if="positionsGrouped.deptOnly.length && positionsGrouped.shared.length"
                />
                <template v-if="positionsGrouped.shared.length">
                  <SelectGroup>
                    <SelectLabel>全公司共用</SelectLabel>
                    <SelectItem v-for="p in positionsGrouped.shared" :key="p.id" :value="p.id">
                      {{ p.name }}
                    </SelectItem>
                  </SelectGroup>
                </template>
              </SelectContent>
            </Select>
            <p v-if="departmentId && !hasAnyPositions" class="text-xs text-muted-foreground">
              此部門尚無適用之職位（含共用），請至「職位管理」新增。
            </p>
          </div>

          <div class="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3">
            <div class="flex items-start gap-2">
              <Checkbox
                id="org-edit-primary"
                :checked="isPrimary"
                @update:checked="(v) => (isPrimary = v === true)"
              />
              <div class="grid gap-0.5">
                <Label for="org-edit-primary" class="cursor-pointer font-normal text-foreground">
                  設為主要職位
                </Label>
                <p class="text-xs text-muted-foreground">
                  勾選後會取消該成員其他進行中指派的主要標記。
                </p>
              </div>
            </div>
            <div class="flex items-start gap-2">
              <Checkbox
                id="org-edit-manager"
                :checked="isManager"
                @update:checked="(v) => (isManager = v === true)"
              />
              <div class="grid gap-0.5">
                <Label for="org-edit-manager" class="cursor-pointer font-normal text-foreground">
                  部門主管
                </Label>
                <p class="text-xs text-muted-foreground">每個部門同時僅能有一位進行中的主管。</p>
              </div>
            </div>
          </div>

          <p v-if="submitError" class="text-sm text-destructive">{{ submitError }}</p>
        </div>

        <DialogFooter class="gap-2 sm:gap-0">
          <Button type="button" variant="outline" @click="onEditDialogOpen(false)"> 取消 </Button>
          <Button type="button" :disabled="submitting" @click="submit">
            <Loader2 v-if="submitting" class="mr-2 size-4 animate-spin" aria-hidden="true" />
            {{ submitting ? '儲存中…' : '儲存' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog :open="removeOpen" @update:open="(v) => (removeOpen = v)">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>刪除此組織指派？</AlertDialogTitle>
          <AlertDialogDescription class="space-y-2">
            <span>將結束此筆進行中的部門／職位指派，成員可再透過「新增組織指派」重新加入。</span>
            <span v-if="removeError" class="block text-destructive">{{ removeError }}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="removeSubmitting">取消</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            :disabled="removeSubmitting"
            @click="confirmRemove"
          >
            {{ removeSubmitting ? '處理中…' : '確認刪除' }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
