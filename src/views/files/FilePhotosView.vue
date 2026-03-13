<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  ImageIcon,
  LayoutGrid,
  Clock,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
  Upload,
  Loader2,
  Plus,
  Trash2,
  Star,
  Circle,
  CheckCircle2,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { listProjectFiles, deleteFile } from '@/api/files'
import type { AttachmentItem } from '@/api/files'
import {
  listProjectAlbums,
  createAlbum,
  deleteAlbum,
  listAlbumPhotos,
  addPhotoToAlbum,
  type AlbumItem,
  type AlbumPhotoItem,
} from '@/api/albums'
import {
  listProjectPhotoFavorites,
  addPhotoFavorite,
  removePhotoFavorite,
} from '@/api/photo-favorites'
import { useUploadQueue } from '@/composables/useUploadQueue'
import { useAuthImageUrl } from '@/composables/useAuthImageUrl'
import PhotoThumbnail from '@/components/files/PhotoThumbnail.vue'

const PHOTO_CATEGORY = 'photo'

const route = useRoute()
const projectId = computed(() => (route.params.projectId as string) ?? '')
const { enqueueAndUpload } = useUploadQueue()

// Left sidebar
const sidebarCollapsed = ref(false)
const activeView = ref<'favorites' | 'library' | 'recent' | string>('library') // 'favorites' | 'library' | 'recent' | albumId

// 圖面區分頁：年 / 月 / 全部
const photoTab = ref<'year' | 'month' | 'all'>('all')

// Data
const albums = ref<AlbumItem[]>([])
const libraryPhotos = ref<AttachmentItem[]>([])
const albumPhotos = ref<AlbumPhotoItem[]>([])
const loadingAlbums = ref(false)
const loadingPhotos = ref(false)
const uploadInProgress = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Create album dialog
const createAlbumOpen = ref(false)
const newAlbumName = ref('')
const createAlbumLoading = ref(false)
const createAlbumError = ref('')

// Lightbox
const lightboxOpen = ref(false)
const lightboxPhotoId = ref<string | undefined>(undefined)
const { objectUrl: lightboxUrl, loading: lightboxLoading } = useAuthImageUrl(lightboxPhotoId)

// Delete album dialog
const deleteAlbumTarget = ref<AlbumItem | null>(null)
const deleteAlbumOpen = ref(false)
const deleteAlbumLoading = ref(false)

// Add to album (from library) dialog
const addToAlbumOpen = ref(false)
const addToAlbumSelectedIds = ref<Set<string>>(new Set())
const addToAlbumLoading = ref(false)
const addToAlbumFetching = ref(false)
const addToAlbumError = ref('')

// Delete photo
const deletePhotoTarget = ref<PhotoGridItem | null>(null)
const deletePhotoOpen = ref(false)
const deletePhotoLoading = ref(false)

// 我的最愛（個人，他人不可見）
const favoriteIds = ref<Set<string>>(new Set())
const favoritePhotos = ref<AttachmentItem[]>([])
const favoritesLoading = ref(false)
const favoriteTogglingId = ref<string | null>(null)

// 多選模式：由「選取」按鈕進入，用勾選圈選取；選取模式下停用刪除／我的最愛
const selectionMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const lastClickedId = ref<string | null>(null)

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) clearSelection()
}

const isLibrary = computed(() => activeView.value === 'library' || activeView.value === 'recent')
const currentPhotos = computed(() => {
  if (activeView.value === 'favorites') return favoritePhotos.value
  if (isLibrary.value) return libraryPhotos.value
  return albumPhotos.value
})

const currentTitle = computed(() => {
  if (activeView.value === 'favorites') return '我的最愛'
  if (activeView.value === 'library') return '圖庫'
  if (activeView.value === 'recent') return '最近儲存'
  const album = albums.value.find((a) => a.id === activeView.value)
  return album?.name ?? '相簿'
})

function isFavorite(id: string) {
  return favoriteIds.value.has(id)
}

interface PhotoGridItem {
  id: string
  createdAt: string
  mimeType?: string
}

const photoGridItems = computed(() => {
  const list = currentPhotos.value
  if (!list.length) return []
  return list.filter((item: { mimeType?: string }) =>
    (item.mimeType ?? '').startsWith('image/')
  ) as PhotoGridItem[]
})

/** 每個年／月顯示的精選張數（該年／該月的前幾張），點擊進入全部並開 lightbox */
const FEATURED_PER_GROUP = 6

/** 依年分組（年 tab） */
const photosGroupedByYear = computed(() => {
  const items = [...photoGridItems.value].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  if (!items.length) return []
  const yearMap = new Map<number, PhotoGridItem[]>()
  for (const item of items) {
    const y = new Date(item.createdAt).getFullYear()
    if (!yearMap.has(y)) yearMap.set(y, [])
    yearMap.get(y)!.push(item)
  }
  return Array.from(yearMap.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, items]) => ({ year, items }))
})

