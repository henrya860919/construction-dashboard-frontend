<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { ROUTE_NAME } from '@/constants/routes'
import { Sonner } from '@/components/ui/sonner'

const router = useRouter()

/** 手機版根頁面（無返回鈕的 Tab 首頁），與 MobileLayout 的 ROOT_ROUTE_NAMES 一致 */
const MOBILE_ROOT_NAMES = [
  ROUTE_NAME.MOBILE_PROJECT_PICKER,
  ROUTE_NAME.MOBILE_INSPECTION,
  ROUTE_NAME.MOBILE_DEFECTS,
  ROUTE_NAME.MOBILE_REPAIR,
  ROUTE_NAME.MOBILE_DIARY,
] as const

function isMobileRoot(route: { path: string; name?: string | symbol | null }): boolean {
  if (!route.path.startsWith('/mobile')) return false
  return route.name != null && MOBILE_ROOT_NAMES.includes(route.name as (typeof MOBILE_ROOT_NAMES)[number])
}

/** iOS PWA 根頁防滑出：僅在 iOS + standalone 時啟用 */
function setupIosPwaRootGuard() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone = 'standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true
  if (!isIOS || !isStandalone) return () => {}

  const EDGE_THRESHOLD = 20
  let edgeTouchStartX = 0

  function onPopstate() {
    if (isMobileRoot(router.currentRoute.value)) {
      history.pushState({ iosPwaRoot: true }, '', window.location.href)
    }
  }

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 0) return
    const x = e.touches[0].clientX
    const w = window.innerWidth
    if (x < EDGE_THRESHOLD || x > w - EDGE_THRESHOLD) {
      edgeTouchStartX = x
    } else {
      edgeTouchStartX = -1
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (edgeTouchStartX < 0 || e.touches.length === 0) return
    if (!isMobileRoot(router.currentRoute.value)) return
    const x = e.touches[0].clientX
    const isLeftEdge = edgeTouchStartX < EDGE_THRESHOLD
    const isBackGesture = isLeftEdge && x > edgeTouchStartX
    if (isBackGesture) {
      e.preventDefault()
    }
  }

  function onTouchEnd() {
    edgeTouchStartX = -1
  }

  window.addEventListener('popstate', onPopstate)
  window.addEventListener('touchstart', onTouchStart, { passive: true })
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd, { passive: true })

  const removeAfterEach = router.afterEach((to) => {
    if (isMobileRoot(to)) {
      history.pushState({ iosPwaRoot: true }, '', window.location.href)
    }
  })

  if (isMobileRoot(router.currentRoute.value)) {
    history.pushState({ iosPwaRoot: true }, '', window.location.href)
  }

  return () => {
    window.removeEventListener('popstate', onPopstate)
    window.removeEventListener('touchstart', onTouchStart)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd)
    removeAfterEach()
  }
}

/** iOS PWA 鍵盤 viewport 修復：動態 --vh、keyboard-open class，僅在 iOS + standalone 時啟用 */
function setupIosPwaViewportFix() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone = 'standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true
  if (!isIOS || !isStandalone) return () => {}

  const doc = document.documentElement
  const body = document.body

  function setVh() {
    const h = window.visualViewport?.height ?? window.innerHeight
    doc.style.setProperty('--vh', `${h * 0.01}px`)
  }

  let keyboardCloseTimer: ReturnType<typeof setTimeout> | null = null

  function onFocusIn() {
    if (keyboardCloseTimer) {
      clearTimeout(keyboardCloseTimer)
      keyboardCloseTimer = null
    }
    body.classList.add('keyboard-open')
  }

  function onFocusOut() {
    keyboardCloseTimer = setTimeout(() => {
      body.classList.remove('keyboard-open')
      keyboardCloseTimer = null
    }, 400)
  }

  function onResize() {
    setVh()
  }

  body.classList.add('ios-pwa-standalone')
  setVh()
  window.addEventListener('resize', onResize)
  window.visualViewport?.addEventListener('resize', onResize)
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)

  return () => {
    body.classList.remove('ios-pwa-standalone', 'keyboard-open')
    if (keyboardCloseTimer) clearTimeout(keyboardCloseTimer)
    window.removeEventListener('resize', onResize)
    window.visualViewport?.removeEventListener('resize', onResize)
    document.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('focusout', onFocusOut)
    doc.style.removeProperty('--vh')
  }
}

let teardown: (() => void) | null = null
let teardownViewport: (() => void) | null = null

onMounted(() => {
  teardown = setupIosPwaRootGuard()
  teardownViewport = setupIosPwaViewportFix()
})

onUnmounted(() => {
  teardown?.()
  teardownViewport?.()
})
</script>

<template>
  <RouterView />
  <Sonner />
</template>
