<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { apiClient } from '@/api/client'
import { API_PATH } from '@/constants'
import type { AdminUserItem, ApiResponse } from '@/types'
import {
  adminListOrgDepartments,
  adminListOrgPositions,
  adminCreateOrgAssignment,
  type OrgDepartmentDto,
  type OrgPositionDto,
} from '@/api/organization'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  /** 平台後台需已選租戶；租戶管理員由後端帶入 tenant */
  tenantId: string | undefined
  /**
   * 自租戶成員列開啟時帶入，略過成員選擇。
   * 自組織管理開啟時傳 null 以顯示搜尋選人。
   */
  fixedUser: { id: string; name: string | null; email: string; memberType?: string } | null
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  created: []
}>()

const loadError = ref('')
const submitError = ref('')
const loadingMeta = ref(false)
const submitting = ref(false)

const departments = ref<OrgDepartmentDto[]>([])
const positions = ref<OrgPositionDto[]>([])
const tenantUsers = ref<AdminUserItem[]>([])

const selectedUserId = ref('')
const departmentId = ref('')
const positionId = ref('')
const isPrimary = ref(true)
const isManager = ref(false)

const canUseOrg = computed(() => !!props.tenantId)

const activeDepartments = computed(() =>
  departments.value.filter((d) => d.status === 'active')
)

/** 後端 list 含此部門專用 + 全租戶共用；下拉分兩段顯示 */
const positionsGrouped = computed(() => {
  const dept = departmentId.value
  if (!dept) return { deptOnly: [] as OrgPositionDto[], shared: [] as OrgPositionDto[] }
  return {
    deptOnly: positions.value.filter((p) => p.departmentId === dept),
    shared: positions.value.filter((p) => p.departmentId == null),
  }
})

const hasAnyPositions = computed(
  () =>
    positionsGrouped.value.deptOnly.length + positionsGrouped.value.shared.length > 0
)

const selectedUserLabel = computed(() => {
  const u = tenantUsers.value.find((x) => x.id === selectedUserId.value)
  if (!u) return ''
  const n = u.name?.trim()
  return n ? `${n}（${u.email}）` : u.email
})

const fixedUserLabel = computed(() => {
  const f = props.fixedUser
  if (!f) return ''
  const n = f.name?.trim()
  return n ? `${n}（${f.email}）` : f.email
})

async function fetchAllTenantUsers(tid: string): Promise<AdminUserItem[]> {
  const out: AdminUserItem[] = []
  let page = 1
  const limit = 100
  while (true) {
    const { data } = await apiClient.get<
      ApiResponse<AdminUserItem[]> & { meta: { page: number; limit: number; total: number } }
    >(API_PATH.ADMIN_USERS, { params: { tenantId: tid, page, limit, memberType: 'internal' } })
    const batch = data.data ?? []
    out.push(...batch)
    const total = data.meta?.total ?? out.length
    if (out.length >= total || batch.length < limit) break
    page += 1
  }
  return out.filter((u) => (u.status ?? 'active') !== 'suspended')
}

async function loadDepartments() {
  if (!props.tenantId) {
    departments.value = []
    return
  }
  departments.value = await adminListOrgDepartments(props.tenantId)
}

async function loadPositionsForDept(deptId: string) {
  if (!props.tenantId || !deptId) {
    positions.value = []
    return
  }
  positions.value = await adminListOrgPositions(props.tenantId, deptId)
}

async function loadUsers() {
  if (!props.tenantId || props.fixedUser) {
    tenantUsers.value = []
    return
  }
  tenantUsers.value = await fetchAllTenantUsers(props.tenantId)
}

function resetForm() {
  loadError.value = ''
  submitError.value = ''
  selectedUserId.value = ''
  departmentId.value = ''
  positionId.value = ''
  isPrimary.value = true
  isManager.value = false
  positions.value = []
  if (props.fixedUser) {
    selectedUserId.value = props.fixedUser.id
  }
}

async function bootstrap() {
  resetForm()
  if (!canUseOrg.value) {
    loadError.value = '請先選擇租戶後再進行組織指派。'
    return
  }
  if (props.fixedUser?.memberType === 'external') {
    loadError.value =
      '外部成員（組織外協力）不適用組織架構指派，僅內部成員可加入部門與職位。'
    return
  }
  loadingMeta.value = true
  loadError.value = ''
  try {
    await loadDepartments()
    await loadUsers()
    if (activeDepartments.value.length === 0) {
      loadError.value = '尚無可用部門，請先於「組織圖」建立部門。'
    }
  } catch {
    loadError.value = '無法載入部門或成員列表'
    departments.value = []
    tenantUsers.value = []
  } finally {
    loadingMeta.value = false
  }
}

watch(open, (v) => {
  if (v) void bootstrap()
})

watch(departmentId, (dept) => {
  positionId.value = ''
  if (dept) void loadPositionsForDept(dept)
  else positions.value = []
})