/** 依年+月分組（月 tab） */
const photosGroupedByYearMonth = computed(() => {
  const items = [...photoGridItems.value].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  if (!items.length) return []
  const map = new Map<string, PhotoGridItem[]>()
  for (const item of items) {
    const d = new Date(item.createdAt)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => {
      const [y, m] = key.split('-').map(Number)
      return { year: y, month: m, items }
    })
})

/** 依年 → 月 → 日分組，同一日內按時間新到舊 */
const photosGroupedByDate = computed(() => {
  const items = [...photoGridItems.value].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  if (!items.length) return []
  const yearMap = new Map<
    number,
    Map<number, Map<number, PhotoGridItem[]>>
  >()
  for (const item of items) {
    const d = new Date(item.createdAt)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const day = d.getDate()
    if (!yearMap.has(y)) yearMap.set(y, new Map())
    const monthMap = yearMap.get(y)!
    if (!monthMap.has(m)) monthMap.set(m, new Map())
    const dayMap = monthMap.get(m)!
    if (!dayMap.has(day)) dayMap.set(day, [])
    dayMap.get(day)!.push(item)
  }
  const result: { year: number; months: { month: number; days: { day: number; items: PhotoGridItem[] }[] }[] }[] = []
  const years = Array.from(yearMap.keys()).sort((a, b) => b - a)
  for (const year of years) {
    const monthMap = yearMap.get(year)!
    const months: { month: number; days: { day: number; items: PhotoGridItem[] }[] }[] = []
    const monthKeys = Array.from(monthMap.keys()).sort((a, b) => b - a)
    for (const month of monthKeys) {
      const dayMap = monthMap.get(month)!
      const days: { day: number; items: PhotoGridItem[] }[] = []
      const dayKeys = Array.from(dayMap.keys()).sort((a, b) => b - a)
      for (const day of dayKeys) {
        days.push({ day, items: dayMap.get(day)! })
      }
      months.push({ month, days })
    }
    result.push({ year, months })
  }
  return result
})

async function fetchAlbums() {
  if (!projectId.value) return
  loadingAlbums.value = true
  try {
    albums.value = await listProjectAlbums(projectId.value)
  } finally {
    loadingAlbums.value = false
  }
}

async function fetchLibraryPhotos(opts?: { silent?: boolean }) {
  if (!projectId.value) return
  if (!opts?.silent) loadingPhotos.value = true
  try {
    const { data } = await listProjectFiles({
      projectId: projectId.value,
      page: 1,
      limit: 200,
      category: PHOTO_CATEGORY,
    })
    libraryPhotos.value = data
  } finally {
    if (!opts?.silent) loadingPhotos.value = false
  }
}

async function fetchAlbumPhotos(albumId: string) {
  if (!projectId.value) return
  loadingPhotos.value = true
  try {
    albumPhotos.value = await listAlbumPhotos(projectId.value, albumId)
  } finally {
    loadingPhotos.value = false
  }
}

async function fetchFavorites() {
  if (!projectId.value) return
  favoritesLoading.value = true
  try {
    const list = await listProjectPhotoFavorites(projectId.value)
    favoritePhotos.value = list
    favoriteIds.value = new Set(list.map((p) => p.id))
  } finally {
    favoritesLoading.value = false
  }
}

function loadPhotos() {
  if (activeView.value === 'favorites') {
    loadingPhotos.value = true
    fetchFavorites().finally(() => { loadingPhotos.value = false })
  } else if (activeView.value === 'library' || activeView.value === 'recent') {
    fetchLibraryPhotos()
  } else if (activeView.value) {
    fetchAlbumPhotos(activeView.value)
  } else {
    albumPhotos.value = []
  }
}

async function toggleFavorite(item: PhotoGridItem) {
  if (!projectId.value || favoriteTogglingId.value) return
  const id = item.id
  favoriteTogglingId.value = id
  try {
    if (favoriteIds.value.has(id)) {
      await removePhotoFavorite(projectId.value, id)
      favoriteIds.value.delete(id)
      favoriteIds.value = new Set(favoriteIds.value)
      favoritePhotos.value = favoritePhotos.value.filter((p) => p.id !== id)
    } else {
      await addPhotoFavorite(projectId.value, id)
      favoriteIds.value.add(id)
      favoriteIds.value = new Set(favoriteIds.value)
      if (activeView.value === 'favorites') await fetchFavorites()
    }
  } finally {
    favoriteTogglingId.value = null
  }
}

watch(activeView, () => {
  selectionMode.value = false
  clearSelection()
  loadPhotos()
})
watch(projectId, (id) => {
  if (id) {
    fetchAlbums()
    loadPhotos()
    fetchFavorites() // 取得我的最愛 ID，供星號顯示
  }
})

