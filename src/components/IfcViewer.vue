<script setup lang="ts">
import * as OBC from '@thatopen/components'
import * as OBCF from '@thatopen/components-front'
import * as BUI from '@thatopen/ui'
import * as BUIC from '@thatopen/ui-obc'
import type { BIMMaterial, FragmentsModel, ItemAttribute, ItemData } from '@thatopen/fragments'
import * as FRAGS from '@thatopen/fragments'
import * as THREE from 'three'
import fragmentsWorkerUrl from '@thatopen/fragments/worker?url'
import webIfcWasmUrl from 'web-ifc/web-ifc.wasm?url'
import CameraControls from 'camera-controls'
import nipplejs from 'nipplejs'
import { useMediaQuery } from '@vueuse/core'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Box,
  Expand,
  Gamepad2,
  ChevronUp,
  FolderOpen,
  Footprints,
  Hand,
  Layers2,
  MapPinned,
  Maximize2,
  Move3d,
  Rotate3d,
  Ruler,
  Scissors,
  Settings,
  SlidersHorizontal,
  Trash2,
  Video,
  X,
} from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'

/** 範例檔走 Vite proxy，避免 CORS */
const EXAMPLE_FRAG_ARQ = '/thatopen-frags/school_arq.frag'
const EXAMPLE_FRAG_STR = '/thatopen-frags/school_str.frag'

const SELECT_NAME = 'select'
const STOREYS_CLASS = 'Storeys'

let bimUiInitialized = false

const containerRef = ref<HTMLElement | null>(null)
const viewerShellRef = ref<HTMLElement | null>(null)

const status = ref('')
const error = ref('')
const loading = ref(false)
const loadingIfc = ref(false)
const ifcProgressPercent = ref(0)

const showFloorsPanel = ref(false)
const showPropertiesPanel = ref(false)
const showSectionPanel = ref(false)

const storeyNames = ref<string[]>([])
const storeyVisible = reactive<Record<string, boolean>>({})

/** ThatOpen `Components` 為 class 實例，用 shallowRef 避免 Vue `UnwrapRef` 誤推斷 */
const componentsRef = shallowRef<OBC.Components | null>(null)
let worldRef: OBC.SimpleWorld<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBCF.PostproductionRenderer
> | null = null

let resizeObserver: ResizeObserver | null = null
let onModelLoaded: ((data: { key: string; value: FragmentsModel }) => void) | null = null
let onMaterialSet: ((data: { key: number; value: BIMMaterial }) => void) | null = null
let onControlsUpdate: (() => void) | null = null

let clipperOnAfterCreate: ((plane: OBC.SimplePlane) => void) | null = null
let highlighterOnHighlight: (() => void) | null = null
let highlighterOnClear: (() => void) | null = null

const hasPropertySelection = ref(false)
const propertiesLoading = ref(false)

type PropertyRow = { name: string; value: string }
type PropertySection = { id: string; title: string; rows: PropertyRow[] }

const propertySections = ref<PropertySection[]>([])

/** 水平剖切：單一平面 + ClipEdges（ClipStyler） */
const horizontalSectionActive = ref(false)
const horizontalSectionPlaneId = ref<string | null>(null)
/** 0–1 對應場景包圍盒 Y */
const sectionHeightT = ref(0.5)
const sceneYRange = ref<{ min: number; max: number } | null>(null)

/** 頂部載入區（檔案／範例）顯示開關 */
const showLoadDock = ref(true)
const ifcFileInputRef = ref<HTMLInputElement | null>(null)
const fragFileInputRef = ref<HTMLInputElement | null>(null)
/** 本機選多個 .frag 時，是否在載入前清空場景內既有模型 */
const clearFragSceneBeforeLoad = ref(false)
/** fragments.list 的 modelId → 顯示名稱（檔名等） */
const fragModelLabels = reactive<Record<string, string>>({})
const loadedModelRows = ref<{ id: string; label: string }[]>([])
/** 呼應 OrthoPerspectiveCamera 導覽模式 */
const navModeId = ref<string>('Orbit')
/** Orbit 模式下主按鈕改為平移（TRUCK） */
const orbitPanPrimary = ref(false)
/** 第一人稱漫遊（自訂 WASD + E/Q 升降／桌面左鍵拖曳轉向／手機雙搖桿；與引擎內建 FirstPerson 分開） */
const freeRoamActive = ref(false)
/** 漫遊移動速度（世界座標單位／秒）；按住 Shift ×3；滑桿範圍 14–16 */
const freeRoamMoveSpeed = ref(14)
const roamStickMoveZoneRef = ref<HTMLElement | null>(null)
const roamStickLookZoneRef = ref<HTMLElement | null>(null)
const showRoamVirtualSticks = useMediaQuery('(pointer: coarse)')

/** 供模板啟用按鈕（worldRef 非響應式） */
const viewerCanvasReady = ref(false)

/** 桌面：按住左鍵拖曳時的視角靈敏度（弧度／像素） */
const ROAM_DRAG_LOOK_SENS = 0.0025
const ROAM_PITCH_LIMIT = 1.55
const ROAM_LOOK_STICK_SPEED = 2.2
/** 與 Highlighter.mouseMoveThreshold 對齊：位移小視為「對準星點擊」、大視為轉向拖曳 */
const ROAM_PICK_MOVE_THRESHOLD_PX = 5
const ROAM_SPEED_MIN = 14
const ROAM_SPEED_MAX = 16

const roamKeysDown = new Set<string>()
let roamYaw = 0
let roamPitch = 0
let roamMoveStick = { x: 0, y: 0 }
let roamLookStick = { x: 0, y: 0 }
let roamRafId = 0
let roamLastTs = 0
let roamMoveCollection: ReturnType<typeof nipplejs.create> | null = null
let roamLookCollection: ReturnType<typeof nipplejs.create> | null = null
let roamLookCanvas: HTMLCanvasElement | null = null
let roamLookDragging = false
let roamLookLastX = 0
let roamLookLastY = 0
let roamPickDownX = 0
let roamPickDownY = 0

function getViewerCanvas(): HTMLCanvasElement | null {
  return containerRef.value?.querySelector('canvas') ?? null
}

function destroyRoamNipples() {
  roamMoveCollection?.destroy()
  roamLookCollection?.destroy()
  roamMoveCollection = null
  roamLookCollection = null
  roamMoveStick = { x: 0, y: 0 }
  roamLookStick = { x: 0, y: 0 }
}

function setupRoamNipples() {
  destroyRoamNipples()
  if (!showRoamVirtualSticks.value || !freeRoamActive.value) return
  const moveZone = roamStickMoveZoneRef.value
  const lookZone = roamStickLookZoneRef.value
  if (!moveZone || !lookZone) return

  const stickColor = {
    front: 'var(--foreground)',
    back: 'var(--muted)',
  }

  roamMoveCollection = nipplejs.create({
    zone: moveZone,
    mode: 'static',
    size: 112,
    position: { left: '50%', top: '50%' },
    color: stickColor,
    dynamicPage: true,
  })
  roamMoveCollection.on('move', (evt) => {
    roamMoveStick = { x: evt.data.vector.x, y: evt.data.vector.y }
  })
  roamMoveCollection.on('end', () => {
    roamMoveStick = { x: 0, y: 0 }
  })

  roamLookCollection = nipplejs.create({
    zone: lookZone,
    mode: 'static',
    size: 112,
    position: { left: '50%', top: '50%' },
    color: stickColor,
    dynamicPage: true,
  })
  roamLookCollection.on('move', (evt) => {
    roamLookStick = { x: evt.data.vector.x, y: evt.data.vector.y }
  })
  roamLookCollection.on('end', () => {
    roamLookStick = { x: 0, y: 0 }
  })
}

function syncRoamYawPitchFromCamera() {
  if (!worldRef) return
  const e = new THREE.Euler().setFromQuaternion(worldRef.camera.three.quaternion, 'YXZ')
  roamYaw = e.y
  roamPitch = e.x
}

function applyRoamCameraRotation() {
  if (!worldRef) return
  const cam = worldRef.camera.three
  const euler = new THREE.Euler(roamPitch, roamYaw, 0, 'YXZ')
  cam.quaternion.setFromEuler(euler)
}

