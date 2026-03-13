<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Loader2, Megaphone, Plus, Pencil, Trash2 } from 'lucide-vue-next'
import {
  fetchPlatformAnnouncements,
  createPlatformAnnouncement,
  updatePlatformAnnouncement,
  deletePlatformAnnouncement,
  fetchTenants,
  type PlatformAnnouncementItem,
  type TenantItem,
} from '@/api/platform'

const list = ref<PlatformAnnouncementItem[]>([])
const meta = ref<{ page: number; limit: number; total: number } | null>(null)
const loading = ref(true)
const tenants = ref<TenantItem[]>([])
const dialogOpen = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingId = ref<string | null>(null)
const form = ref({ title: '', body: '', publishedAt: '', expiresAt: '', targetAll: true, targetTenantIds: [] as string[] })
const submitting = ref(false)
const errorMessage = ref('')

async function load() {
  loading.value = true
  try {
    const res = await fetchPlatformAnnouncements({ page: 1, limit: 100 })
    list.value = res.list
    meta.value = res.meta ?? null
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

async function loadTenants() {
  try {
    const { list: items } = await fetchTenants({ limit: 200 })
    tenants.value = items ?? []
  } catch {
    tenants.value = []
  }
}

function openCreate() {
  dialogMode.value = 'create'
  editingId.value = null
  form.value = { title: '', body: '', publishedAt: '', expiresAt: '', targetAll: true, targetTenantIds: [] }
  errorMessage.value = ''
  dialogOpen.value = true
}

function openEdit(row: PlatformAnnouncementItem) {
  dialogMode.value = 'edit'
  editingId.value = row.id
  const ids = row.targetTenantIds as string[] | null
  form.value = {
    title: row.title,
    body: row.body,
    publishedAt: row.publishedAt ? row.publishedAt.slice(0, 19) : '',
    expiresAt: row.expiresAt ? row.expiresAt.slice(0, 19) : '',
    targetAll: !ids || ids.length === 0,
    targetTenantIds: ids ?? [],
  }
  errorMessage.value = ''
  dialogOpen.value = true
}

async function submit() {
  if (!form.value.title.trim()) {
    errorMessage.value = '請填寫標題'
    return
  }
  submitting.value = true
  errorMessage.value = ''
  try {
    const payload = {
      title: form.value.title.trim(),
      body: form.value.body,
      publishedAt: form.value.publishedAt ? new Date(form.value.publishedAt).toISOString() : null,
      expiresAt: form.value.expiresAt ? new Date(form.value.expiresAt).toISOString() : null,
      targetTenantIds: form.value.targetAll ? null : form.value.targetTenantIds,
    }
    if (dialogMode.value === 'create') {
      await createPlatformAnnouncement(payload)
    } else if (editingId.value) {
      await updatePlatformAnnouncement(editingId.value, payload)
    }
    dialogOpen.value = false
    await load()
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : '操作失敗'
    errorMessage.value = msg
  } finally {
    submitting.value = false
  }
}

async function remove(row: PlatformAnnouncementItem) {
  if (!confirm(`確定要刪除公告「${row.title}」？`)) return
  try {
    await deletePlatformAnnouncement(row.id)
    await load()
  } catch {
    // ignore
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })
}

function targetLabel(row: PlatformAnnouncementItem) {
  const ids = row.targetTenantIds as string[] | null
  if (!ids || ids.length === 0) return '全平台'
  return `指定 ${ids.length} 個租戶`
}

onMounted(() => {
  load()
  loadTenants()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">平台公告</h1>
      <p class="text-sm text-muted-foreground">
        發佈維護通知或政策變更，可選擇全平台或指定租戶。
      </p>
    </div>

    <Card class="border-border bg-card">
      <CardContent class="p-4">
        <div class="mb-4 flex justify-end">
          <Button size="sm" @click="openCreate">
            <Plus class="mr-2 size-4" />
            新增公告
          </Button>
        </div>
        <div v-if="loading" class="flex items-center justify-center py-16">
          <Loader2 class="size-8 animate-spin text-muted-foreground" />
        </div>
        <template v-else>
          <div v-if="!list.length" class="py-16 text-center text-sm text-muted-foreground">
            <Megaphone class="mx-auto mb-2 size-10 opacity-50" />
            <p>尚無公告，點擊「新增公告」建立。</p>
          </div>
          <div v-else class="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow class="border-border hover:bg-transparent">
                  <TableHead class="text-muted-foreground">標題</TableHead>
                  <TableHead class="text-muted-foreground">對象</TableHead>
                  <TableHead class="text-muted-foreground">發佈時間</TableHead>
                  <TableHead class="text-muted-foreground">下架時間</TableHead>
                  <TableHead class="w-[100px] text-muted-foreground">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in list" :key="row.id" class="border-border">
                  <TableCell class="font-medium text-foreground">{{ row.title }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ targetLabel(row) }}</TableCell>
                  <TableCell class="tabular-nums text-muted-foreground">{{ formatDate(row.publishedAt) }}</TableCell>
                  <TableCell class="tabular-nums text-muted-foreground">{{ formatDate(row.expiresAt) }}</TableCell>
                  <TableCell>
                    <div class="flex gap-2">
                      <Button variant="ghost" size="icon" class="size-8" @click="openEdit(row)">
                        <Pencil class="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" class="size-8 text-destructive" @click="remove(row)">
                        <Trash2 class="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </template>
      </CardContent>
    </Card>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ dialogMode === 'create' ? '新增公告' : '編輯公告' }}</DialogTitle>
          <DialogDescription>填寫標題與內容，可設定發佈／下架時間與對象。</DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <label for="title" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">標題</label>
            <Input id="title" v-model="form.title" placeholder="公告標題" class="bg-background" />
          </div>
          <div class="grid gap-2">
            <label for="body" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">內容</label>
            <textarea
              id="body"
              v-model="form.body"
              rows="4"
              class="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="公告內容"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="grid gap-2">
              <label class="text-sm font-medium leading-none">發佈時間（選填）</label>
              <Input v-model="form.publishedAt" type="datetime-local" class="bg-background" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium leading-none">下架時間（選填）</label>
              <Input v-model="form.expiresAt" type="datetime-local" class="bg-background" />
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <Switch id="targetAll" v-model:checked="form.targetAll" />
            <label for="targetAll" class="text-sm font-medium leading-none">全平台顯示（關閉則可選指定租戶）</label>
          </div>
          <div v-if="!form.targetAll" class="grid gap-2">
            <label class="text-sm font-medium leading-none">指定租戶</label>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="t in tenants"
                :key="t.id"
                class="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
              >
                <input
                  v-model="form.targetTenantIds"
                  type="checkbox"
                  :value="t.id"
                  class="rounded border-input"
                />
                {{ t.name }}
              </label>
            </div>
          </div>
          <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="dialogOpen = false">取消</Button>
          <Button :disabled="submitting" @click="submit">
            <Loader2 v-if="submitting" class="mr-2 size-4 animate-spin" />
            {{ dialogMode === 'create' ? '建立' : '儲存' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