onMounted(() => {
  if (projectId.value) {
    fetchAlbums()
    loadPhotos()
    fetchFavorites()
  }
})

function triggerUpload() {
  fileInputRef.value?.click()
}

async function onFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  if (!files.length || !projectId.value) return
  uploadInProgress.value = true
  try {
    await Promise.allSettled(
      files.map((file) =>
        enqueueAndUpload({
          file,
          projectId: projectId.value,
          category: PHOTO_CATEGORY,
          source: 'photos',
        })
      )
    )
    await fetchLibraryPhotos()
    if (activeView.value) await loadPhotos()
  } finally {
    uploadInProgress.value = false
  }
}

function openLightbox(id: string) {
  lightboxPhotoId.value = id
  lightboxOpen.value = true
}

function isSelected(id: string) {
  return selectedIds.value.has(id)
}

/** 選取模式：點擊即切換勾選。非選取模式：Shift／Command 多選，否則開 lightbox */
function handlePhotoClick(item: PhotoGridItem, e: MouseEvent) {
  const list = photoGridItems.value
  const idx = list.findIndex((p) => p.id === item.id)
  if (selectionMode.value) {
    const next = new Set(selectedIds.value)
    if (next.has(item.id)) next.delete(item.id)
    else next.add(item.id)
    selectedIds.value = next
    lastClickedId.value = item.id
    return
  }
  if (e.shiftKey) {
    const lastIdx = lastClickedId.value != null
      ? list.findIndex((p) => p.id === lastClickedId.value)
      : -1
    const from = lastIdx >= 0 ? Math.min(lastIdx, idx) : idx
    const to = lastIdx >= 0 ? Math.max(lastIdx, idx) : idx
    const next = new Set(selectedIds.value)
    for (let i = from; i <= to; i++) next.add(list[i].id)
    selectedIds.value = next
    lastClickedId.value = item.id
    return
  }
  if (e.metaKey || e.ctrlKey) {
    const next = new Set(selectedIds.value)
    if (next.has(item.id)) next.delete(item.id)
    else next.add(item.id)
    selectedIds.value = next
    lastClickedId.value = item.id
    return
  }
  selectedIds.value = new Set()
  lastClickedId.value = item.id
  // 僅在「全部」tab 或非圖庫檢視（相簿／我的最愛等）時才開啟 lightbox；年／月 tab 點擊精選不開 modal
  const inYearOrMonthTab = activeView.value === 'library' && (photoTab.value === 'year' || photoTab.value === 'month')
  if (!inYearOrMonthTab) {
    goToAllAndOpenLightbox(item.id)
  }
}

function clearSelection() {
  selectedIds.value = new Set()
  lastClickedId.value = null
}

/** 切到全部 tab 並開啟 lightbox（僅在允許開 modal 的檢視時由 handlePhotoClick 呼叫） */
function goToAllAndOpenLightbox(id: string) {
  photoTab.value = 'all'
  openLightbox(id)
}

function closeLightbox() {
  lightboxOpen.value = false
  lightboxPhotoId.value = undefined
}

function openCreateAlbum() {
  newAlbumName.value = ''
  createAlbumError.value = ''
  createAlbumOpen.value = true
}

async function submitCreateAlbum() {
  const name = newAlbumName.value.trim()
  if (!name || !projectId.value) return
  createAlbumLoading.value = true
  createAlbumError.value = ''
  try {
    const album = await createAlbum(projectId.value, name)
    albums.value = [album, ...albums.value]
    createAlbumOpen.value = false
    activeView.value = album.id
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
    createAlbumError.value = msg ?? '建立失敗，請稍後再試'
  } finally {
    createAlbumLoading.value = false
  }
}

function openDeleteAlbumDialog(album: AlbumItem) {
  deleteAlbumTarget.value = album
  deleteAlbumOpen.value = true
}

function closeDeleteAlbumDialog() {
  deleteAlbumTarget.value = null
  deleteAlbumOpen.value = false
}

async function confirmDeleteAlbum() {
  const album = deleteAlbumTarget.value
  if (!album || !projectId.value) return
  deleteAlbumLoading.value = true
  try {
    await deleteAlbum(projectId.value, album.id)
    albums.value = albums.value.filter((a) => a.id !== album.id)
    if (activeView.value === album.id) activeView.value = 'library'
    closeDeleteAlbumDialog()
  } finally {
    deleteAlbumLoading.value = false
  }
}

async function openAddToAlbum() {
  addToAlbumSelectedIds.value = new Set()
  addToAlbumError.value = ''
  addToAlbumOpen.value = true
  addToAlbumFetching.value = true
  try {
    await fetchLibraryPhotos({ silent: true })
  } finally {
    addToAlbumFetching.value = false
  }
}