function roamFrame(ts: number) {
  if (!freeRoamActive.value || !worldRef?.camera.hasCameraControls()) {
    roamRafId = 0
    return
  }
  const dt = roamLastTs > 0 ? Math.min(0.1, (ts - roamLastTs) / 1000) : 0
  roamLastTs = ts

  const sp = freeRoamMoveSpeed.value
  const base = Number.isFinite(sp)
    ? Math.min(ROAM_SPEED_MAX, Math.max(ROAM_SPEED_MIN, sp))
    : ROAM_SPEED_MIN
  const shiftBoost = roamKeysDown.has('ShiftLeft') || roamKeysDown.has('ShiftRight') ? 3 : 1
  const speed = base * shiftBoost
  const cam = worldRef.camera.three

  roamYaw += roamLookStick.x * ROAM_LOOK_STICK_SPEED * dt
  roamPitch -= roamLookStick.y * ROAM_LOOK_STICK_SPEED * dt
  roamPitch = Math.max(-ROAM_PITCH_LIMIT, Math.min(ROAM_PITCH_LIMIT, roamPitch))
  applyRoamCameraRotation()

  const worldUp = new THREE.Vector3(0, 1, 0)
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
  fwd.y = 0
  if (fwd.lengthSq() < 1e-8) {
    fwd.set(Math.sin(roamYaw), 0, -Math.cos(roamYaw))
  } else {
    fwd.normalize()
  }
  const right = new THREE.Vector3().crossVectors(fwd, worldUp).normalize()

  let mx = 0
  let mz = 0
  if (roamKeysDown.has('KeyW')) {
    mx += fwd.x
    mz += fwd.z
  }
  if (roamKeysDown.has('KeyS')) {
    mx -= fwd.x
    mz -= fwd.z
  }
  if (roamKeysDown.has('KeyA')) {
    mx -= right.x
    mz -= right.z
  }
  if (roamKeysDown.has('KeyD')) {
    mx += right.x
    mz += right.z
  }

  let my = 0
  if (roamKeysDown.has('KeyE')) {
    my += 1
  }
  if (roamKeysDown.has('KeyQ')) {
    my -= 1
  }
  if (my !== 0) {
    cam.position.y += my * speed * dt
  }

  const sx = roamMoveStick.x
  const sy = roamMoveStick.y
  if (Math.abs(sx) > 0.01 || Math.abs(sy) > 0.01) {
    mx += fwd.x * sy - right.x * sx
    mz += fwd.z * sy - right.z * sx
  }

  const len = Math.hypot(mx, mz)
  if (len > 1e-8) {
    const inv = 1 / len
    cam.position.x += mx * inv * speed * dt
    cam.position.z += mz * inv * speed * dt
  }

  void componentsRef.value?.get(OBC.FragmentsManager).core.update()

  roamRafId = requestAnimationFrame(roamFrame)
}

function onRoamKeyDown(ev: KeyboardEvent) {
  if (!freeRoamActive.value) return
  if (ev.code === 'Escape') {
    ev.preventDefault()
    void exitFreeRoamMode()
    return
  }
  if (ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') {
    roamKeysDown.add(ev.code)
    return
  }
  if (
    ev.code === 'KeyW' ||
    ev.code === 'KeyA' ||
    ev.code === 'KeyS' ||
    ev.code === 'KeyD' ||
    ev.code === 'KeyQ' ||
    ev.code === 'KeyE'
  ) {
    roamKeysDown.add(ev.code)
    ev.preventDefault()
  }
}

function onRoamKeyUp(ev: KeyboardEvent) {
  if (!freeRoamActive.value) return
  if (ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') {
    roamKeysDown.delete(ev.code)
    return
  }
  if (
    ev.code === 'KeyW' ||
    ev.code === 'KeyA' ||
    ev.code === 'KeyS' ||
    ev.code === 'KeyD' ||
    ev.code === 'KeyQ' ||
    ev.code === 'KeyE'
  ) {
    roamKeysDown.delete(ev.code)
    ev.preventDefault()
  }
}

function onRoamLookPointerMove(ev: MouseEvent) {
  if (!freeRoamActive.value || showRoamVirtualSticks.value || !roamLookDragging) return
  const dx = ev.clientX - roamLookLastX
  const dy = ev.clientY - roamLookLastY
  roamLookLastX = ev.clientX
  roamLookLastY = ev.clientY
  roamYaw -= dx * ROAM_DRAG_LOOK_SENS
  roamPitch -= dy * ROAM_DRAG_LOOK_SENS
  roamPitch = Math.max(-ROAM_PITCH_LIMIT, Math.min(ROAM_PITCH_LIMIT, roamPitch))
  applyRoamCameraRotation()
}

function onRoamLookPointerUp(ev: MouseEvent) {
  if (ev.button === 0) {
    if (freeRoamActive.value && !showRoamVirtualSticks.value && roamLookDragging) {
      const dist = Math.hypot(ev.clientX - roamPickDownX, ev.clientY - roamPickDownY)
      /** 滑鼠點擊觸發，射線永遠從螢幕中心（準星）出發，不依游標座標 */
      if (dist <= ROAM_PICK_MOVE_THRESHOLD_PX) {
        void performRoamCenterSelection(ev.shiftKey)
      }
    }
    roamLookDragging = false
  }
}

function onRoamCanvasMouseDown(ev: MouseEvent) {
  if (!freeRoamActive.value || showRoamVirtualSticks.value) return
  const canvas = getViewerCanvas()
  if (!canvas || ev.button !== 0) return
  if (!(ev.target instanceof Node) || !canvas.contains(ev.target)) return
  roamPickDownX = ev.clientX
  roamPickDownY = ev.clientY
  roamLookDragging = true
  roamLookLastX = ev.clientX
  roamLookLastY = ev.clientY
  ev.preventDefault()
}

function onRoamWindowBlur() {
  roamKeysDown.clear()
  roamLookDragging = false
}

function attachRoamLookCanvasListeners() {
  detachRoamLookCanvasListeners()
  if (showRoamVirtualSticks.value) return
  const canvas = getViewerCanvas()
  if (canvas) {
    canvas.addEventListener('mousedown', onRoamCanvasMouseDown)
    roamLookCanvas = canvas
  }
  window.addEventListener('mousemove', onRoamLookPointerMove, true)
  window.addEventListener('mouseup', onRoamLookPointerUp, true)
}

function detachRoamLookCanvasListeners() {
  roamLookCanvas?.removeEventListener('mousedown', onRoamCanvasMouseDown)
  roamLookCanvas = null
  roamLookDragging = false
  window.removeEventListener('mousemove', onRoamLookPointerMove, true)
  window.removeEventListener('mouseup', onRoamLookPointerUp, true)
}

function syncHighlighterAutoClickForRoam() {
  const hl = componentsRef.value?.get(OBCF.Highlighter)
  if (!hl?.isSetup || !hl.config) return
  /** 漫遊中關閉套件「依游標」點選；改由我們在滑鼠放開時用螢幕中心射線選取 */
  hl.config.autoHighlightOnClick = !freeRoamActive.value
}

/**
 * 漫遊準星選取：左鍵點擊（小位移）觸發。
 * 注意：OBC.SimpleRaycaster.castRay({ position }) 仍把 this.mouse.rawPosition（真實游標）傳給
 * FragmentsManager.raycast，故 IFC 命中會跟著滑鼠走；改為直接 raycast 並傳「畫布中心」的 client 座標。
 */
async function performRoamCenterSelection(shiftKey: boolean) {
  const obc = componentsRef.value
  if (!obc || !worldRef?.renderer) return
  const hl = obc.get(OBCF.Highlighter)
  if (!hl.isSetup) return
  const removePrevious = hl.multiple === 'none' ? true : !shiftKey
  const dom = worldRef.renderer.three.domElement
  const camera = worldRef.camera.three
  const rect = dom.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return
  const centerMouse = new THREE.Vector2(rect.left + rect.width * 0.5, rect.top + rect.height * 0.5)
  try {
    const fragments = obc.get(OBC.FragmentsManager)
    if (!fragments.initialized) {
      if (removePrevious) await hl.clear(SELECT_NAME).catch(() => {})
      return
    }
    const fragResult = await fragments.raycast({
      camera,
      dom,
      mouse: centerMouse,
    })
    if (!fragResult || fragResult.localId === undefined || fragResult.localId === null) {
      if (removePrevious) await hl.clear(SELECT_NAME).catch(() => {})
      return
    }
    const modelId = fragResult.fragments.modelId
    const modelIdMap: OBC.ModelIdMap = {
      [modelId]: new Set([fragResult.localId]),
    }
    await hl.highlightByID(SELECT_NAME, modelIdMap, removePrevious, false, null, true)
  } catch (e) {
    console.warn('[IfcViewer] roam center pick', e)
  }
}

function attachRoamWindowListeners() {
  window.addEventListener('keydown', onRoamKeyDown, true)
  window.addEventListener('keyup', onRoamKeyUp, true)
  window.addEventListener('blur', onRoamWindowBlur)
}