watch(
  () => props.fixedUser,
  (f) => {
    if (f) selectedUserId.value = f.id
  },
  { immediate: true }
)

async function submit() {
  submitError.value = ''
  if (!props.tenantId) return
  if (!selectedUserId.value) {
    submitError.value = '請選擇成員'
    return
  }
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
    await adminCreateOrgAssignment(
      {
        userId: selectedUserId.value,
        departmentId: departmentId.value,
        positionId: positionId.value,
        isPrimary: isPrimary.value,
        isManager: isManager.value,
      },
      props.tenantId
    )
    open.value = false
    emit('created')
  } catch (err: unknown) {
    const res =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        : null
    submitError.value = res?.message ?? '建立指派失敗'
  } finally {
    submitting.value = false
  }
}

function pickUser(id: string) {
  selectedUserId.value = id
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>新增組織指派</DialogTitle>
        <DialogDescription>
          僅限<strong class="font-medium text-foreground">內部成員</strong>（組織內）；外部成員為組織外協力，不列入組織圖與此處指派。每個部門僅能有一位進行中的「主管」；每位成員僅能有一筆「主要」進行中指派。
        </DialogDescription>
      </DialogHeader>

      <div v-if="loadError" class="text-sm text-destructive">{{ loadError }}</div>
      <div v-else-if="loadingMeta" class="flex items-center gap-2 py-6 text-muted-foreground">
        <Loader2 class="size-6 animate-spin" aria-hidden="true" />
        載入中…
      </div>
      <div v-else class="grid max-h-[min(70vh,520px)] gap-4 overflow-y-auto py-1">
        <div v-if="fixedUser" class="grid gap-1.5">
          <Label class="text-foreground">成員</Label>
          <p class="text-sm text-foreground">{{ fixedUserLabel }}</p>
        </div>
        <div v-else class="grid gap-2">
          <Label for="org-assign-user-cmd" class="text-foreground">成員</Label>
          <Command class="rounded-md border border-border bg-background">
            <CommandInput id="org-assign-user-cmd" placeholder="搜尋姓名或 Email…" />
            <CommandList class="max-h-40">
              <CommandEmpty>找不到成員</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  v-for="u in tenantUsers"
                  :key="u.id"
                  :value="`${u.email} ${u.name ?? ''} ${u.id}`"
                  @select="() => pickUser(u.id)"
                >
                  <span
                    class="truncate"
                    :class="selectedUserId === u.id ? 'font-medium text-foreground' : ''"
                  >
                    {{ u.name?.trim() || '—' }}
                    <span class="block text-xs text-muted-foreground">{{ u.email }}</span>
                  </span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
          <p v-if="selectedUserId" class="text-xs text-muted-foreground">已選：{{ selectedUserLabel }}</p>
          <p v-else class="text-xs text-muted-foreground">請從上方清單點選一位成員。</p>
        </div>

        <div class="grid gap-2">
          <Label for="org-assign-dept" class="text-foreground">部門</Label>
          <Select v-model="departmentId" :disabled="!canUseOrg || activeDepartments.length === 0">
            <SelectTrigger id="org-assign-dept" class="bg-background">
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
          <Label for="org-assign-pos" class="text-foreground">職位</Label>
          <Select v-model="positionId" :disabled="!departmentId || !hasAnyPositions">
            <SelectTrigger id="org-assign-pos" class="bg-background">
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
            此部門尚無適用之職位（含共用），請至「職位管理」新增共用職位或此部門專用職位。
          </p>
        </div>

        <div class="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3">
          <div class="flex items-start gap-2">
            <Checkbox
              id="org-assign-primary"
              :checked="isPrimary"
              @update:checked="(v) => (isPrimary = v === true)"
            />
            <div class="grid gap-0.5">
              <Label for="org-assign-primary" class="cursor-pointer font-normal text-foreground">
                設為主要職位
              </Label>
              <p class="text-xs text-muted-foreground">
                勾選後會取消該成員其他進行中指派的主要標記。
              </p>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <Checkbox
              id="org-assign-manager"
              :checked="isManager"
              @update:checked="(v) => (isManager = v === true)"
            />
            <div class="grid gap-0.5">
              <Label for="org-assign-manager" class="cursor-pointer font-normal text-foreground">
                部門主管
              </Label>
              <p class="text-xs text-muted-foreground">每個部門同時僅能有一位進行中的主管。</p>
            </div>
          </div>
        </div>

        <p v-if="submitError" class="text-sm text-destructive">{{ submitError }}</p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" :disabled="submitting" @click="open = false">
          取消
        </Button>
        <Button type="button" :disabled="submitting || loadingMeta || !!loadError" @click="submit">
          <Loader2 v-if="submitting" class="mr-2 size-4 animate-spin" />
          {{ submitting ? '建立中…' : '確認指派' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