function toggleAddToAlbumSelection(id: string) {
  const next = new Set(addToAlbumSelectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  addToAlbumSelectedIds.value = next
}

async function submitAddToAlbum() {
  const albumId = activeView.value
  if (!albumId || typeof albumId !== 'string' || !projectId.value || addToAlbumSelectedIds.value.size === 0) return
  addToAlbumLoading.value = true
  addToAlbumError.value = ''
  try {
    for (const attachmentId of addToAlbumSelectedIds.value) {
      await addPhotoToAlbum(projectId.value, albumId, attachmentId)
    }
    addToAlbumOpen.value = false
    await fetchAlbumPhotos(albumId)
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
    addToAlbumError.value = msg ?? '加入失敗，請稍後再試'
  } finally {
    addToAlbumLoading.value = false
  }
}

const libraryPhotoItems = computed(() =>
  libraryPhotos.value.filter((item) => (item.mimeType ?? '').startsWith('image/'))
)

/** 從圖庫加入對話框：只顯示尚未在此相簿的照片 */
const libraryPhotoItemsForAddToAlbum = computed(() => {
  const items = libraryPhotoItems.value
  if (activeView.value === 'library' || activeView.value === 'recent' || typeof activeView.value !== 'string') {
    return items
  }
  const inAlbumIds = new Set(albumPhotos.value.map((p) => p.id))
  return items.filter((item) => !inAlbumIds.has(item.id))
})

function openDeletePhoto(item: PhotoGridItem) {
  deletePhotoTarget.value = item
  deletePhotoOpen.value = true
}

function closeDeletePhoto() {
  deletePhotoOpen.value = false
  deletePhotoTarget.value = null
}

async function confirmDeletePhoto() {
  const item = deletePhotoTarget.value
  if (!item) return
  deletePhotoLoading.value = true
  try {
    await deleteFile(item.id)
    closeDeletePhoto()
    favoriteIds.value.delete(item.id)
    favoriteIds.value = new Set(favoriteIds.value)
    favoritePhotos.value = favoritePhotos.value.filter((p) => p.id !== item.id)
    await fetchLibraryPhotos()
    if (activeView.value === 'favorites') await fetchFavorites()
    else if (!isLibrary.value && typeof activeView.value === 'string') {
      await fetchAlbumPhotos(activeView.value)
    }
  } finally {
    deletePhotoLoading.value = false
  }
}

// 多選：批次刪除
const deleteSelectedOpen = ref(false)
const deleteSelectedLoading = ref(false)
function openDeleteSelected() {
  deleteSelectedOpen.value = true
}
function closeDeleteSelected() {
  deleteSelectedOpen.value = false
}
async function confirmDeleteSelected() {
  const ids = Array.from(selectedIds.value)
  if (!ids.length || !projectId.value) return
  deleteSelectedLoading.value = true
  try {
    for (const id of ids) {
      await deleteFile(id)
      favoriteIds.value.delete(id)
    }
    favoriteIds.value = new Set(favoriteIds.value)
    favoritePhotos.value = favoritePhotos.value.filter((p) => !selectedIds.value.has(p.id))
    clearSelection()
    closeDeleteSelected()
    await fetchLibraryPhotos()
    if (activeView.value === 'favorites') await fetchFavorites()
    else if (!isLibrary.value && typeof activeView.value === 'string') {
      await fetchAlbumPhotos(activeView.value)
    }
  } finally {
    deleteSelectedLoading.value = false
  }
}

// 多選：加入到相簿（選擇相簿後加入）
const addSelectedToAlbumOpen = ref(false)
const addSelectedToAlbumTargetId = ref('')
const addSelectedToAlbumLoading = ref(false)
const addSelectedToAlbumError = ref('')
function openAddSelectedToAlbum() {
  addSelectedToAlbumTargetId.value = ''
  addSelectedToAlbumError.value = ''
  addSelectedToAlbumOpen.value = true
}
function closeAddSelectedToAlbum() {
  addSelectedToAlbumOpen.value = false
}
async function confirmAddSelectedToAlbum() {
  const albumId = addSelectedToAlbumTargetId.value
  if (!albumId || !projectId.value || selectedIds.value.size === 0) return
  addSelectedToAlbumLoading.value = true
  addSelectedToAlbumError.value = ''
  try {
    for (const attachmentId of selectedIds.value) {
      await addPhotoToAlbum(projectId.value, albumId, attachmentId)
    }
    clearSelection()
    closeAddSelectedToAlbum()
    if (activeView.value === albumId) await fetchAlbumPhotos(albumId)
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
    addSelectedToAlbumError.value = msg ?? '加入失敗，請稍後再試'
  } finally {
    addSelectedToAlbumLoading.value = false
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 overflow-hidden">
    <!-- Left sidebar -->
    <aside
      :class="[
        'flex shrink-0 flex-col transition-[width] duration-200',
        sidebarCollapsed ? 'w-14' : 'w-56',
      ]"
    >
      <div class="flex h-12 shrink-0 items-center justify-between px-2">
        <span v-show="!sidebarCollapsed" class="truncate px-2 text-sm font-medium text-foreground">
          快捷方式
        </span>
        <Button
          variant="ghost"
          size="icon"
          class="shrink-0"
          aria-label="收合側欄"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <PanelLeftClose v-if="!sidebarCollapsed" class="size-4" />
          <PanelLeft v-else class="size-4" />
        </Button>
      </div>
      <ScrollArea class="flex-1">
        <nav class="flex flex-col gap-0.5 p-2">
          <button
            type="button"
            :class="[
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
              activeView === 'favorites'
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground hover:bg-muted/70',
              sidebarCollapsed && 'justify-center px-0',
            ]"
            @click="activeView = 'favorites'"
          >
            <Star class="size-4 shrink-0" />
            <span v-show="!sidebarCollapsed" class="truncate">我的最愛</span>
          </button>
          <button
            type="button"
            :class="[
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
              activeView === 'library'
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground hover:bg-muted/70',
              sidebarCollapsed && 'justify-center px-0',
            ]"
            @click="activeView = 'library'"
          >
            <LayoutGrid class="size-4 shrink-0" />
            <span v-show="!sidebarCollapsed" class="truncate">圖庫</span>
          </button>
          <button
            type="button"
            :class="[
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
              activeView === 'recent'
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground hover:bg-muted/70',
              sidebarCollapsed && 'justify-center px-0',
            ]"
            @click="activeView = 'recent'"
          >
            <Clock class="size-4 shrink-0" />
            <span v-show="!sidebarCollapsed" class="truncate">最近儲存</span>
          </button>
          <div v-show="!sidebarCollapsed" class="mt-2 px-2">
            <p class="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              相簿
            </p>
            <div class="space-y-0.5">
              <button
                v-for="album in albums"
                :key="album.id"
                type="button"
                :class="[
                  'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                  activeView === album.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground hover:bg-muted/70',
                ]"
                @click="activeView = album.id"
              >
                <span class="flex min-w-0 items-center gap-2">
                  <FolderOpen class="size-4 shrink-0" />
                  <span class="truncate">{{ album.name }}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7 shrink-0 opacity-70 hover:opacity-100"
                  aria-label="刪除相簿"
                  @click.stop="openDeleteAlbumDialog(album)"
                >
                  <Trash2 class="size-3.5" />
                </Button>
              </button>
              <Button
                variant="ghost"
                class="w-full justify-start gap-2 text-muted-foreground"
                @click="openCreateAlbum"
              >
                <Plus class="size-4" />
                新增相簿
              </Button>
            </div>
          </div>
        </nav>
      </ScrollArea>
    </aside>

    <!-- Main: toolbar + grid -->
    <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div class="flex shrink-0 flex-col gap-2">
        <div class="flex items-center justify-between gap-4 px-4 py-3">
          <h2 class="truncate text-base font-semibold text-foreground">
            {{ currentTitle }}
          </h2>
          <div class="flex items-center gap-2">
          <input
            ref="fileInputRef"
            type="file"
            class="hidden"
            accept="image/*"
            multiple
            @change="onFileInputChange"
          />
          <Button
            v-if="activeView !== 'favorites' && activeView !== 'library' && activeView !== 'recent'"
            variant="outline"
            size="sm"
            :disabled="!libraryPhotoItems.length || addToAlbumLoading"
            @click="openAddToAlbum"
          >
            從圖庫加入
          </Button>
          <Button
            :variant="selectionMode ? 'secondary' : 'outline'"
            size="sm"
            @click="toggleSelectionMode"
          >
            {{ selectionMode ? '完成' : '選取' }}
          </Button>
          <Button
            size="sm"
            :disabled="uploadInProgress || !projectId"
            @click="triggerUpload"
          >
            <Loader2 v-if="uploadInProgress" class="mr-2 size-4 animate-spin" />
            <Upload v-else class="mr-2 size-4" />
            上傳照片
          </Button>
        </div>
        </div>
        <!-- 多選工具列：選取模式或有選取時顯示 -->
        <div
          v-if="selectionMode || selectedIds.size > 0"
          class="flex items-center gap-3 border-t border-border bg-muted/50 px-4 py-2"
        >
          <span class="text-sm text-muted-foreground">已選 {{ selectedIds.size }} 張</span>
          <Button variant="ghost" size="sm" @click="clearSelection">取消選取</Button>
          <Button variant="outline" size="sm" :disabled="selectedIds.size === 0" @click="openDeleteSelected">
            <Trash2 class="mr-1.5 size-4" />
            刪除
          </Button>
          <Button variant="outline" size="sm" :disabled="selectedIds.size === 0" @click="openAddSelectedToAlbum">
            <FolderOpen class="mr-1.5 size-4" />
            加入到相簿
          </Button>
        </div>
      </div>
      <!-- 圖面區：僅在「圖庫」時顯示年/月/全部 tab，其餘直接顯示全部 -->
      <Tabs v-model="photoTab" class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div v-if="activeView === 'library'" class="shrink-0 px-4 pb-2">
          <TabsList class="w-fit">
            <TabsTrigger value="year">年</TabsTrigger>
            <TabsTrigger value="month">月</TabsTrigger>
            <TabsTrigger value="all">全部</TabsTrigger>
          </TabsList>
        </div>
        <ScrollArea class="min-h-0 flex-1">
          <div v-if="loadingPhotos" class="flex flex-col items-center justify-center py-24">
            <Loader2 class="size-10 animate-spin text-muted-foreground" />
            <p class="mt-3 text-sm text-muted-foreground">載入中…</p>
          </div>
          <div
            v-else-if="!photoGridItems.length"
            class="flex flex-col items-center justify-center py-24 text-center"
          >
            <ImageIcon class="size-16 text-muted-foreground/50" />
            <p class="mt-4 text-sm font-medium text-foreground">尚無照片</p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ activeView === 'favorites' ? '尚未加入任何最愛，在照片上點擊星號即可加入' : isLibrary ? '上傳照片後會顯示於圖庫與最近儲存' : '在此相簿加入照片後會顯示於此' }}
            </p>
            <Button v-if="isLibrary" class="mt-4" size="sm" @click="triggerUpload">
              <Upload class="mr-2 size-4" />
              上傳照片
            </Button>
          </div>
          <template v-else>
            <!-- 年：每個年份底下僅「該年精選」（僅圖庫時顯示） -->
            <div v-show="activeView === 'library' && photoTab === 'year'" class="space-y-8 p-4">
              <template v-for="group in photosGroupedByYear" :key="group.year">
                <section class="group">
                  <h3 class="mb-3 text-lg font-semibold text-foreground/90">{{ group.year }} 年</h3>
                  <template v-if="group.items.slice(0, FEATURED_PER_GROUP).length">
                    <div class="mb-4">
                      <p class="mb-2 text-sm font-medium text-muted-foreground">精選</p>
                      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      <div
                        v-for="item in group.items.slice(0, FEATURED_PER_GROUP)"
                        :key="item.id"
                        :class="[
                          'group/thumb relative aspect-square min-w-0 cursor-pointer overflow-hidden rounded-lg focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                          isSelected(item.id) && 'ring-2 ring-primary ring-offset-2',
                        ]"
                        @click="handlePhotoClick(item, $event)"
                      >
                        <PhotoThumbnail :file-id="item.id" />
                        <div
                          v-if="selectionMode"
                          class="absolute left-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground"
                          aria-hidden
                        >
                          <CheckCircle2 v-if="isSelected(item.id)" class="size-3.5 text-primary" fill="currentColor" />
                          <Circle v-else class="size-3.5" />
                        </div>
                      </div>
                    </div>
                    </div>
                  </template>
                </section>
              </template>
            </div>
            <!-- 月：每個月份底下僅「該月精選」（僅圖庫時顯示） -->
            <div v-show="activeView === 'library' && photoTab === 'month'" class="space-y-8 p-4">
              <template v-for="group in photosGroupedByYearMonth" :key="`${group.year}-${group.month}`">
                <section class="group">
                  <h3 class="mb-3 text-lg font-semibold text-foreground/90">{{ group.year }} 年 {{ group.month }} 月</h3>
                  <template v-if="group.items.slice(0, FEATURED_PER_GROUP).length">
                    <div class="mb-4">
                      <p class="mb-2 text-sm font-medium text-muted-foreground">精選</p>
                      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      <div
                        v-for="item in group.items.slice(0, FEATURED_PER_GROUP)"
                        :key="item.id"
                        :class="[
                          'group/thumb relative aspect-square min-w-0 cursor-pointer overflow-hidden rounded-lg focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                          isSelected(item.id) && 'ring-2 ring-primary ring-offset-2',
                        ]"
                        @click="handlePhotoClick(item, $event)"
                      >
                        <PhotoThumbnail :file-id="item.id" />
                        <div
                          v-if="selectionMode"
                          class="absolute left-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground"
                          aria-hidden
                        >
                          <CheckCircle2 v-if="isSelected(item.id)" class="size-3.5 text-primary" fill="currentColor" />
                          <Circle v-else class="size-3.5" />
                        </div>
                      </div>
                    </div>
                    </div>
                  </template>
                </section>
              </template>
            </div>
            <!-- 全部：年 > 月 > 日，可刪除（圖庫時依 tab，其餘檢視一律顯示此塊） -->
            <div v-show="(activeView === 'library' && photoTab === 'all') || activeView !== 'library'" class="space-y-8 p-4">
              <template v-for="group in photosGroupedByDate" :key="group.year">
                <section>
                  <h3 class="sticky top-0 z-10 mb-3 py-1 text-lg font-semibold text-foreground/90">
                    {{ group.year }} 年
                  </h3>
                  <div class="space-y-6">
                    <template v-for="monthGroup in group.months" :key="monthGroup.month">
                      <div>
                        <h4 class="mb-2 text-sm font-medium text-muted-foreground">
                          {{ monthGroup.month }} 月
                        </h4>
                        <div class="space-y-4">
                          <template v-for="dayGroup in monthGroup.days" :key="`${monthGroup.month}-${dayGroup.day}`">
                            <div>
                              <p class="mb-2 text-xs font-medium text-muted-foreground/90">
                                {{ dayGroup.day }} 日
                              </p>
                              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                <div
                                  v-for="item in dayGroup.items"
                                  :key="item.id"
                                  :class="[
                                    'group relative aspect-square min-w-0 cursor-pointer overflow-hidden rounded-lg focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
                                    isSelected(item.id) && 'ring-2 ring-primary ring-offset-2',
                                  ]"
                                  @click="handlePhotoClick(item, $event)"
                                >
                                  <div class="absolute inset-0 size-full rounded-lg">
                                    <PhotoThumbnail :file-id="item.id" />
                                  </div>
                                  <div
                                    v-if="selectionMode"
                                    class="absolute left-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground"
                                    aria-hidden
                                  >
                                    <CheckCircle2 v-if="isSelected(item.id)" class="size-3.5 text-primary" fill="currentColor" />
                                    <Circle v-else class="size-3.5" />
                                  </div>
                                  <template v-if="!selectionMode">
                                    <button
                                      type="button"
                                      class="absolute bottom-1.5 left-1.5 z-10 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm opacity-0 transition-opacity hover:bg-background group-hover:opacity-100 focus:opacity-100"
                                      aria-label="我的最愛"
                                      @click.stop="toggleFavorite(item)"
                                    >
                                      <Star
                                        :class="['size-4', isFavorite(item.id) ? 'fill-primary text-primary' : '']"
                                      />
                                    </button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      class="absolute right-1.5 top-1.5 size-8 bg-background/80 text-destructive shadow-sm opacity-0 transition-opacity hover:bg-background hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                                      aria-label="刪除照片"
                                      @click.stop="openDeletePhoto(item)"
                                    >
                                      <Trash2 class="size-4" />
                                    </Button>
                                  </template>
                                </div>
                              </div>
                            </div>
                          </template>
                        </div>
                      </div>
                    </template>
                  </div>
                </section>
              </template>
            </div>
          </template>
        </ScrollArea>
      </Tabs>
    </div>
  </div>

  <!-- Lightbox -->
  <Dialog :open="lightboxOpen" @update:open="(v: boolean) => !v && closeLightbox()">
    <DialogContent class="max-w-4xl border-border bg-background p-0 overflow-hidden">
      <div class="relative flex min-h-[50vh] items-center justify-center bg-muted/30 p-4">
        <img
          v-if="lightboxUrl && !lightboxLoading"
          :src="lightboxUrl"
          alt=""
          class="max-h-[80vh] max-w-full object-contain"
        />
        <Loader2 v-else class="size-12 animate-spin text-muted-foreground" />
      </div>
    </DialogContent>
  </Dialog>

  <!-- Create album -->
  <Dialog v-model:open="createAlbumOpen">
    <DialogContent class="gap-4">
      <DialogHeader>
        <DialogTitle>新增相簿</DialogTitle>
      </DialogHeader>
      <div class="grid gap-2">
        <label for="album-name" class="text-sm font-medium text-foreground">相簿名稱</label>
        <Input
          id="album-name"
          v-model="newAlbumName"
          placeholder="例如：工地進度 2025"
          class="bg-background"
          @keydown.enter="submitCreateAlbum"
        />
        <p v-if="createAlbumError" class="text-sm text-destructive">{{ createAlbumError }}</p>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="createAlbumOpen = false">取消</Button>
        <Button
          :disabled="!newAlbumName.trim() || createAlbumLoading"
          @click="submitCreateAlbum"
        >
          <Loader2 v-if="createAlbumLoading" class="mr-2 size-4 animate-spin" />
          建立
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Add to album (from library) -->
  <Dialog v-model:open="addToAlbumOpen">
    <DialogContent class="flex max-h-[85vh] flex-col gap-4 overflow-hidden p-6">
      <DialogHeader class="shrink-0">
        <DialogTitle>從圖庫加入照片</DialogTitle>
      </DialogHeader>
      <p v-if="addToAlbumError" class="shrink-0 text-sm text-destructive">{{ addToAlbumError }}</p>
      <div class="min-h-0 max-h-[50vh] flex-1 overflow-hidden rounded-md border border-border">
        <ScrollArea v-if="!addToAlbumFetching" class="h-full min-h-0">
          <div v-if="libraryPhotoItemsForAddToAlbum.length === 0" class="py-12 text-center text-sm text-muted-foreground">
            圖庫中尚無可加入的照片，或已全部加入此相簿。
          </div>
          <div v-else class="grid grid-cols-3 gap-2 p-4 sm:grid-cols-4 md:grid-cols-5">
            <div
              v-for="item in libraryPhotoItemsForAddToAlbum"
              :key="item.id"
              :class="[
                'relative aspect-square min-w-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                addToAlbumSelectedIds.has(item.id)
                  ? 'border-primary bg-primary/10'
                  : 'border-transparent bg-muted/30 hover:border-muted-foreground/30',
              ]"
              @click="toggleAddToAlbumSelection(item.id)"
            >
              <PhotoThumbnail :file-id="item.id" />
              <div
                v-if="addToAlbumSelectedIds.has(item.id)"
                class="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <span class="text-xs">✓</span>
              </div>
            </div>
          </div>
        </ScrollArea>
        <div v-else class="flex h-32 items-center justify-center">
          <Loader2 class="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
      <DialogFooter class="shrink-0">
        <Button variant="outline" @click="addToAlbumOpen = false">取消</Button>
        <Button
          :disabled="addToAlbumSelectedIds.size === 0 || addToAlbumLoading"
          @click="submitAddToAlbum"
        >
          <Loader2 v-if="addToAlbumLoading" class="mr-2 size-4 animate-spin" />
          加入 {{ addToAlbumSelectedIds.size > 0 ? `(${addToAlbumSelectedIds.size})` : '' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Delete album -->
  <Dialog v-model:open="deleteAlbumOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>刪除相簿</DialogTitle>
      </DialogHeader>
      <p class="text-sm text-muted-foreground">
        確定要刪除「{{ deleteAlbumTarget?.name }}」？相簿內的照片不會被刪除，僅會從此相簿移除。
      </p>
      <DialogFooter>
        <Button variant="outline" @click="closeDeleteAlbumDialog">取消</Button>
        <Button variant="destructive" :disabled="deleteAlbumLoading" @click="confirmDeleteAlbum">
          <Loader2 v-if="deleteAlbumLoading" class="mr-2 size-4 animate-spin" />
          刪除
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Delete photo -->
  <Dialog v-model:open="deletePhotoOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>刪除照片</DialogTitle>
      </DialogHeader>
      <p class="text-sm text-muted-foreground">
        確定要刪除此照片？刪除後無法復原。
      </p>
      <DialogFooter>
        <Button variant="outline" @click="closeDeletePhoto">取消</Button>
        <Button variant="destructive" :disabled="deletePhotoLoading" @click="confirmDeletePhoto">
          <Loader2 v-if="deletePhotoLoading" class="mr-2 size-4 animate-spin" />
          刪除
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 多選：批次刪除 -->
  <Dialog v-model:open="deleteSelectedOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>刪除所選照片</DialogTitle>
      </DialogHeader>
      <p class="text-sm text-muted-foreground">
        確定要刪除所選的 {{ selectedIds.size }} 張照片？刪除後無法復原。
      </p>
      <DialogFooter>
        <Button variant="outline" @click="closeDeleteSelected">取消</Button>
        <Button variant="destructive" :disabled="deleteSelectedLoading" @click="confirmDeleteSelected">
          <Loader2 v-if="deleteSelectedLoading" class="mr-2 size-4 animate-spin" />
          刪除
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 多選：加入到相簿 -->
  <Dialog v-model:open="addSelectedToAlbumOpen">
    <DialogContent class="gap-4">
      <DialogHeader>
        <DialogTitle>加入到相簿</DialogTitle>
      </DialogHeader>
      <p class="text-sm text-muted-foreground">將所選 {{ selectedIds.size }} 張照片加入至以下相簿：</p>
      <div class="grid gap-2">
        <label class="text-sm font-medium text-foreground">選擇相簿</label>
        <select
          v-model="addSelectedToAlbumTargetId"
          class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">請選擇相簿</option>
          <option v-for="a in albums" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
        <p v-if="addSelectedToAlbumError" class="text-sm text-destructive">{{ addSelectedToAlbumError }}</p>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="closeAddSelectedToAlbum">取消</Button>
        <Button
          :disabled="!addSelectedToAlbumTargetId || addSelectedToAlbumLoading"
          @click="confirmAddSelectedToAlbum"
        >
          <Loader2 v-if="addSelectedToAlbumLoading" class="mr-2 size-4 animate-spin" />
          加入
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