function detachRoamWindowListeners() {
  window.removeEventListener('keydown', onRoamKeyDown, true)
  window.removeEventListener('keyup', onRoamKeyUp, true)
  window.removeEventListener('blur', onRoamWindowBlur)
}

function stopFreeRoamLoopAndListeners() {
  roamKeysDown.clear()
  roamLastTs = 0
  if (roamRafId) {
    cancelAnimationFrame(roamRafId)
    roamRafId = 0
  }
  detachRoamWindowListeners()
  detachRoamLookCanvasListeners()
  destroyRoamNipples()
  try {
    document.exitPointerLock()
  } catch {
    /* ignore */
  }
}

async function exitFreeRoamMode() {
  if (!freeRoamActive.value) return
  freeRoamActive.value = false
  stopFreeRoamLoopAndListeners()

  if (worldRef?.camera.hasCameraControls()) {
    const cam = worldRef.camera.three
    const c = worldRef.camera.controls
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    const target = cam.position.clone().add(fwd)
    try {
      await c.setLookAt(
        cam.position.x,
        cam.position.y,
        cam.position.z,
        target.x,
        target.y,
        target.z,
        false
      )
    } catch {
      /* ignore */
    }
    worldRef.camera.set('Orbit')
    navModeId.value = 'Orbit'
    c.enabled = true
    applyOrbitPointerBindings()
  }
}

async function toggleFreeRoamMode() {
  if (freeRoamActive.value) {
    await exitFreeRoamMode()
    return
  }
  if (!worldRef?.camera.hasCameraControls()) return

  orbitPanPrimary.value = false
  worldRef.camera.set('Orbit')
  navModeId.value = 'Orbit'

  const c = worldRef.camera.controls
  c.enabled = false
  c.mouseButtons.left = CameraControls.ACTION.NONE
  c.mouseButtons.middle = CameraControls.ACTION.NONE
  c.mouseButtons.right = CameraControls.ACTION.NONE
  c.mouseButtons.wheel = CameraControls.ACTION.NONE
  c.touches.one = CameraControls.ACTION.NONE
  c.touches.two = CameraControls.ACTION.NONE
  c.touches.three = CameraControls.ACTION.NONE

  syncRoamYawPitchFromCamera()
  freeRoamActive.value = true
  attachRoamWindowListeners()
  roamLastTs = 0
  roamRafId = requestAnimationFrame(roamFrame)

  await nextTick()
  attachRoamLookCanvasListeners()
}

watch([freeRoamActive, showRoamVirtualSticks], () => {
  syncHighlighterAutoClickForRoam()
  if (!freeRoamActive.value) {
    destroyRoamNipples()
    return
  }
  void nextTick(() => {
    if (showRoamVirtualSticks.value) {
      setupRoamNipples()
      detachRoamLookCanvasListeners()
    } else {
      destroyRoamNipples()
      attachRoamLookCanvasListeners()
    }
  })
})

const floorsEmptyHint = computed(
  () =>
    storeyNames.value.length === 0 &&
    '此模型未偵測到 IfcBuildingStorey 樓層資訊，無法使用樓層篩選（不影響檢視）。'
)

/** web-ifc 需要 wasm 檔所在「目錄」的絕對 URL（結尾 /） */
const wasmBasePath = computed(() => {
  try {
    const full = new URL(webIfcWasmUrl, import.meta.url).href
    let dir = full.replace(/[^/]+\.wasm(\?.*)?$/i, '')
    if (!dir.endsWith('/')) dir += '/'
    return dir
  } catch {
    let dir = webIfcWasmUrl.replace(/[^/]+\.wasm(\?.*)?$/i, '')
    if (!dir.endsWith('/')) dir += '/'
    return dir
  }
})

function isItemAttribute(v: unknown): v is ItemAttribute {
  return !!v && typeof v === 'object' && !Array.isArray(v) && 'value' in v
}

/** 常見 IFC 字串：Latin-1 位元組被誤當 UTF-16 時，嘗試還原 UTF-8 */
function fixIfcText(s: string): string {
  if (!s || typeof s !== 'string') return s
  try {
    const bytes = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    if (/[\u4e00-\u9fff]/.test(decoded) && !/[\u4e00-\u9fff]/.test(s)) return decoded
    if (decoded.length && decoded !== s && !/[\ufffd]/.test(decoded)) return decoded
  } catch {
    /* ignore */
  }
  return s
}

function formatAttrValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') return fixIfcText(v)
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function flattenItemData(
  data: ItemData,
  category: string,
  out: { category: string; name: string; value: string }[]
) {
  for (const [key, val] of Object.entries(data)) {
    const name = fixIfcText(key)
    if (isItemAttribute(val)) {
      out.push({ category: category || '屬性', name, value: formatAttrValue(val.value) })
    } else if (Array.isArray(val)) {
      const nextCat = category ? `${category} › ${name}` : name
      for (const el of val) {
        if (el && typeof el === 'object') flattenItemData(el as ItemData, nextCat, out)
      }
    }
  }
}

function buildPropertySectionsFromData(record: Record<string, ItemData[]>): PropertySection[] {
  const flat: { category: string; name: string; value: string }[] = []
  for (const [, items] of Object.entries(record)) {
    for (const item of items) {
      flattenItemData(item, '', flat)
    }
  }
  if (flat.length === 0) {
    return [{ id: 'empty', title: '屬性', rows: [{ name: '—', value: '無可用屬性資料' }] }]
  }
  const byCat = new Map<string, PropertyRow[]>()
  for (const row of flat) {
    const list = byCat.get(row.category) ?? []
    list.push({ name: row.name, value: row.value })
    byCat.set(row.category, list)
  }
  const sections: PropertySection[] = []
  let i = 0
  for (const [title, rows] of byCat) {
    sections.push({ id: `sec-${i++}`, title: fixIfcText(title), rows })
  }
  return sections
}

function applyCanvasTouchNone() {
  const root = containerRef.value
  if (!root) return
  root.querySelectorAll('canvas').forEach((c) => {
    const el = c as HTMLElement
    el.style.touchAction = 'none'
  })
}

function updateSceneYRange() {
  const box = new THREE.Box3()
  if (worldRef) {
    for (const mesh of worldRef.meshes) {
      box.expandByObject(mesh)
    }
  }
  if (!box.isEmpty()) {
    sceneYRange.value = { min: box.min.y, max: box.max.y }
  } else {
    sceneYRange.value = null
  }
}

function resizeRenderer() {
  const el = containerRef.value
  if (!el || !worldRef?.renderer) return
  const w = el.clientWidth
  const h = el.clientHeight
  if (w <= 0 || h <= 0) return
  worldRef.renderer.resize(new THREE.Vector2(w, h))
  applyCanvasTouchNone()
}

async function refreshStoreyData() {
  const components = componentsRef.value
  if (!components) return
  const classifier = components.get(OBC.Classifier)
  try {
    await classifier.byIfcBuildingStorey()
    const groups = classifier.list.get(STOREYS_CLASS)
    const names: string[] = []
    if (groups) {
      for (const name of groups.keys()) {
        names.push(name)
        if (storeyVisible[name] === undefined) {
          storeyVisible[name] = true
        }
      }
    }
    storeyNames.value = names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    for (const k of Object.keys(storeyVisible)) {
      if (!storeyNames.value.includes(k)) delete storeyVisible[k]
    }
    await applyStoreyHiderFromChecks()
  } catch {
    storeyNames.value = []
  }
}

async function loadPropertySections(sel: OBC.ModelIdMap) {
  const obc = componentsRef.value
  if (!obc) return
  propertiesLoading.value = true
  try {
    const fragments = obc.get(OBC.FragmentsManager)
    const raw = await fragments.getData(sel)
    propertySections.value = buildPropertySectionsFromData(raw)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    propertySections.value = [
      {
        id: 'err',
        title: '讀取失敗',
        rows: [{ name: '錯誤', value: msg }],
      },
    ]
  } finally {
    propertiesLoading.value = false
  }
}

function syncHighlightToProperties() {
  const obc = componentsRef.value
  if (!obc) return
  const hl = obc.get(OBCF.Highlighter)
  const sel = hl.selection[SELECT_NAME]
  const has = !!(sel && Object.keys(sel).length > 0)
  hasPropertySelection.value = has
  if (!has) {
    propertySections.value = []
    showPropertiesPanel.value = false
    return
  }
  showPropertiesPanel.value = true
  void loadPropertySections(sel)
}

