import { ref, computed } from 'vue'

export interface UsePaginationOptions {
  initialPage?: number
  initialLimit?: number
  total?: number
}

/**
 * 列表分頁邏輯，可接 API 的 meta
 */
export function usePagination(options: UsePaginationOptions = {}) {
  const page = ref(options.initialPage ?? 1)
  const limit = ref(options.initialLimit ?? 20)
  const total = ref(options.total ?? 0)

  const totalPages = computed(() => Math.ceil(total.value / limit.value) || 1)
  const hasNext = computed(() => page.value < totalPages.value)
  const hasPrev = computed(() => page.value > 1)

  function setPage(p: number) {
    page.value = Math.max(1, Math.min(p, totalPages.value))
  }

  function setTotal(t: number) {
    total.value = t
  }

  function next() {
    if (hasNext.value) setPage(page.value + 1)
  }

  function prev() {
    if (hasPrev.value) setPage(page.value - 1)
  }

  function reset() {
    page.value = 1
    total.value = 0
  }

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
    setPage,
    setTotal,
    next,
    prev,
    reset,
  }
}
