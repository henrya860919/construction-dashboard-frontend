import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchActiveAnnouncements, markAnnouncementRead as apiMarkRead, type ActiveAnnouncementItem } from '@/api/announcements'

export const useAnnouncementStore = defineStore('announcements', () => {
  const list = ref<ActiveAnnouncementItem[]>([])
  const loading = ref(false)

  const unreadList = computed(() => list.value.filter((a) => !a.readAt))
  const unreadCount = computed(() => unreadList.value.length)

  async function fetch() {
    loading.value = true
    try {
      list.value = await fetchActiveAnnouncements()
    } catch {
      list.value = []
    } finally {
      loading.value = false
    }
  }

  async function markAsRead(id: string) {
    try {
      await apiMarkRead(id)
      const item = list.value.find((a) => a.id === id)
      if (item) item.readAt = new Date().toISOString()
    } catch {
      // 可選：refetch
    }
  }

  return { list, loading, unreadList, unreadCount, fetch, markAsRead }
})