function syncLoadedModelRows() {
  const c = componentsRef.value
  if (!c) {
    loadedModelRows.value = []
    return
  }
  const fr = c.get(OBC.FragmentsManager)
  loadedModelRows.value = [...fr.list.keys()].map((id) => ({
    id,
    label: fragModelLabels[id] ?? id,
  }))
}

async function disposeAllFragmentModels() {
  const c = componentsRef.value
  if (!c || !worldRef) return
  const fragments = c.get(OBC.FragmentsManager)
  const hl = c.get(OBCF.Highlighter)
  await hl.clear(SELECT_NAME).catch(() => {})

  const ids = [...fragments.list.keys()]
  for (const id of ids) {
    const model = fragments.list.get(id)
    if (model && worldRef) {
      worldRef.scene.three.remove(model.object)
    }
    await fragments.core
      .disposeModel(id)
      .catch((e) => console.warn('[IfcViewer] disposeModel', id, e))
  }

  for (const k of Object.keys(fragModelLabels)) {
    delete fragModelLabels[k]
  }
  syncLoadedModelRows()

  horizontalSectionActive.value = false
  horizontalSectionPlaneId.value = null
  c.get(OBC.Clipper).deleteAll()
  storeyNames.value = []
  for (const k of Object.keys(storeyVisible)) {
    delete storeyVisible[k]
  }
  propertySections.value = []
  hasPropertySelection.value = false
  showPropertiesPanel.value = false
  updateSceneYRange()
  void fragments.core.update(true)
}

type ViewerWorld = OBC.SimpleWorld<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBCF.PostproductionRenderer
>

function setupViewerExtensions(components: OBC.Components, w: ViewerWorld) {
  if (!bimUiInitialized) {
    BUI.Manager.init()
    BUIC.Manager.init()
    bimUiInitialized = true
  }

  const clipper = components.get(OBC.Clipper)
  clipper.setup()
  clipper.orthogonalY = true

  const clipStyler = components.get(OBCF.ClipStyler)
  clipStyler.world = w

  clipperOnAfterCreate = (plane: OBC.SimplePlane) => {
    const cp = componentsRef.value?.get(OBC.Clipper)
    if (!cp) return
    const id = cp.list.getKey(plane)
    if (!id) return
    try {
      clipStyler.createFromClipping(id, { link: true, world: w })
    } catch (e) {
      console.warn('[IfcViewer] ClipStyler.createFromClipping', e)
    }
  }
  clipper.onAfterCreate.add(clipperOnAfterCreate)

  const highlighter = components.get(OBCF.Highlighter)
  highlighter.setup({
    selectName: SELECT_NAME,
    selectEnabled: true,
    autoHighlightOnClick: true,
    world: w,
    selectionColor: new THREE.Color(0xff9933),
    selectMaterialDefinition: {
      color: new THREE.Color(1, 0.58, 0.12),
      opacity: 0.5,
      transparent: true,
      renderedFaces: FRAGS.RenderedFaces.TWO,
    },
    autoUpdateFragments: true,
  })

  highlighterOnHighlight = () => syncHighlightToProperties()
  highlighterOnClear = () => {
    propertySections.value = []
    hasPropertySelection.value = false
    showPropertiesPanel.value = false
  }
  highlighter.events[SELECT_NAME].onHighlight.add(highlighterOnHighlight)
  highlighter.events[SELECT_NAME].onClear.add(highlighterOnClear)
}

async function initViewer() {
  const container = containerRef.value
  if (!container) return

  error.value = ''
  status.value = 'Initializing viewer…'

  const components = new OBC.Components()
  componentsRef.value = components
  const worlds = components.get(OBC.Worlds)
  const w = worlds.create<
    OBC.SimpleScene,
    OBC.OrthoPerspectiveCamera,
    OBCF.PostproductionRenderer
  >()

  w.scene = new OBC.SimpleScene(components)
  w.scene.setup()
  w.scene.three.background = null

  w.renderer = new OBCF.PostproductionRenderer(components, container)
  w.camera = new OBC.OrthoPerspectiveCamera(components)

  await w.camera.controls.setLookAt(78, 20, -2.2, 26, -4, 25)

  const fragments = components.get(OBC.FragmentsManager)
  fragments.init(fragmentsWorkerUrl)

  onModelLoaded = ({ value: model }) => {
    model.useCamera(w.camera.three)
    w.scene.three.add(model.object)
    void fragments.core.update(true)
    void refreshStoreyData()
    updateSceneYRange()
    syncLoadedModelRows()
    nextTick(() => applyCanvasTouchNone())
  }
  fragments.list.onItemSet.add(onModelLoaded)

  onMaterialSet = ({ value: material }) => {
    const m = material as THREE.Material & { isLodMaterial?: boolean }
    if (!('isLodMaterial' in m && m.isLodMaterial)) {
      m.polygonOffset = true
      m.polygonOffsetUnits = 1
      m.polygonOffsetFactor = Math.random()
    }
  }
  fragments.core.models.materials.list.onItemSet.add(onMaterialSet)

  if (w.camera.hasCameraControls()) {
    applyViewerCameraControlParams(w.camera.controls)
    onControlsUpdate = () => {
      void fragments.core.update()
    }
    w.camera.controls.addEventListener('update', onControlsUpdate)
  }

  const ifcLoader = components.get(OBC.IfcLoader)
  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: {
      path: wasmBasePath.value,
      absolute: true,
    },
  })

  components.init()

  worldRef = w

  resizeObserver = new ResizeObserver(() => resizeRenderer())
  resizeObserver.observe(container)
  resizeRenderer()

  setupViewerExtensions(components, w)
  updateSceneYRange()
  await nextTick()
  applyCanvasTouchNone()

  try {
    navModeId.value = w.camera.mode.id
  } catch {
    navModeId.value = 'Orbit'
  }
  orbitPanPrimary.value = false
  if (w.camera.hasCameraControls() && navModeId.value === 'Orbit') {
    applyOrbitPointerBindings()
  }
  viewerCanvasReady.value = true

  status.value = 'Ready — load .ifc / .frag or use sample buttons.'
}

function teardownExtensionListeners() {
  const components = componentsRef.value
  if (components) {
    const hl = components.get(OBCF.Highlighter)
    if (highlighterOnHighlight) {
      hl.events[SELECT_NAME].onHighlight.remove(highlighterOnHighlight)
    }
    if (highlighterOnClear) {
      hl.events[SELECT_NAME].onClear.remove(highlighterOnClear)
    }
    const cp = components.get(OBC.Clipper)
    if (clipperOnAfterCreate) {
      cp.onAfterCreate.remove(clipperOnAfterCreate)
    }
  }
  highlighterOnHighlight = null
  highlighterOnClear = null
  clipperOnAfterCreate = null
}

onUnmounted(() => {
  if (freeRoamActive.value) {
    freeRoamActive.value = false
    stopFreeRoamLoopAndListeners()
  }
  viewerCanvasReady.value = false
  resizeObserver?.disconnect()
  resizeObserver = null

  if (componentsRef.value && worldRef) {
    const fragments = componentsRef.value.get(OBC.FragmentsManager)
    if (onModelLoaded) fragments.list.onItemSet.remove(onModelLoaded)
    if (onMaterialSet) fragments.core.models.materials.list.onItemSet.remove(onMaterialSet)
    if (onControlsUpdate && worldRef.camera.hasCameraControls()) {
      worldRef.camera.controls.removeEventListener('update', onControlsUpdate)
    }
  }

  teardownExtensionListeners()

  onModelLoaded = null
  onMaterialSet = null
  onControlsUpdate = null
  worldRef = null

  componentsRef.value?.dispose()
  componentsRef.value = null
})

onMounted(() => {
  void initViewer().catch((e) => {
    error.value = e instanceof Error ? e.message : String(e)
    status.value = ''
  })
})

watch(sectionHeightT, () => {
  if (horizontalSectionActive.value && horizontalSectionPlaneId.value) {
    applyHorizontalClipAtCurrentT()
  }
})

function randomIdSegment(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    c.getRandomValues(bytes)
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function nextModelId(prefix: string) {
  return `${prefix}-${randomIdSegment()}`
}

function yFromSectionT(): number {
  const r = sceneYRange.value
  if (!r || r.max <= r.min) return 0
  return r.min + sectionHeightT.value * (r.max - r.min)
}

function applyHorizontalClipAtCurrentT() {
  const components = componentsRef.value
  if (!components || !worldRef) return
  const id = horizontalSectionPlaneId.value
  if (!id) return
  const clipper = components.get(OBC.Clipper)
  const plane = clipper.list.get(id)
  if (!plane) return
  const y = yFromSectionT()
  const normal = new THREE.Vector3(0, -1, 0)
  const point = new THREE.Vector3(0, y, 0)
  plane.setFromNormalAndCoplanarPoint(normal, point)
  plane.update()
  void components.get(OBC.FragmentsManager).core.update(true)
}

async function loadIfcFile(file: File) {
  const components = componentsRef.value
  if (!components || !worldRef) return
  loading.value = true
  loadingIfc.value = true
  ifcProgressPercent.value = 0
  error.value = ''
  status.value = `Loading IFC: ${file.name}…`
  let ifcModelId: string | null = null
  try {
    await disposeAllFragmentModels()
    const buf = new Uint8Array(await file.arrayBuffer())
    const ifcLoader = components.get(OBC.IfcLoader)
    ifcModelId = nextModelId('ifc')
    fragModelLabels[ifcModelId] = file.name
    await ifcLoader.load(buf, true, ifcModelId, {
      processData: {
        progressCallback: (p) => {
          const pct =
            typeof p === 'number' ? Math.round(Math.min(100, Math.max(0, p <= 1 ? p * 100 : p))) : 0
          ifcProgressPercent.value = pct
        },
      },
    })
    status.value = `Loaded IFC: ${file.name}`
    syncLoadedModelRows()
  } catch (e) {
    if (ifcModelId) delete fragModelLabels[ifcModelId]
    error.value = `IFC 載入失敗：${e instanceof Error ? e.message : String(e)}`
    status.value = ''
  } finally {
    loading.value = false
    loadingIfc.value = false
    ifcProgressPercent.value = 0
  }
}

type FragLoadCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera

function viewerCameraForFragLoad(): FragLoadCamera {
  return worldRef!.camera.three as FragLoadCamera
}

async function loadFragPayload(
  viewerRoot: OBC.Components,
  payload: Uint8Array,
  modelId: string,
  camera: FragLoadCamera
) {
  const fragments = viewerRoot.get(OBC.FragmentsManager)
  await fragments.core.load(payload, { modelId, camera })
}

async function loadFragBuffer(buffer: ArrayBuffer, label: string, replaceScene: boolean) {
  const viewerRoot = componentsRef.value
  if (!viewerRoot || !worldRef) return
  loading.value = true
  error.value = ''
  status.value = `Loading fragments: ${label}…`
  let modelId: string | null = null
  try {
    if (replaceScene) await disposeAllFragmentModels()
    modelId = nextModelId('frag')
    fragModelLabels[modelId] = label
    await loadFragPayload(viewerRoot, new Uint8Array(buffer), modelId, viewerCameraForFragLoad())
    status.value = replaceScene ? `Loaded: ${label}` : `已加入模型：${label}`
    syncLoadedModelRows()
  } catch (e) {
    if (modelId) delete fragModelLabels[modelId]
    error.value = `FRAG 載入失敗：${e instanceof Error ? e.message : String(e)}`
    status.value = ''
  } finally {
    loading.value = false
  }
}

async function disposeFragmentModel(modelId: string) {
  const c = componentsRef.value
  if (!c || !worldRef) return
  const fragments = c.get(OBC.FragmentsManager)
  const model = fragments.list.get(modelId)
  if (!model) return
  const hl = c.get(OBCF.Highlighter)
  await hl.clear(SELECT_NAME).catch(() => {})
  worldRef.scene.three.remove(model.object)
  await fragments.core
    .disposeModel(modelId)
    .catch((e) => console.warn('[IfcViewer] disposeModel', modelId, e))
  delete fragModelLabels[modelId]
  syncLoadedModelRows()
  void refreshStoreyData()
  updateSceneYRange()
  void fragments.core.update(true)
}

async function loadExampleFrag(url: string, label: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${label}`)
  const buffer = await res.arrayBuffer()
  /** 範例可連續載入多個模型，供剖切／多模型測試 */
  await loadFragBuffer(buffer, label, false)
}

function onIfcInputChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void loadIfcFile(file)
}

async function onFragInputChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  if (files.length === 0) return
  const viewerRoot = componentsRef.value
  if (!viewerRoot || !worldRef) return
  loading.value = true
  error.value = ''
  try {
    if (clearFragSceneBeforeLoad.value) {
      await disposeAllFragmentModels()
    }
    const n = files.length
    for (let i = 0; i < n; i++) {
      const file = files[i]!
      status.value = `載入 FRAG (${i + 1}/${n})：${file.name}…`
      const modelId = nextModelId('frag')
      fragModelLabels[modelId] = file.name
      try {
        await loadFragPayload(
          viewerRoot,
          new Uint8Array(await file.arrayBuffer()),
          modelId,
          viewerCameraForFragLoad()
        )
      } catch (e) {
        delete fragModelLabels[modelId]
        throw e
      }
    }
    status.value = n === 1 ? `已加入：${files[0]!.name}` : `已加入 ${n} 個 FRAG 模型`
    syncLoadedModelRows()
    updateSceneYRange()
    void viewerRoot.get(OBC.FragmentsManager).core.update(true)
    void refreshStoreyData()
  } catch (e) {
    error.value = `FRAG 載入失敗：${e instanceof Error ? e.message : String(e)}`
    status.value = ''
  } finally {
    loading.value = false
  }
}

function onSampleArq() {
  void loadExampleFrag(EXAMPLE_FRAG_ARQ, 'school_arq.frag').catch(
    (e) => (error.value = e instanceof Error ? e.message : String(e))
  )
}

function onSampleStr() {
  void loadExampleFrag(EXAMPLE_FRAG_STR, 'school_str.frag').catch(
    (e) => (error.value = e instanceof Error ? e.message : String(e))
  )
}

async function applyStoreyHiderFromChecks() {
  const components = componentsRef.value
  if (!components) return
  const classifier = components.get(OBC.Classifier)
  const hider = components.get(OBC.Hider)
  const fragments = components.get(OBC.FragmentsManager)
  for (const n of storeyNames.value) {
    const data = classifier.getGroupData(STOREYS_CLASS, n)
    const map = await data.get()
    const show = storeyVisible[n] !== false
    await hider.set(show, map)
  }
  await fragments.core.update(true)
}

async function onStoreyCheckChange(name: string, checked: boolean) {
  storeyVisible[name] = checked
  await applyStoreyHiderFromChecks()
}

async function showAllStoreys() {
  for (const n of storeyNames.value) {
    storeyVisible[n] = true
  }
  await applyStoreyHiderFromChecks()
}

function clearAllClipsAndSection() {
  componentsRef.value?.get(OBC.Clipper).deleteAll()
  horizontalSectionActive.value = false
  horizontalSectionPlaneId.value = null
  void componentsRef.value?.get(OBC.FragmentsManager).core.update(true)
}

function enableHorizontalSection() {
  const components = componentsRef.value
  if (!components || !worldRef) return
  updateSceneYRange()
  if (!sceneYRange.value) return
  components.get(OBC.Clipper).deleteAll()
  horizontalSectionPlaneId.value = null
  const clipper = components.get(OBC.Clipper)
  const y = yFromSectionT()
  const id = clipper.createFromNormalAndCoplanarPoint(
    worldRef,
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, y, 0)
  )
  horizontalSectionPlaneId.value = id
  horizontalSectionActive.value = true
  void components.get(OBC.FragmentsManager).core.update(true)
}

function onSectionToggle(active: boolean) {
  if (active) {
    enableHorizontalSection()
  } else {
    clearAllClipsAndSection()
    void componentsRef.value?.get(OBC.FragmentsManager).core.update(true)
  }
}

function onSectionSliderInput(ev: Event) {
  const t = Number((ev.target as HTMLInputElement).value)
  if (!Number.isFinite(t)) return
  sectionHeightT.value = t
}

async function resetCameraView() {
  if (!worldRef?.camera?.controls) return
  await worldRef.camera.controls.setLookAt(78, 20, -2.2, 26, -4, 25)
}

/**
 * camera-controls 參數：滾輪／距離／游標縮放／慣性。
 * - 單次滾輪最大幅度：函式庫未暴露獨立欄位，以較低 dollySpeed 與 min/maxDistance 側面限制。
 * - v3 已廢棄 dampingFactor（setter 僅 warn 無效）；以 smoothTime、draggingSmoothTime 達成緩衝。
 * - pinchSpeed：camera-controls@3.1.2 未讀取此屬性，雙指捏合仍走 dollySpeed；仍寫入以利日後版相容。
 */
function applyViewerCameraControlParams(c: CameraControls) {
  /** 略降靈敏度，避免滾輪 zoom out 單次幅度過大、模型一下飄出畫面 */
  c.dollySpeed = 0.22
  c.minDistance = 1
  c.maxDistance = 500
  c.dollyToCursor = true
  /** 慣性緩衝（v3 無 dampingFactor setter）；拖曳軌跡用 draggingSmoothTime */
  c.smoothTime = 0.28
  c.draggingSmoothTime = 0.1
  const withPinch = c as CameraControls & { pinchSpeed?: number }
  withPinch.pinchSpeed = 0.3
}

function getSceneBoundingInfo() {
  const box = new THREE.Box3()
  if (worldRef) {
    for (const mesh of worldRef.meshes) {
      box.expandByObject(mesh)
    }
  }
  const center = new THREE.Vector3(0, 5, 0)
  const size = new THREE.Vector3(50, 50, 50)
  if (!box.isEmpty()) {
    box.getCenter(center)
    box.getSize(size)
  }
  const dist = Math.max(size.x, size.y, size.z, 1) * 1.8
  return { center, size, dist }
}

function applyOrbitPointerBindings() {
  if (!worldRef?.camera.hasCameraControls()) return
  const c = worldRef.camera.controls
  const camThree = worldRef.camera.three
  const isPerspective = camThree instanceof THREE.PerspectiveCamera
  /** 漫遊結束時曾將 wheel／中鍵／右鍵／雙指設為 NONE，僅還原 left／touch.one 會導致環繞無法滾輪縮放 */
  c.mouseButtons.middle = CameraControls.ACTION.DOLLY
  c.mouseButtons.right = CameraControls.ACTION.TRUCK
  c.mouseButtons.wheel = isPerspective ? CameraControls.ACTION.DOLLY : CameraControls.ACTION.ZOOM
  c.touches.two = isPerspective
    ? CameraControls.ACTION.TOUCH_DOLLY_TRUCK
    : CameraControls.ACTION.TOUCH_ZOOM_TRUCK
  c.touches.three = CameraControls.ACTION.TOUCH_TRUCK
  if (orbitPanPrimary.value) {
    c.mouseButtons.left = CameraControls.ACTION.TRUCK
    c.touches.one = CameraControls.ACTION.TOUCH_TRUCK
  } else {
    c.mouseButtons.left = CameraControls.ACTION.ROTATE
    c.touches.one = CameraControls.ACTION.TOUCH_ROTATE
  }
}

async function setCameraNav(mode: 'Orbit' | 'Plan' | 'FirstPerson') {
  if (freeRoamActive.value) await exitFreeRoamMode()
  if (!worldRef) return
  worldRef.camera.set(mode)
  navModeId.value = worldRef.camera.mode.id
  orbitPanPrimary.value = false
  if (mode === 'Orbit') {
    applyOrbitPointerBindings()
  }
}

async function toggleOrbitPanPrimary() {
  if (!worldRef) return
  if (freeRoamActive.value) await exitFreeRoamMode()
  if (navModeId.value !== 'Orbit') {
    worldRef.camera.set('Orbit')
    navModeId.value = 'Orbit'
  }
  orbitPanPrimary.value = !orbitPanPrimary.value
  applyOrbitPointerBindings()
}

async function fitCameraToScene() {
  if (!worldRef?.camera) return
  try {
    await worldRef.camera.fit(worldRef.meshes, 0.15)
  } catch {
    /* ignore */
  }
}

async function setViewPreset(preset: 'top' | 'front' | 'right' | 'iso' | 'reset') {
  if (!worldRef?.camera?.controls) return
  if (preset === 'reset') {
    await resetCameraView()
    return
  }
  const { center, dist } = getSceneBoundingInfo()
  const d = dist
  switch (preset) {
    case 'top':
      await worldRef.camera.controls.setLookAt(
        center.x,
        center.y + d,
        center.z,
        center.x,
        center.y,
        center.z
      )
      break
    case 'front':
      await worldRef.camera.controls.setLookAt(
        center.x,
        center.y,
        center.z + d,
        center.x,
        center.y,
        center.z
      )
      break
    case 'right':
      await worldRef.camera.controls.setLookAt(
        center.x + d,
        center.y,
        center.z,
        center.x,
        center.y,
        center.z
      )
      break
    case 'iso':
      await worldRef.camera.controls.setLookAt(
        center.x + d * 0.75,
        center.y + d * 0.55,
        center.z + d * 0.75,
        center.x,
        center.y,
        center.z
      )
      break
    default:
      break
  }
}

function triggerIfcPicker() {
  ifcFileInputRef.value?.click()
}

function triggerFragPicker() {
  fragFileInputRef.value?.click()
}

function toggleFullscreen() {
  const el = viewerShellRef.value
  if (!el) return
  if (!document.fullscreenElement) {
    void el.requestFullscreen()
  } else {
    void document.exitFullscreen()
  }
}

function closePropertiesPanel() {
  showPropertiesPanel.value = false
}

function openPropertiesPanel() {
  if (hasPropertySelection.value) showPropertiesPanel.value = true
}
</script>

<template>
  <div
    ref="viewerShellRef"
    class="text-foreground flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background"
  >
    <div
      v-show="showLoadDock"
      class="border-border bg-card flex max-h-[32%] min-h-0 shrink-0 flex-col gap-2 border-b px-3 py-2 sm:max-h-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
    >
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <Label class="text-muted-foreground shrink-0 text-xs">IFC</Label>
        <input
          ref="ifcFileInputRef"
          type="file"
          accept=".ifc"
          class="text-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-background file:px-2 file:py-1.5 file:text-sm"
          :disabled="loading"
          @change="onIfcInputChange"
        />
      </div>
      <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <Label class="text-muted-foreground shrink-0 text-xs">FRAG</Label>
          <input
            ref="fragFileInputRef"
            type="file"
            multiple
            accept=".frag"
            class="text-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-background file:px-2 file:py-1.5 file:text-sm"
            :disabled="loading"
            @change="onFragInputChange"
          />
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <Checkbox
              id="ifcviewer-frag-clear-before"
              :checked="clearFragSceneBeforeLoad"
              @update:checked="(c) => (clearFragSceneBeforeLoad = c === true)"
            />
            <Label
              for="ifcviewer-frag-clear-before"
              class="text-muted-foreground cursor-pointer text-xs font-normal"
            >
              載入前清空場景
            </Label>
          </div>
          <p class="text-muted-foreground text-xs">可複選多個 .frag。</p>
        </div>
      </div>
      <div
        v-if="loadedModelRows.length > 0"
        class="border-border bg-muted/30 w-full rounded-md border px-2 py-2"
      >
        <div
          class="text-muted-foreground mb-2 flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <span>已載入模型（{{ loadedModelRows.length }}）</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            class="h-7 text-xs"
            :disabled="loading"
            @click="void disposeAllFragmentModels()"
          >
            清空全部
          </Button>
        </div>
        <ul class="max-h-28 space-y-1 overflow-y-auto text-xs">
          <li
            v-for="row in loadedModelRows"
            :key="row.id"
            class="flex items-center justify-between gap-2 rounded-sm px-1 py-0.5"
          >
            <span class="text-foreground min-w-0 truncate" :title="row.label">{{ row.label }}</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              class="text-muted-foreground size-7 shrink-0"
              :disabled="loading"
              aria-label="移除此模型"
              @click="void disposeFragmentModel(row.id)"
            >
              <Trash2 class="size-3.5" />
            </Button>
          </li>
        </ul>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" :disabled="loading" @click="onSampleArq">
          Sample school_arq.frag
        </Button>
        <Button type="button" size="sm" variant="outline" :disabled="loading" @click="onSampleStr">
          Sample school_str.frag
        </Button>
      </div>
      <div v-if="loadingIfc" class="w-full sm:max-w-xs">
        <div class="text-muted-foreground mb-1 flex justify-between text-xs">
          <span>IFC 載入中</span>
          <span>{{ ifcProgressPercent }}%</span>
        </div>
        <div class="bg-muted h-2 w-full overflow-hidden rounded-full">
          <div
            class="bg-primary h-full transition-[width] duration-150 ease-out"
            :style="{ width: `${ifcProgressPercent}%` }"
          />
        </div>
      </div>
      <p v-if="status" class="text-muted-foreground w-full text-xs sm:ml-auto sm:w-auto">
        {{ status }}
      </p>
      <p v-if="error" class="text-destructive w-full text-xs sm:ml-auto sm:w-auto">{{ error }}</p>
    </div>

    <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
      <!-- 左側樓層（平板／桌面） -->
      <aside
        v-if="storeyNames.length > 0"
        class="border-border bg-card hidden w-52 shrink-0 flex-col border-b md:flex md:border-b-0 md:border-r"
      >
        <div class="border-border border-b px-3 py-2">
          <span class="text-sm font-medium">樓層</span>
          <p class="text-muted-foreground mt-0.5 text-xs">勾選要顯示的樓層，可複選。</p>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            class="mb-2 h-8 w-full"
            @click="void showAllStoreys()"
          >
            全部顯示
          </Button>
          <ul class="space-y-0.5">
            <li v-for="name in storeyNames" :key="name">
              <div class="hover:bg-muted/50 flex items-center gap-2 rounded-md px-1.5 py-1">
                <Checkbox
                  :id="`ifc-storey-${name}`"
                  class="size-3.5 shrink-0"
                  :checked="storeyVisible[name] !== false"
                  @update:checked="(c) => void onStoreyCheckChange(name, c === true)"
                />
                <Label
                  :for="`ifc-storey-${name}`"
                  class="text-foreground cursor-pointer truncate text-xs font-normal leading-snug"
                >
                  {{ name }}
                </Label>
              </div>
            </li>
          </ul>
        </div>
      </aside>

      <div class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          ref="containerRef"
          class="ifc-viewer-canvas-host min-h-0 min-w-0 flex-1"
          :class="freeRoamActive && !showRoamVirtualSticks ? 'cursor-none' : ''"
        />

        <!-- 桌面漫遊：螢幕中央準星（不攔截點擊） -->
        <div
          v-if="freeRoamActive && !showRoamVirtualSticks"
          class="pointer-events-none absolute inset-0 z-[20] flex items-center justify-center"
          aria-hidden="true"
        >
          <div class="relative size-5">
            <span
              class="bg-foreground/70 absolute left-1/2 top-0 block h-5 w-px -translate-x-1/2"
            />
            <span
              class="bg-foreground/70 absolute left-0 top-1/2 block h-px w-5 -translate-y-1/2"
            />
          </div>
        </div>

        <!-- 漫遊模式：手機雙搖桿（左移動、右視角） -->
        <div
          v-if="freeRoamActive && showRoamVirtualSticks"
          class="pointer-events-none absolute inset-0 z-[25] flex"
        >
          <div
            ref="roamStickMoveZoneRef"
            class="pointer-events-auto relative h-48 w-44 max-w-[42%] shrink-0 self-end"
            aria-hidden="true"
          />
          <div class="min-w-0 flex-1" />
          <div
            ref="roamStickLookZoneRef"
            class="pointer-events-auto relative h-48 w-44 max-w-[42%] shrink-0 self-end"
            aria-hidden="true"
          />
        </div>

        <div
          v-if="freeRoamActive"
          class="pointer-events-none absolute left-1/2 top-3 z-[25] flex max-w-[min(100%,24rem)] -translate-x-1/2 justify-center px-2"
        >
          <div
            class="border-border bg-card/95 text-foreground pointer-events-auto flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-md backdrop-blur-sm"
          >
            <span class="text-muted-foreground shrink-0 font-medium">漫遊</span>
            <div class="flex min-w-[9rem] flex-col gap-1">
              <Label for="ifcviewer-roam-speed" class="text-muted-foreground shrink-0 font-normal"
                >速度</Label
              >
              <input
                id="ifcviewer-roam-speed"
                v-model.number="freeRoamMoveSpeed"
                type="range"
                :min="ROAM_SPEED_MIN"
                :max="ROAM_SPEED_MAX"
                step="0.05"
                class="accent-primary h-2 w-full min-w-0 cursor-pointer"
              />
              <span class="text-muted-foreground tabular-nums"
                >{{ freeRoamMoveSpeed.toFixed(2) }}（Shift ×3）</span
              >
            </div>
            <span v-if="!showRoamVirtualSticks" class="text-muted-foreground min-w-0">
              左鍵點擊選準星處（拖曳＝轉向）· Shift 加選 · E 上升／Q 下降 · Shift 加速 · ESC 退出
            </span>
            <span v-else class="text-muted-foreground min-w-0"
              >左移動 · 右視角 · Shift 加速 · ESC 退出</span
            >
          </div>
        </div>

        <!-- 剖切：高度滑桿（作用於目前場景內所有模型） -->
        <div
          v-if="horizontalSectionActive && sceneYRange"
          class="border-border bg-card flex flex-col gap-2 border-t px-3 py-2"
        >
          <Label class="text-muted-foreground text-xs">剖切高度（水平）</Label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="sectionHeightT"
            class="accent-primary h-11 min-h-[44px] w-full cursor-pointer"
            :aria-valuetext="`${Math.round(sectionHeightT * 100)}%`"
            @input="onSectionSliderInput"
          />
        </div>

        <!-- 底部中央漂浮工具列（仿 BIM 檢視器島狀按鈕組） -->
        <div
          class="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-2"
          :class="
            horizontalSectionActive && sceneYRange
              ? 'bottom-[calc(7.25rem+env(safe-area-inset-bottom,0px))] md:bottom-[calc(7.5rem+env(safe-area-inset-bottom,0px))]'
              : 'bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]'
          "
        >
          <TooltipProvider :delay-duration="350">
            <div
              class="pointer-events-auto flex max-w-[min(100vw-1rem,56rem)] flex-wrap items-center justify-center gap-2"
            >
              <!-- 導覽與視角 -->
              <div
                class="border-border bg-card flex items-center gap-0.5 rounded-xl border p-1 shadow-lg"
              >
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      :disabled="!viewerCanvasReady"
                      class="relative size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                      :class="
                        navModeId === 'Orbit' && !orbitPanPrimary && !freeRoamActive
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : ''
                      "
                      aria-label="環繞模式"
                      @click="void setCameraNav('Orbit')"
                    >
                      <Rotate3d class="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">環繞（Orbit）：左鍵旋轉場景</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      :disabled="!viewerCanvasReady"
                      class="relative size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                      :class="orbitPanPrimary ? 'border-primary/50 bg-primary/10 text-primary' : ''"
                      aria-label="平移"
                      @click="void toggleOrbitPanPrimary()"
                    >
                      <Hand class="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top"
                    >平移：Orbit 下主按鈕改為拖曳平移；雙指亦可平移</TooltipContent
                  >
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      :disabled="!viewerCanvasReady"
                      class="relative size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                      :class="
                        navModeId === 'Plan' ? 'border-primary/50 bg-primary/10 text-primary' : ''
                      "
                      aria-label="平面導覽"
                      @click="void setCameraNav('Plan')"
                    >
                      <Move3d class="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">平面（2D）：樓層式平移與縮放</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      :disabled="!viewerCanvasReady"
                      class="relative size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                      :class="
                        navModeId === 'FirstPerson'
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : ''
                      "
                      aria-label="第一人稱導覽"
                      @click="void setCameraNav('FirstPerson')"
                    >
                      <Footprints class="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">第一人稱漫遊</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      :disabled="!viewerCanvasReady"
                      class="relative size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                      :class="freeRoamActive ? 'border-primary/50 bg-primary/10 text-primary' : ''"
                      aria-label="切換第一人稱漫遊"
                      @click="void toggleFreeRoamMode()"
                    >
                      <Gamepad2 class="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {{
                      freeRoamActive
                        ? '結束漫遊（恢復環繞）'
                        : '第一人稱漫遊（WASD、左鍵點準星選取／拖曳轉向、E/Q 升降；手機雙搖桿）'
                    }}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      :disabled="!viewerCanvasReady"
                      class="relative size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                      aria-label="符合視窗"
                      @click="fitCameraToScene"
                    >
                      <Expand class="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">符合視窗：將模型納入畫面</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span class="inline-flex">
                      <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            :disabled="!viewerCanvasReady"
                            class="relative size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                            aria-label="視角預設"
                          >
                            <Video class="size-5" />
                            <ChevronUp
                              class="text-muted-foreground pointer-events-none absolute right-0 top-0 size-2.5 opacity-60"
                              aria-hidden="true"
                            />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" class="w-44">
                          <DropdownMenuItem class="cursor-pointer" @click="setViewPreset('top')">
                            俯視
                          </DropdownMenuItem>
                          <DropdownMenuItem class="cursor-pointer" @click="setViewPreset('front')">
                            前視
                          </DropdownMenuItem>
                          <DropdownMenuItem class="cursor-pointer" @click="setViewPreset('right')">
                            右視
                          </DropdownMenuItem>
                          <DropdownMenuItem class="cursor-pointer" @click="setViewPreset('iso')">
                            等角
                          </DropdownMenuItem>
                          <DropdownMenuItem class="cursor-pointer" @click="setViewPreset('reset')">
                            重置為預設視角
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">視角預設</TooltipContent>
                </Tooltip>
              </div>

              <!-- 量測、剖切、載入 -->
              <div
                class="border-border bg-card flex items-center gap-0.5 rounded-xl border p-1 shadow-lg"
              >
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled
                      class="relative size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                      aria-label="量測"
                    >
                      <Ruler class="size-5" />
                      <ChevronUp
                        class="text-muted-foreground pointer-events-none absolute right-0 top-0 size-2.5 opacity-60"
                        aria-hidden="true"
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">量測工具（尚未開放）</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span class="inline-flex">
                      <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            class="relative size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                            :class="
                              horizontalSectionActive
                                ? 'border-primary/50 bg-primary/10 text-primary'
                                : ''
                            "
                            aria-label="剖切"
                          >
                            <Scissors class="size-5" />
                            <ChevronUp
                              class="text-muted-foreground pointer-events-none absolute right-0 top-0 size-2.5 opacity-60"
                              aria-hidden="true"
                            />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" class="w-48">
                          <DropdownMenuItem class="cursor-pointer" @click="showSectionPanel = true">
                            剖切設定…
                          </DropdownMenuItem>
                          <DropdownMenuItem class="cursor-pointer" @click="clearAllClipsAndSection">
                            關閉剖切
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">剖切（ClipEdges）</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      :disabled="loading"
                      class="size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                      aria-label="開啟檔案"
                      @click="triggerIfcPicker"
                    >
                      <FolderOpen class="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">開啟 IFC 檔（與頂部載入區相同）</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      :disabled="loading"
                      class="size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                      aria-label="開啟 FRAG"
                      @click="triggerFragPicker"
                    >
                      <Box class="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top"
                    >開啟 FRAG 檔（可複選，與頂部載入區相同）</TooltipContent
                  >
                </Tooltip>
              </div>

              <!-- 樓層、屬性、設定、全螢幕 -->
              <div
                class="border-border bg-card flex items-center gap-0.5 rounded-xl border p-1 shadow-lg"
              >
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                      aria-label="樓層"
                      @click="showFloorsPanel = true"
                    >
                      <Layers2 class="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">樓層（IfcBuildingStorey）</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      :disabled="!hasPropertySelection"
                      class="size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                      aria-label="屬性"
                      @click="openPropertiesPanel"
                    >
                      <SlidersHorizontal class="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">構件屬性</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                      :class="showLoadDock ? 'border-primary/50 bg-primary/10 text-primary' : ''"
                      aria-label="顯示載入區"
                      @click="showLoadDock = !showLoadDock"
                    >
                      <Settings class="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">顯示／隱藏頂部載入區與範例按鈕</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                      aria-label="全螢幕"
                      @click="toggleFullscreen"
                    >
                      <Maximize2 class="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">全螢幕</TooltipContent>
                </Tooltip>
              </div>

              <!-- 地圖（預留） -->
              <div
                class="border-border bg-card flex items-center gap-0.5 rounded-xl border p-1 shadow-lg"
              >
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled
                      class="size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                      aria-label="地圖定位"
                    >
                      <MapPinned class="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">GIS／地圖定位（尚未開放）</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>
        </div>
      </div>

      <!-- 屬性：小螢幕底部抽屜；md+ 固定右欄（選取時顯示） -->
      <aside
        v-show="showPropertiesPanel && hasPropertySelection"
        class="border-border bg-card fixed inset-x-0 bottom-0 z-40 flex max-h-[55vh] flex-col border-t md:static md:z-auto md:max-h-none md:w-[min(100%,22rem)] md:max-w-[100%] md:shrink-0 md:border-t-0 md:border-l"
      >
        <div
          class="border-border flex min-h-11 items-center justify-between gap-2 border-b px-3 py-2"
        >
          <span class="text-sm font-medium">IFC 屬性</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="h-11 w-11 shrink-0"
            aria-label="關閉屬性"
            @click="closePropertiesPanel"
          >
            <X class="size-5" />
          </Button>
        </div>
        <div class="text-foreground min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2 text-sm">
          <div v-if="propertiesLoading" class="text-muted-foreground flex justify-center py-8">
            載入屬性…
          </div>
          <template v-else>
            <details
              v-for="(sec, i) in propertySections"
              :key="sec.id"
              class="border-border mb-2 rounded-md border"
              :open="i === 0"
            >
              <summary
                class="text-foreground cursor-pointer list-none px-3 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden min-h-11 touch-manipulation"
              >
                {{ sec.title }}
              </summary>
              <dl class="border-border space-y-2 border-t px-3 py-2">
                <template v-for="row in sec.rows" :key="sec.id + row.name + row.value">
                  <div class="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-3">
                    <dt class="text-muted-foreground break-words text-xs">{{ row.name }}</dt>
                    <dd class="text-foreground break-all text-xs">{{ row.value }}</dd>
                  </div>
                </template>
              </dl>
            </details>
          </template>
        </div>
      </aside>
    </div>

    <!-- 手機樓層 -->
    <Teleport to="body">
      <div
        v-if="showFloorsPanel"
        class="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-3 sm:items-center md:hidden"
        role="dialog"
        aria-modal="true"
        @click.self="showFloorsPanel = false"
      >
        <div
          class="border-border bg-card flex max-h-[min(70dvh,28rem)] w-full max-w-md flex-col rounded-lg border shadow-lg"
          @click.stop
        >
          <div class="border-border flex items-center justify-between border-b px-4 py-3">
            <span class="text-foreground font-medium">樓層</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="h-11 w-11"
              aria-label="關閉"
              @click="showFloorsPanel = false"
            >
              <X class="size-5" />
            </Button>
          </div>
          <div v-if="storeyNames.length === 0" class="text-muted-foreground p-4 text-xs">
            {{ floorsEmptyHint }}
          </div>
          <div v-else class="flex max-h-[min(60dvh,22rem)] flex-col overflow-hidden p-3">
            <p class="text-muted-foreground mb-2 text-xs">勾選要顯示的樓層，可複選。</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              class="mb-2 h-9 w-full shrink-0"
              @click="void showAllStoreys()"
            >
              全部顯示
            </Button>
            <ul class="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
              <li v-for="name in storeyNames" :key="name">
                <div
                  class="hover:bg-muted/50 flex min-h-11 items-center gap-2 rounded-md px-2 py-1.5"
                >
                  <Checkbox
                    :id="`ifc-storey-mobile-${name}`"
                    class="size-4 shrink-0"
                    :checked="storeyVisible[name] !== false"
                    @update:checked="(c) => void onStoreyCheckChange(name, c === true)"
                  />
                  <Label
                    :for="`ifc-storey-mobile-${name}`"
                    class="text-foreground cursor-pointer flex-1 truncate text-sm font-normal"
                  >
                    {{ name }}
                  </Label>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 剖切設定（手機為底部 sheet） -->
    <Teleport to="body">
      <div
        v-if="showSectionPanel"
        class="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-3 sm:items-center"
        role="dialog"
        aria-modal="true"
        @click.self="showSectionPanel = false"
      >
        <div
          class="border-border bg-card w-full max-w-md rounded-lg border p-4 shadow-lg"
          @click.stop
        >
          <div class="mb-3 flex items-center justify-between">
            <span class="text-foreground font-medium">水平剖切</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="h-11 w-11"
              @click="showSectionPanel = false"
            >
              <X class="size-5" />
            </Button>
          </div>
          <p class="text-muted-foreground mb-3 text-xs">
            啟用後以滑桿調整高度；剖切套用於場景內所有已載入模型。
          </p>
          <label class="flex cursor-pointer items-center gap-3 py-2">
            <input
              type="checkbox"
              class="border-border accent-primary size-5 shrink-0 rounded"
              :checked="horizontalSectionActive"
              @change="onSectionToggle(($event.target as HTMLInputElement).checked)"
            />
            <span class="text-sm">啟用水平剖切</span>
          </label>
          <div v-if="horizontalSectionActive && sceneYRange" class="mt-3">
            <Label class="text-muted-foreground text-xs">高度</Label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="sectionHeightT"
              class="accent-primary mt-2 h-11 min-h-[44px] w-full"
              @input="onSectionSliderInput"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            class="mt-4 h-11 min-h-[44px] w-full"
            @click="clearAllClipsAndSection"
          >
            關閉剖切
          </Button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* 避免捲動手勢與軌道控制、pull-to-refresh 衝突 */
.ifc-viewer-canvas-host :deep(canvas) {
  touch-action: none;
}
</style>
