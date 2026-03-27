<script setup lang="ts">
import * as OBC from '@thatopen/components'
import * as OBCF from '@thatopen/components-front'
import * as BUI from '@thatopen/ui'
import * as BUIC from '@thatopen/ui-obc'
import type { BIMMaterial, FragmentsModel, ItemAttribute, ItemData } from '@thatopen/fragments'
import * as FRAGS from '@thatopen/fragments'
import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import fragmentsWorkerUrl from '@thatopen/fragments/worker?url'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  BoxSelect,
  Expand,
  Gamepad2,
  ChevronUp,
  Footprints,
  Hand,
  Maximize2,
  Move3d,
  Package,
  RectangleHorizontal,
  RectangleVertical,
  Rotate3d,
  SquareStack,
  Ruler,
  Scissors,
  Settings,
  SlidersHorizontal,
  Trash2,
  Video,
  X,
} from 'lucide-vue-next'
import { nextTick, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'

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
/** IFC 載入久無進度時的提示（非 throw 錯誤，避免使用者以為當機） */
const ifcLoadHint = ref('')

const loadFilesPopoverOpen = ref(false)
const loadFilesTab = ref<'ifc' | 'frag'>('ifc')
const showPropertiesPanel = ref(false)

const storeyNames = ref<string[]>([])
const storeyVisible = reactive<Record<string, boolean>>({})
/** 非 null 時僅顯示該樓層（點樓層名稱進入）；checkbox 會清除此狀態 */
const storeyIsolateName = ref<string | null>(null)

const STOREY_PANEL_EMPTY_MSG = '此模型無樓層資料'

const componentsRef = shallowRef<OBC.Components | null>(null)
let worldRef: OBC.SimpleWorld<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBCF.PostproductionRenderer
> | null = null

let resizeObserver: ResizeObserver | null = null
/** IfcLoader.setup 遠端 worker 的 blob URL，unmount 時 revoke */
let ifcLoaderWorkerBlobUrl: string | null = null
/** dev：renderer.onBeforeUpdate 除錯用，unmount 時 remove */
let rendererBeforeUpdateDebugHandler: (() => void) | null = null
let rendererDebugLogLastTs = 0
let onModelLoaded: ((data: { key: string; value: FragmentsModel }) => void) | null = null
let onMaterialSet: ((data: { key: number; value: BIMMaterial }) => void) | null = null
let onControlsUpdate: (() => void) | null = null
let fragmentsUpdateRafId = 0
let sboxHoverRaycaster: THREE.Raycaster | null = null

let clipperOnAfterCreate: ((plane: OBC.SimplePlane) => void) | null = null
let clipperOnAfterDrag: ((plane: OBC.SimplePlane) => void) | null = null
let clipperOnBeforeDragDecor: ((plane: OBC.SimplePlane) => void) | null = null

const CLIP_PLANE_HOVER_EDGES_NAME = 'clip-plane-hover-edges'
const clipPlaneRaycaster = new THREE.Raycaster()
const clipPlanePointerNdc = new THREE.Vector2()
let clipPlanePointerOverPlane = false
let clipPlaneDecorDragging = false
let clipPlaneLastClientX = 0
let clipPlaneLastClientY = 0
let clipPlanePointerInsideCanvas = false
let clipPlanePointerMoveHandler: ((ev: PointerEvent) => void) | null = null
let clipPlanePointerLeaveHandler: (() => void) | null = null
let activeSectionClipEdges: OBCF.ClipEdges | null = null

// ─── Section Box ───────────────────────────────────────────────
let sboxOutline: THREE.Box3Helper | null = null
let sboxGizmo: THREE.Group | null = null
let sboxFaceQuads: THREE.Mesh[] = []
/** 懸停高亮用的線框 mesh（6 個面各一） */
let sboxFaceEdges: THREE.LineSegments[] = []
/** Section Box：純 THREE.Plane，順序 px, nx, py, ny, pz, nz（不用 OBC Clipper） */
let sboxPlanes: THREE.Plane[] = []

interface SboxDragState {
  faceKey: string
  axis: 'x' | 'y' | 'z'
  dir: 1 | -1
  tKey: 'minX' | 'maxX' | 'minY' | 'maxY' | 'minZ' | 'maxZ'
  planeConstantAtStart: number
  clientXStart: number
  clientYStart: number
  /** 拖曳開始時裁切面在該軸上的世界座標（與 anchor 該軸一致） */
  dragStartAxisWorld: number
  /** pointerdown 時射線與鎖定拖曳平面的交點（用於相對位移，避免絕對 x/y/z 與游標不對齊時暴跳） */
  dragStartIntersectX: number
  dragStartIntersectY: number
  dragStartIntersectZ: number
  /** 拖曳開始時鎖定的射線求交平面（避免每幀隨盒子變形重算平面 → 回授抖動） */
  dragPlaneAnchorX: number
  dragPlaneAnchorY: number
  dragPlaneAnchorZ: number
  dragPlaneNx: number
  dragPlaneNy: number
  dragPlaneNz: number
}
let sboxDragState: SboxDragState | null = null
let sboxPointerDownHandler: ((e: PointerEvent) => void) | null = null
let sboxPointerMoveHandler: ((e: PointerEvent) => void) | null = null
let sboxPointerUpHandler: ((e: PointerEvent) => void) | null = null
let sboxHoverMoveHandler: ((e: PointerEvent) => void) | null = null
let sboxPointerLeaveHandler: (() => void) | null = null
let sboxActiveFaceKey: string | null = null
let sboxArrow: THREE.ArrowHelper | null = null
/** 與 applySboxArrowHoverVisual 同步，避免每幀重設材質 */
let sboxArrowHoverActive = false

/** Section box 拖曳除錯：Console 篩選 `[sbox]`；僅 dev，避免 production 洗版 */
function sboxDbg(...args: unknown[]) {
  if (import.meta.env.DEV) console.log('[sbox]', ...args)
}
let sboxDbgMoveLastTs = 0
function sboxDbgMoveThrottled(...args: unknown[]) {
  if (!import.meta.env.DEV) return
  const t = performance.now()
  if (t - sboxDbgMoveLastTs < 120) return
  sboxDbgMoveLastTs = t
  console.log('[sbox:move]', ...args)
}

/**
 * 射線與無限平面求交（允許 t 為負）。Three.js Ray.intersectPlane 在交點落在射線起點「後方」時回傳 null，
 * 拖曳 section box 面時容易與 assist 路徑交替，造成該軸座標暴跳（例如 nz 從 -31 跳到 -164）。
 */
function rayIntersectPlaneUnclamped(
  ray: THREE.Ray,
  plane: THREE.Plane,
  target: THREE.Vector3
): boolean {
  const denominator = plane.normal.dot(ray.direction)
  if (Math.abs(denominator) < 1e-10) return false
  const t = -(ray.origin.dot(plane.normal) + plane.constant) / denominator
  target.copy(ray.direction).multiplyScalar(t).add(ray.origin)
  return true
}
// ───────────────────────────────────────────────────────────────

let sectionClipLineMaterial: LineMaterial | null = null
const SECTION_CLIP_STYLE_ID = 'SectionCut'
let highlighterOnHighlight: (() => void) | null = null
let highlighterOnClear: (() => void) | null = null

const hasPropertySelection = ref(false)
const propertiesLoading = ref(false)

type PropertyRow = { name: string; value: string }
type PropertySection = { id: string; title: string; rows: PropertyRow[] }
const propertySections = ref<PropertySection[]>([])

type ClipMode = 'off' | 'x' | 'y' | 'z' | 'box'
const clipMode = ref<ClipMode>('off')
const axisCutPlaneId = ref<string | null>(null)

/** 拖曳時合併 pointermove → 每幀最多算一次射線與 moveSectionBoxFace */
let sboxDragMoveRaf = 0
let sboxDragPendingClientX = 0
let sboxDragPendingClientY = 0

const sectionBoxT = reactive({
  minX: 0.1,
  maxX: 0.9,
  minY: 0.05,
  maxY: 0.95,
  minZ: 0.1,
  maxZ: 0.9,
})

const axisCutTX = ref(0.5)
const axisCutTY = ref(0.5)
const axisCutTZ = ref(0.5)
const sceneXRange = ref<{ min: number; max: number } | null>(null)
const sceneYRange = ref<{ min: number; max: number } | null>(null)
const sceneZRange = ref<{ min: number; max: number } | null>(null)

const showLoadDock = ref(true)
const ifcFileInputRef = ref<HTMLInputElement | null>(null)
const fragFileInputRef = ref<HTMLInputElement | null>(null)
const clearFragSceneBeforeLoad = ref(false)
const fragModelLabels = reactive<Record<string, string>>({})
const loadedModelRows = ref<{ id: string; label: string }[]>([])
const navModeId = ref<string>('Orbit')
const orbitPanPrimary = ref(false)
const freeRoamActive = ref(false)
const freeRoamMoveSpeed = ref(14)
const roamStickMoveZoneRef = ref<HTMLElement | null>(null)
const roamStickLookZoneRef = ref<HTMLElement | null>(null)
const showRoamVirtualSticks = useMediaQuery('(pointer: coarse)')
const viewerCanvasReady = ref(false)

const ROAM_DRAG_LOOK_SENS = 0.0025
const ROAM_PITCH_LIMIT = 1.55
const ROAM_LOOK_STICK_SPEED = 2.2
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
  const stickColor = { front: 'var(--foreground)', back: 'var(--muted)' }
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
  let mx = 0,
    mz = 0
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
  if (roamKeysDown.has('KeyE')) my += 1
  if (roamKeysDown.has('KeyQ')) my -= 1
  if (my !== 0) cam.position.y += my * speed * dt
  const sx = roamMoveStick.x,
    sy = roamMoveStick.y
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
  if (
    ['ShiftLeft', 'ShiftRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(ev.code)
  ) {
    roamKeysDown.add(ev.code)
    if (ev.code !== 'ShiftLeft' && ev.code !== 'ShiftRight') ev.preventDefault()
  }
}

function onRoamKeyUp(ev: KeyboardEvent) {
  if (!freeRoamActive.value) return
  if (
    ['ShiftLeft', 'ShiftRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(ev.code)
  ) {
    roamKeysDown.delete(ev.code)
    if (ev.code !== 'ShiftLeft' && ev.code !== 'ShiftRight') ev.preventDefault()
  }
}

function onRoamLookPointerMove(ev: MouseEvent) {
  if (!freeRoamActive.value || showRoamVirtualSticks.value || !roamLookDragging) return
  const dx = ev.clientX - roamLookLastX,
    dy = ev.clientY - roamLookLastY
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
      if (dist <= ROAM_PICK_MOVE_THRESHOLD_PX) void performRoamCenterSelection(ev.shiftKey)
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
  hl.config.autoHighlightOnClick = !freeRoamActive.value
}

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
    const fragResult = await fragments.raycast({ camera, dom, mouse: centerMouse })
    if (!fragResult || fragResult.localId === undefined || fragResult.localId === null) {
      if (removePrevious) await hl.clear(SELECT_NAME).catch(() => {})
      return
    }
    const modelId = fragResult.fragments.modelId
    const modelIdMap: OBC.ModelIdMap = { [modelId]: new Set([fragResult.localId]) }
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

function isItemAttribute(v: unknown): v is ItemAttribute {
  return !!v && typeof v === 'object' && !Array.isArray(v) && 'value' in v
}

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
    for (const item of items) flattenItemData(item, '', flat)
  }
  if (flat.length === 0)
    return [{ id: 'empty', title: '屬性', rows: [{ name: '—', value: '無可用屬性資料' }] }]
  const byCat = new Map<string, PropertyRow[]>()
  for (const row of flat) {
    const list = byCat.get(row.category) ?? []
    list.push({ name: row.name, value: row.value })
    byCat.set(row.category, list)
  }
  const sections: PropertySection[] = []
  let i = 0
  for (const [title, rows] of byCat)
    sections.push({ id: `sec-${i++}`, title: fixIfcText(title), rows })
  return sections
}

function applyCanvasTouchNone() {
  const root = containerRef.value
  if (!root) return
  root.querySelectorAll('canvas').forEach((c) => {
    ;(c as HTMLElement).style.touchAction = 'none'
  })
}

function computeSceneBoundingBox(): THREE.Box3 | null {
  const box = new THREE.Box3()
  if (!worldRef) return null
  for (const mesh of worldRef.meshes) box.expandByObject(mesh)
  const components = componentsRef.value
  if (components) {
    try {
      const fragments = components.get(OBC.FragmentsManager)
      for (const id of fragments.list.keys()) {
        const obj = fragments.list.get(id)?.object
        if (obj) {
          obj.updateWorldMatrix(true, true)
          box.expandByObject(obj)
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (box.isEmpty() && worldRef.scene?.three) {
    worldRef.scene.three.updateWorldMatrix(true, true)
    const sceneBox = new THREE.Box3().setFromObject(worldRef.scene.three)
    if (!sceneBox.isEmpty()) box.copy(sceneBox)
  }
  if (box.isEmpty() && components) {
    try {
      const fr = components.get(OBC.FragmentsManager)
      if (fr.list.size > 0) {
        const wp = new THREE.Vector3()
        for (const id of fr.list.keys()) {
          const obj = fr.list.get(id)?.object
          if (obj) {
            obj.getWorldPosition(wp)
            const half = 25
            return new THREE.Box3(
              new THREE.Vector3(wp.x - half, wp.y - half, wp.z - half),
              new THREE.Vector3(wp.x + half, wp.y + half, wp.z + half)
            )
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
  return box.isEmpty() ? null : box
}

function updateSceneClipBoundingRanges() {
  const box = computeSceneBoundingBox()
  if (!box) {
    sceneXRange.value = null
    sceneYRange.value = null
    sceneZRange.value = null
    return
  }
  sceneXRange.value = { min: box.min.x, max: box.max.x }
  sceneYRange.value = { min: box.min.y, max: box.max.y }
  sceneZRange.value = { min: box.min.z, max: box.max.z }
}

function applyClipperPlaneGizmoSize() {
  const c = componentsRef.value
  if (!c) return
  const clipper = c.get(OBC.Clipper)
  clipper.autoScalePlanes = false
  const box = computeSceneBoundingBox()
  if (!box) {
    clipper.size = 40
    return
  }
  const size = new THREE.Vector3()
  box.getSize(size)
  const sx = Math.max(size.x, 1e-6),
    sy = Math.max(size.y, 1e-6),
    sz = Math.max(size.z, 1e-6)
  const maxSpan = Math.max(sx, sy, sz)
  const diagonal = Math.sqrt(sx * sx + sy * sy + sz * sz)
  clipper.size = Math.max(maxSpan * 1.22, diagonal * 0.75, 8)
}

const CLIP_PLANE_FILL_COLOR = 0xa855f7
const CLIP_PLANE_FILL_OPACITY = 0.16

function applyClipperPlaneFillStyle() {
  const c = componentsRef.value
  if (!c) return
  const mat = c.get(OBC.Clipper).material
  mat.color.setHex(CLIP_PLANE_FILL_COLOR)
  mat.opacity = CLIP_PLANE_FILL_OPACITY
  mat.transparent = true
  mat.depthWrite = false
  mat.depthTest = true
  if ('side' in mat) (mat as THREE.MeshBasicMaterial).side = THREE.DoubleSide
  mat.needsUpdate = true
}

function applyPerPlaneClipFillMaterial(plane: OBC.SimplePlane) {
  for (const mesh of plane.meshes) {
    const applyOne = (m: THREE.Material) => {
      if ('color' in m && (m as THREE.MeshBasicMaterial).color)
        (m as THREE.MeshBasicMaterial).color.setHex(CLIP_PLANE_FILL_COLOR)
      m.transparent = true
      m.opacity = CLIP_PLANE_FILL_OPACITY
      m.depthWrite = false
      m.depthTest = true
      if ('side' in m) (m as THREE.MeshBasicMaterial).side = THREE.DoubleSide
      m.needsUpdate = true
    }
    const mats = mesh.material
    if (Array.isArray(mats)) mats.forEach(applyOne)
    else applyOne(mats)
  }
}

function setupClipPlaneHoverDecor(plane: OBC.SimplePlane) {
  const mesh = plane.meshes[0]
  if (!mesh) return
  const existing = mesh.getObjectByName(CLIP_PLANE_HOVER_EDGES_NAME)
  if (existing) {
    existing.removeFromParent()
    const ls = existing as THREE.LineSegments
    ls.geometry.dispose()
    ;(ls.material as THREE.Material).dispose()
  }
  const edgesGeom = new THREE.EdgesGeometry(mesh.geometry, 18)
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xe879f9,
    transparent: true,
    opacity: 1,
    depthTest: true,
  })
  const edgeLines = new THREE.LineSegments(edgesGeom, edgeMat)
  edgeLines.name = CLIP_PLANE_HOVER_EDGES_NAME
  edgeLines.visible = false
  edgeLines.renderOrder = 2
  mesh.add(edgeLines)
  applyPerPlaneClipFillMaterial(plane)
  const p = plane as unknown as { controls: { getHelper: () => THREE.Object3D } }
  p.controls.getHelper().visible = false
}

function getActiveAxisCutPlane(): OBC.SimplePlane | null {
  const c = componentsRef.value
  const id = axisCutPlaneId.value
  const m = clipMode.value
  if (!c || !id || m === 'off' || m === 'box') return null
  return c.get(OBC.Clipper).list.get(id) ?? null
}

function updateClipPlanePointerHover(clientX: number, clientY: number) {
  const w = worldRef
  const plane = getActiveAxisCutPlane()
  if (!w?.renderer || !plane) {
    clipPlanePointerOverPlane = false
    return
  }
  const dom = w.renderer.three.domElement
  const rect = dom.getBoundingClientRect()
  const rw = rect.width,
    rh = rect.height
  if (rw <= 0 || rh <= 0) {
    clipPlanePointerOverPlane = false
    return
  }
  clipPlanePointerNdc.x = ((clientX - rect.left) / rw) * 2 - 1
  clipPlanePointerNdc.y = -((clientY - rect.top) / rh) * 2 + 1
  clipPlaneRaycaster.setFromCamera(clipPlanePointerNdc, w.camera.three)
  const p = plane as unknown as { controls: { getHelper: () => THREE.Object3D } }
  const helper = p.controls.getHelper()
  const prevH = helper.visible
  helper.visible = true
  const hits = clipPlaneRaycaster.intersectObjects([...plane.meshes, helper], true)
  helper.visible = prevH
  clipPlanePointerOverPlane = hits.length > 0
}

function applyClipPlaneDecorVisibility() {
  const plane = getActiveAxisCutPlane()
  if (!plane) return
  const show = clipPlaneDecorDragging || clipPlanePointerOverPlane
  const p = plane as unknown as { controls: { getHelper: () => THREE.Object3D } }
  p.controls.getHelper().visible = show
  const mesh = plane.meshes[0]
  const edges = mesh?.getObjectByName(CLIP_PLANE_HOVER_EDGES_NAME)
  if (edges) edges.visible = show
}

function bindClipPlanePointerTracking(
  w: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBCF.PostproductionRenderer>
) {
  if (!w.renderer || clipPlanePointerMoveHandler) return
  const dom = w.renderer.three.domElement
  clipPlanePointerMoveHandler = (ev: PointerEvent) => {
    clipPlanePointerInsideCanvas = true
    clipPlaneLastClientX = ev.clientX
    clipPlaneLastClientY = ev.clientY
    updateClipPlanePointerHover(ev.clientX, ev.clientY)
    applyClipPlaneDecorVisibility()
  }
  clipPlanePointerLeaveHandler = () => {
    clipPlanePointerInsideCanvas = false
    clipPlanePointerOverPlane = false
    applyClipPlaneDecorVisibility()
  }
  dom.addEventListener('pointermove', clipPlanePointerMoveHandler, { passive: true })
  dom.addEventListener('pointerleave', clipPlanePointerLeaveHandler)
  dom.addEventListener('pointerenter', () => {
    clipPlanePointerInsideCanvas = true
  })
}

function unbindClipPlanePointerTracking() {
  if (!worldRef?.renderer || !clipPlanePointerMoveHandler) return
  const dom = worldRef.renderer.three.domElement
  dom.removeEventListener('pointermove', clipPlanePointerMoveHandler)
  if (clipPlanePointerLeaveHandler)
    dom.removeEventListener('pointerleave', clipPlanePointerLeaveHandler)
  clipPlanePointerMoveHandler = null
  clipPlanePointerLeaveHandler = null
  clipPlanePointerOverPlane = false
  clipPlanePointerInsideCanvas = false
}

function bindFragmentsModelClipping(
  model: FragmentsModel,
  world: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBCF.PostproductionRenderer>
) {
  if (!world.renderer) return
  model.getClippingPlanesEvent = () => {
    return clipMode.value === 'box' ? [...sboxPlanes] : []
  }
}

function resizeRenderer() {
  const el = containerRef.value
  if (!el || !worldRef?.renderer) return
  const w = el.clientWidth,
    h = el.clientHeight
  if (w <= 0 || h <= 0) return
  worldRef.renderer.resize(new THREE.Vector2(w, h))
  if (sectionClipLineMaterial) {
    sectionClipLineMaterial.resolution.set(w, h)
    sectionClipLineMaterial.needsUpdate = true
  }
  applyCanvasTouchNone()
}

async function refreshStoreyData() {
  const components = componentsRef.value
  if (!components) return
  const classifier = components.get(OBC.Classifier)
  try {
    /** 樓層分組：官方 API 為 Classifier.byIfcBuildingStorey（與 IFC / .frag 模型皆相容） */
    await classifier.byIfcBuildingStorey()
    const groups = classifier.list.get(STOREYS_CLASS)
    const names: string[] = []
    if (groups) {
      for (const name of groups.keys()) {
        names.push(name)
        if (storeyVisible[name] === undefined) storeyVisible[name] = true
      }
    }
    storeyNames.value = names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    for (const k of Object.keys(storeyVisible)) {
      if (!storeyNames.value.includes(k)) delete storeyVisible[k]
    }
    if (storeyIsolateName.value && !storeyNames.value.includes(storeyIsolateName.value)) {
      storeyIsolateName.value = null
    }
    await applyStoreyHiderFromChecks()
  } catch {
    storeyNames.value = []
    storeyIsolateName.value = null
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
      { id: 'err', title: '讀取失敗', rows: [{ name: '錯誤', value: msg }] },
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
  void loadPropertySections(sel)
  if (!freeRoamActive.value && worldRef) {
    void worldRef.camera.fitToItems(sel).catch(() => {
      /* ignore */
    })
  }
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
    if (model && worldRef) worldRef.scene.three.remove(model.object)
    await fragments.core
      .disposeModel(id)
      .catch((e) => console.warn('[IfcViewer] disposeModel', id, e))
  }
  for (const k of Object.keys(fragModelLabels)) delete fragModelLabels[k]
  syncLoadedModelRows()
  clearAllClipsAndSection()
  storeyNames.value = []
  for (const k of Object.keys(storeyVisible)) delete storeyVisible[k]
  storeyIsolateName.value = null
  propertySections.value = []
  hasPropertySelection.value = false
  showPropertiesPanel.value = false
  updateSceneClipBoundingRanges()
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
  clipper.setup({ color: new THREE.Color(CLIP_PLANE_FILL_COLOR), opacity: CLIP_PLANE_FILL_OPACITY })
  clipper.orthogonalY = true
  clipper.enabled = true
  applyClipperPlaneFillStyle()

  const clipStyler = components.get(OBCF.ClipStyler)
  clipStyler.world = w
  clipStyler.enabled = true
  clipStyler.visible = true

  const hostEl = containerRef.value
  const resW = Math.max(hostEl?.clientWidth ?? 800, 1),
    resH = Math.max(hostEl?.clientHeight ?? 600, 1)
  sectionClipLineMaterial = new LineMaterial({
    color: 0xa855f7,
    linewidth: 2,
    resolution: new THREE.Vector2(resW, resH),
    worldUnits: false,
  })
  clipStyler.styles.set(SECTION_CLIP_STYLE_ID, {
    linesMaterial: sectionClipLineMaterial,
    fillsMaterial: new THREE.MeshBasicMaterial({
      color: CLIP_PLANE_FILL_COLOR,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  })

  clipperOnAfterCreate = (plane: OBC.SimplePlane) => {
    const cp = componentsRef.value?.get(OBC.Clipper)
    if (!cp) return
    const id = cp.list.getKey(plane)
    if (!id) return
    if (clipMode.value === 'box') return

    try {
      activeSectionClipEdges = clipStyler.createFromClipping(id, {
        link: true,
        world: w,
        items: { all: { style: SECTION_CLIP_STYLE_ID } },
      })
      void activeSectionClipEdges.update().catch((e) => {
        console.warn('[IfcViewer] ClipEdges.update', e)
      })
    } catch (e) {
      console.warn('[IfcViewer] ClipStyler.createFromClipping', e)
    }
    applyClipperPlaneGizmoSize()
    setupClipPlaneHoverDecor(plane)
    applyClipPlaneDecorVisibility()
  }
  clipper.onAfterCreate.add(clipperOnAfterCreate)

  clipperOnBeforeDragDecor = () => {
    clipPlaneDecorDragging = true
    applyClipPlaneDecorVisibility()
  }
  clipper.onBeforeDrag.add(clipperOnBeforeDragDecor)

  clipperOnAfterDrag = (dragged: OBC.SimplePlane) => {
    clipPlaneDecorDragging = false
    const cp = componentsRef.value?.get(OBC.Clipper)
    if (!cp) return
    const id = cp.list.getKey(dragged)
    if (!id) return
    if (clipMode.value === 'box') return
    setupClipPlaneHoverDecor(dragged)
    applyClipPlaneDecorVisibility()
    if (id !== axisCutPlaneId.value) return
    syncAxisCutSlidersFromActivePlane()
  }
  clipper.onAfterDrag.add(clipperOnAfterDrag)

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
  highlighter.zoomToSelection = false

  highlighterOnHighlight = () => syncHighlightToProperties()
  highlighterOnClear = () => {
    propertySections.value = []
    hasPropertySelection.value = false
    showPropertiesPanel.value = false
  }
  highlighter.events[SELECT_NAME].onHighlight.add(highlighterOnHighlight)
  highlighter.events[SELECT_NAME].onClear.add(highlighterOnClear)
}

function scheduleFragmentsUpdate() {
  if (fragmentsUpdateRafId) return
  fragmentsUpdateRafId = requestAnimationFrame(() => {
    fragmentsUpdateRafId = 0
    void componentsRef.value?.get(OBC.FragmentsManager).core.update()
  })
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
    bindFragmentsModelClipping(model, w)
    if (clipMode.value === 'box' && sboxPlanes.length > 0) applyPlanesToModels()
    void fragments.core.update(true)
    void refreshStoreyData()
    const refreshClipBounds = () => {
      updateSceneClipBoundingRanges()
      applyClipperPlaneGizmoSize()
    }
    refreshClipBounds()
    requestAnimationFrame(() => {
      refreshClipBounds()
      requestAnimationFrame(refreshClipBounds)
    })
    syncLoadedModelRows()
    nextTick(() => applyCanvasTouchNone())
  }
  fragments.list.onItemSet.add(onModelLoaded)
  w.renderer?.onClippingPlanesUpdated.add(() => {
    if (sboxDragState) return
    scheduleFragmentsUpdate()
  })
  onMaterialSet = ({ value: material }) => {
    const m = material as THREE.Material & { isLodMaterial?: boolean }
    if (!('isLodMaterial' in m && m.isLodMaterial)) {
      m.polygonOffset = true
      m.polygonOffsetUnits = 1
      m.polygonOffsetFactor = Math.random()
    }
    if (clipMode.value === 'box' && sboxPlanes.length > 0) {
      const mc = m as THREE.Material & { clipping: boolean; clippingPlanes: THREE.Plane[] }
      mc.clipping = true
      mc.clippingPlanes = [...sboxPlanes]
      mc.needsUpdate = true
    }
  }
  fragments.core.models.materials.list.onItemSet.add(onMaterialSet)
  if (w.camera.hasCameraControls()) {
    applyViewerCameraControlParams(w.camera.controls)
    onControlsUpdate = () => {
      scheduleFragmentsUpdate()
      if (
        (clipMode.value === 'x' || clipMode.value === 'y' || clipMode.value === 'z') &&
        clipPlanePointerInsideCanvas
      ) {
        updateClipPlanePointerHover(clipPlaneLastClientX, clipPlaneLastClientY)
        applyClipPlaneDecorVisibility()
      }
    }
    w.camera.controls.addEventListener('update', onControlsUpdate)
  }
  const ifcLoader = components.get(OBC.IfcLoader)
  /** 與 FragmentsManager.init 相同來源，避免遠端 worker 與本機 web-ifc WASM 版本不一致 */
  const workerSrcUrl = fragmentsWorkerUrl
  const workerRes = await fetch(workerSrcUrl)
  if (!workerRes.ok) {
    throw new Error(`IFC worker 載入失敗：HTTP ${workerRes.status}（${workerSrcUrl}）`)
  }
  const workerBlob = await workerRes.blob()
  const workerFile = new File([workerBlob], 'worker.mjs', { type: 'text/javascript' })
  const workerUrl = URL.createObjectURL(workerFile)
  if (ifcLoaderWorkerBlobUrl) URL.revokeObjectURL(ifcLoaderWorkerBlobUrl)
  ifcLoaderWorkerBlobUrl = workerUrl
  await ifcLoader.setup({
    workerUrl,
    autoSetWasm: false,
  } as Partial<OBC.IfcFragmentSettings> & { workerUrl: string })
  const wasmBase = new URL(import.meta.env.BASE_URL, window.location.origin).href
  ifcLoader.settings.wasm = {
    path: wasmBase.endsWith('/') ? wasmBase : `${wasmBase}/`,
    absolute: true,
  }
  components.init()
  rendererBeforeUpdateDebugHandler = () => {
    if (!import.meta.env.DEV) return
    const t = performance.now()
    if (t - rendererDebugLogLastTs < 1500) return
    rendererDebugLogLastTs = t
    console.log('rendering...')
  }
  w.renderer.onBeforeUpdate.add(rendererBeforeUpdateDebugHandler)
  worldRef = w
  resizeObserver = new ResizeObserver(() => resizeRenderer())
  resizeObserver.observe(container)
  resizeRenderer()
  setupViewerExtensions(components, w)
  bindClipPlanePointerTracking(w)
  updateSceneClipBoundingRanges()
  await nextTick()
  applyCanvasTouchNone()
  try {
    navModeId.value = w.camera.mode.id
  } catch {
    navModeId.value = 'Orbit'
  }
  orbitPanPrimary.value = false
  if (w.camera.hasCameraControls() && navModeId.value === 'Orbit') applyOrbitPointerBindings()
  viewerCanvasReady.value = true
  status.value = 'Ready — load .ifc / .frag or use sample buttons.'
}

function teardownExtensionListeners() {
  const components = componentsRef.value
  if (components) {
    const hl = components.get(OBCF.Highlighter)
    if (highlighterOnHighlight) hl.events[SELECT_NAME].onHighlight.remove(highlighterOnHighlight)
    if (highlighterOnClear) hl.events[SELECT_NAME].onClear.remove(highlighterOnClear)
    const cp = components.get(OBC.Clipper)
    if (clipperOnAfterCreate) cp.onAfterCreate.remove(clipperOnAfterCreate)
    if (clipperOnAfterDrag) cp.onAfterDrag.remove(clipperOnAfterDrag)
    if (clipperOnBeforeDragDecor) cp.onBeforeDrag.remove(clipperOnBeforeDragDecor)
  }
  highlighterOnHighlight = null
  highlighterOnClear = null
  clipperOnAfterCreate = null
  clipperOnAfterDrag = null
  clipperOnBeforeDragDecor = null
}

onUnmounted(() => {
  if (fragmentsUpdateRafId) {
    cancelAnimationFrame(fragmentsUpdateRafId)
    fragmentsUpdateRafId = 0
  }
  destroySectionBox()
  if (freeRoamActive.value) {
    freeRoamActive.value = false
    stopFreeRoamLoopAndListeners()
  }
  viewerCanvasReady.value = false
  if (ifcLoaderWorkerBlobUrl) {
    URL.revokeObjectURL(ifcLoaderWorkerBlobUrl)
    ifcLoaderWorkerBlobUrl = null
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  if (componentsRef.value && worldRef) {
    if (rendererBeforeUpdateDebugHandler && worldRef.renderer) {
      worldRef.renderer.onBeforeUpdate.remove(rendererBeforeUpdateDebugHandler)
      rendererBeforeUpdateDebugHandler = null
    }
    const fragments = componentsRef.value.get(OBC.FragmentsManager)
    if (onModelLoaded) fragments.list.onItemSet.remove(onModelLoaded)
    if (onMaterialSet) fragments.core.models.materials.list.onItemSet.remove(onMaterialSet)
    if (onControlsUpdate && worldRef.camera.hasCameraControls())
      worldRef.camera.controls.removeEventListener('update', onControlsUpdate)
  }
  teardownExtensionListeners()
  unbindClipPlanePointerTracking()
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

function randomIdSegment(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
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

function worldXFromAxisT(): number {
  const r = sceneXRange.value
  if (!r || r.max <= r.min) return 0
  return r.min + axisCutTX.value * (r.max - r.min)
}
function worldYFromAxisT(): number {
  const r = sceneYRange.value
  if (!r || r.max <= r.min) return 0
  return r.min + axisCutTY.value * (r.max - r.min)
}
function worldZFromAxisT(): number {
  const r = sceneZRange.value
  if (!r || r.max <= r.min) return 0
  return r.min + axisCutTZ.value * (r.max - r.min)
}

// ─── Section Box helpers ────────────────────────────────────────

function sboxWorldMin(): THREE.Vector3 {
  const rx = sceneXRange.value,
    ry = sceneYRange.value,
    rz = sceneZRange.value
  return new THREE.Vector3(
    rx ? rx.min + sectionBoxT.minX * (rx.max - rx.min) : -10,
    ry ? ry.min + sectionBoxT.minY * (ry.max - ry.min) : -10,
    rz ? rz.min + sectionBoxT.minZ * (rz.max - rz.min) : -10
  )
}

function sboxWorldMax(): THREE.Vector3 {
  const rx = sceneXRange.value,
    ry = sceneYRange.value,
    rz = sceneZRange.value
  return new THREE.Vector3(
    rx ? rx.min + sectionBoxT.maxX * (rx.max - rx.min) : 10,
    ry ? ry.min + sectionBoxT.maxY * (ry.max - ry.min) : 10,
    rz ? rz.min + sectionBoxT.maxZ * (rz.max - rz.min) : 10
  )
}

function destroySectionBoxVisuals() {
  if (sboxOutline) {
    sboxOutline.removeFromParent()
    sboxOutline.geometry.dispose()
    sboxOutline = null
  }
  if (sboxGizmo) {
    sboxGizmo.removeFromParent()
    sboxGizmo = null
  }
  for (const q of sboxFaceQuads) {
    q.removeFromParent()
    q.geometry.dispose()
    ;(q.material as THREE.Material).dispose()
  }
  sboxFaceQuads = []
  for (const e of sboxFaceEdges) {
    e.removeFromParent()
    e.geometry.dispose()
    ;(e.material as THREE.Material).dispose()
  }
  sboxFaceEdges = []
}

function buildSectionBoxVisuals(min: THREE.Vector3, max: THREE.Vector3) {
  if (!worldRef) return
  destroySectionBoxVisuals()
  const scene = worldRef.scene.three
  const box3 = new THREE.Box3(min, max)

  // White outline box
  sboxOutline = new THREE.Box3Helper(box3, 0xffffff)
  sboxOutline.renderOrder = 3
  scene.add(sboxOutline)

  // RGB gizmo at box center
  const center = new THREE.Vector3()
  box3.getCenter(center)
  const size = new THREE.Vector3()
  box3.getSize(size)
  const arrowLen = Math.max(size.x, size.y, size.z) * 0.18
  sboxGizmo = new THREE.Group()
  sboxGizmo.position.copy(center)
  sboxGizmo.add(
    new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(),
      arrowLen,
      0xff3333,
      arrowLen * 0.28,
      arrowLen * 0.16
    )
  )
  sboxGizmo.add(
    new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(),
      arrowLen,
      0x33dd33,
      arrowLen * 0.28,
      arrowLen * 0.16
    )
  )
  sboxGizmo.add(
    new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(),
      arrowLen,
      0x3399ff,
      arrowLen * 0.28,
      arrowLen * 0.16
    )
  )
  scene.add(sboxGizmo)

  // 6 invisible face quads for raycasting + hover edge lines
  const faceConfigs = [
    {
      key: 'px',
      tKey: 'maxX' as keyof typeof sectionBoxT,
      axis: 'x' as const,
      dir: 1 as const,
      pos: new THREE.Vector3(max.x, center.y, center.z),
      rot: new THREE.Euler(0, Math.PI / 2, 0),
      w: size.z,
      h: size.y,
    },
    {
      key: 'nx',
      tKey: 'minX' as keyof typeof sectionBoxT,
      axis: 'x' as const,
      dir: -1 as const,
      pos: new THREE.Vector3(min.x, center.y, center.z),
      rot: new THREE.Euler(0, -Math.PI / 2, 0),
      w: size.z,
      h: size.y,
    },
    {
      key: 'py',
      tKey: 'maxY' as keyof typeof sectionBoxT,
      axis: 'y' as const,
      dir: 1 as const,
      pos: new THREE.Vector3(center.x, max.y, center.z),
      rot: new THREE.Euler(-Math.PI / 2, 0, 0),
      w: size.x,
      h: size.z,
    },
    {
      key: 'ny',
      tKey: 'minY' as keyof typeof sectionBoxT,
      axis: 'y' as const,
      dir: -1 as const,
      pos: new THREE.Vector3(center.x, min.y, center.z),
      rot: new THREE.Euler(Math.PI / 2, 0, 0),
      w: size.x,
      h: size.z,
    },
    {
      key: 'pz',
      tKey: 'maxZ' as keyof typeof sectionBoxT,
      axis: 'z' as const,
      dir: 1 as const,
      pos: new THREE.Vector3(center.x, center.y, max.z),
      rot: new THREE.Euler(0, 0, 0),
      w: size.x,
      h: size.y,
    },
    {
      key: 'nz',
      tKey: 'minZ' as keyof typeof sectionBoxT,
      axis: 'z' as const,
      dir: -1 as const,
      pos: new THREE.Vector3(center.x, center.y, min.z),
      rot: new THREE.Euler(0, Math.PI, 0),
      w: size.x,
      h: size.y,
    },
  ]

  for (const fc of faceConfigs) {
    const safeW = Math.max(fc.w, 2),
      safeH = Math.max(fc.h, 2)
    // Invisible quad for raycasting
    const geo = new THREE.PlaneGeometry(safeW, safeH)
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(fc.pos)
    mesh.rotation.copy(fc.rot)
    mesh.userData = {
      sboxFaceKey: fc.key,
      sboxAxis: fc.axis,
      sboxDir: fc.dir,
      sboxTKey: fc.tKey,
      sboxBaseW: safeW,
      sboxBaseH: safeH,
    }
    scene.add(mesh)
    sboxFaceQuads.push(mesh)

    // Edge outline per face (hover highlight)
    const edgeGeo = new THREE.EdgesGeometry(geo)
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      depthTest: false,
    })
    const edgeLine = new THREE.LineSegments(edgeGeo, edgeMat)
    edgeLine.renderOrder = 4
    mesh.add(edgeLine) // child of quad so it inherits transform
    sboxFaceEdges.push(edgeLine)
  }
}

/** Drag 時只更新既有物件，不重建 geometry／GPU 資源 */
function updateSectionBoxVisuals(min: THREE.Vector3, max: THREE.Vector3) {
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  const box3 = new THREE.Box3(min, max)
  box3.getCenter(center)
  box3.getSize(size)

  if (sboxOutline) {
    sboxOutline.box.set(min, max)
  }

  if (sboxGizmo) {
    sboxGizmo.position.copy(center)
  }

  for (const q of sboxFaceQuads) {
    const dir = q.userData.sboxDir as 1 | -1
    const axis = q.userData.sboxAxis as 'x' | 'y' | 'z'
    const key = q.userData.sboxFaceKey as string
    if (axis === 'x') q.position.set(dir > 0 ? max.x : min.x, center.y, center.z)
    if (axis === 'y') q.position.set(center.x, dir > 0 ? max.y : min.y, center.z)
    if (axis === 'z') q.position.set(center.x, center.y, dir > 0 ? max.z : min.z)

    // 幾何在 build 時固定；盒子厚度變化時用 scale 對齊，否則 py/ny 在 x 向會卡在初始寬度（「x 軸太寬」）
    const baseW = (q.userData.sboxBaseW as number) ?? 2
    const baseH = (q.userData.sboxBaseH as number) ?? 2
    let tw = 2
    let th = 2
    if (key === 'px' || key === 'nx') {
      tw = Math.max(size.z, 2)
      th = Math.max(size.y, 2)
    } else if (key === 'py' || key === 'ny') {
      tw = Math.max(size.x, 2)
      th = Math.max(size.z, 2)
    } else if (key === 'pz' || key === 'nz') {
      tw = Math.max(size.x, 2)
      th = Math.max(size.y, 2)
    }
    q.scale.set(tw / baseW, th / baseH, 1)
  }
}

function hideSboxFaceArrow() {
  sboxArrowHoverActive = false
  if (sboxArrow) {
    const hitMesh = sboxArrow.userData.hitMesh as THREE.Mesh | undefined
    if (hitMesh) {
      hitMesh.removeFromParent()
      hitMesh.geometry.dispose()
      ;(hitMesh.material as THREE.Material).dispose()
    }
    sboxArrow.removeFromParent()
    sboxArrow = null
  }
  sboxActiveFaceKey = null
  if (sboxGizmo) sboxGizmo.visible = true
  if (worldRef?.renderer) worldRef.renderer.three.domElement.style.cursor = ''
}

const SBOX_ARROW_COLOR = 0xffff00
const SBOX_ARROW_HOVER_COLOR = 0xffee44
const SBOX_ARROW_HOVER_SCALE = 1.18

/** 滑鼠在箭頭 hit 球上時：變亮、略放大、球體淡黃提示可拖曳 */
function applySboxArrowHoverVisual(hover: boolean) {
  if (!sboxArrow) {
    sboxArrowHoverActive = false
    return
  }
  if (sboxArrowHoverActive === hover) return
  sboxArrowHoverActive = hover
  sboxArrow.setColor(hover ? SBOX_ARROW_HOVER_COLOR : SBOX_ARROW_COLOR)
  sboxArrow.scale.setScalar(hover ? SBOX_ARROW_HOVER_SCALE : 1)
  const hitMesh = sboxArrow.userData.hitMesh as THREE.Mesh | undefined
  if (hitMesh) {
    hitMesh.scale.setScalar(hover ? SBOX_ARROW_HOVER_SCALE : 1)
    const hm = hitMesh.material as THREE.MeshBasicMaterial
    hm.color.setHex(0xffffcc)
    hm.opacity = hover ? 0.28 : 0
    hm.needsUpdate = true
  }
  if (worldRef?.renderer) {
    ;(worldRef.renderer as OBCF.PostproductionRenderer).needsUpdate = true
  }
}

/** 箭頭原點略沿面向外推，避免與裁切後三角面 z-fighting 導致整支箭頭被深度吃掉 */
function sboxFaceArrowPadWorld(): number {
  const size = new THREE.Vector3()
  new THREE.Box3(sboxWorldMin(), sboxWorldMax()).getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6)
  return maxDim * 0.004 + 0.03
}

function showSboxFaceArrow(faceKey: string) {
  hideSboxFaceArrow()
  if (!worldRef) return

  const quad = sboxFaceQuads.find((q) => q.userData.sboxFaceKey === faceKey)
  if (!quad) return

  const axis = quad.userData.sboxAxis as 'x' | 'y' | 'z'
  const dir = quad.userData.sboxDir as 1 | -1

  const arrowDir = new THREE.Vector3(
    axis === 'x' ? dir : 0,
    axis === 'y' ? dir : 0,
    axis === 'z' ? dir : 0
  )

  const box3 = new THREE.Box3(sboxWorldMin(), sboxWorldMax())
  const size = new THREE.Vector3()
  box3.getSize(size)
  const arrowLen = Math.max(size.x, size.y, size.z) * 0.25
  const pad = sboxFaceArrowPadWorld()
  const origin = quad.position.clone().addScaledVector(arrowDir, pad)

  sboxArrow = new THREE.ArrowHelper(
    arrowDir,
    origin,
    arrowLen,
    0xffff00,
    arrowLen * 0.3,
    arrowLen * 0.18
  )
  sboxArrow.setColor(0xffff00)
  const lineMat = sboxArrow.line.material as THREE.LineBasicMaterial
  const coneMat = sboxArrow.cone.material as THREE.MeshBasicMaterial
  ;(lineMat as unknown as { clipping: boolean }).clipping = false
  ;(coneMat as unknown as { clipping: boolean }).clipping = false
  lineMat.toneMapped = false
  coneMat.toneMapped = false
  lineMat.depthTest = false
  coneMat.depthTest = false
  lineMat.depthWrite = false
  coneMat.depthWrite = false
  sboxArrow.frustumCulled = false
  sboxArrow.line.frustumCulled = false
  sboxArrow.cone.frustumCulled = false
  sboxArrow.line.renderOrder = 1000
  sboxArrow.cone.renderOrder = 1000
  sboxArrow.renderOrder = 1000

  // 較大球體作為 hit area（visible:false 的 mesh 不會被 raycast，故用 opacity:0）
  const hitGeo = new THREE.SphereGeometry(arrowLen * 0.25, 8, 8)
  const hitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  })
  ;(hitMat as unknown as { clipping: boolean }).clipping = false
  hitMat.clippingPlanes = []
  const hitMesh = new THREE.Mesh(hitGeo, hitMat)
  hitMesh.userData.isSboxArrowHit = true
  hitMesh.frustumCulled = false
  hitMesh.renderOrder = 999
  hitMesh.position.copy(origin).addScaledVector(arrowDir, arrowLen * 0.85)
  worldRef.scene.three.add(hitMesh)
  sboxArrow.userData.hitMesh = hitMesh

  worldRef.scene.three.add(sboxArrow)
  if (sboxGizmo) sboxGizmo.visible = false
  sboxActiveFaceKey = faceKey
  const r = worldRef.renderer as OBCF.PostproductionRenderer
  r.needsUpdate = true
}

/** 更新 hover 高亮：滑過某個 face quad 時，該面邊線變亮 */
function updateSboxFaceHover(clientX: number, clientY: number) {
  if (!worldRef?.renderer || sboxFaceQuads.length === 0) return
  const dom = worldRef.renderer.three.domElement
  const rect = dom.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  )
  if (!sboxHoverRaycaster) sboxHoverRaycaster = new THREE.Raycaster()
  sboxHoverRaycaster.setFromCamera(ndc, worldRef.camera.three)
  const hits = sboxHoverRaycaster.intersectObjects(sboxFaceQuads, false)
  const hitKey = hits.length > 0 ? (hits[0]!.object as THREE.Mesh).userData.sboxFaceKey : null
  for (const q of sboxFaceQuads) {
    const edgeLine = q.children[0] as THREE.LineSegments | undefined
    if (!edgeLine) continue
    const mat = edgeLine.material as THREE.LineBasicMaterial
    const isHit = q.userData.sboxFaceKey === hitKey
    mat.opacity = isHit ? 0.9 : 0.0
    mat.needsUpdate = true
  }
}

function applyPlanesToModels() {
  const components = componentsRef.value
  if (!components || !worldRef?.renderer) return
  worldRef.renderer.three.localClippingEnabled = true
  const fragments = components.get(OBC.FragmentsManager)
  for (const id of fragments.list.keys()) {
    const model = fragments.list.get(id)
    if (!model) continue
    model.object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        for (const mat of mats) {
          if (!mat) continue
          const m = mat as THREE.Material & { clipping?: boolean }
          m.clipping = true
          m.clippingPlanes = [...sboxPlanes]
          m.needsUpdate = true
        }
      }
    })
  }
}

function clearPlanesFromModels() {
  const components = componentsRef.value
  if (!components) return
  const fragments = components.get(OBC.FragmentsManager)
  for (const id of fragments.list.keys()) {
    const model = fragments.list.get(id)
    if (!model) continue
    model.object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        for (const mat of mats) {
          if (!mat) continue
          const m = mat as THREE.Material & { clipping?: boolean }
          m.clippingPlanes = []
          m.clipping = false
          m.needsUpdate = true
        }
      }
    })
  }
}

/** 建立「含拖曳軸」的拖曳平面：過盒心在該軸上對齊目前裁切面的點，法線為 view×axis */
function sboxComputeDragPlaneAtPointer(
  cam: THREE.Camera,
  axis: 'x' | 'y' | 'z',
  faceKey: string
): { anchor: THREE.Vector3; normal: THREE.Vector3 } | null {
  const planeIndex: Record<string, number> = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 }
  const idx = planeIndex[faceKey]
  if (idx === undefined || !sboxPlanes[idx]) return null
  const sp = sboxPlanes[idx]!
  const facePosOnAxis =
    faceKey === 'px' || faceKey === 'py' || faceKey === 'pz' ? sp.constant : -sp.constant
  const minB = sboxWorldMin()
  const maxB = sboxWorldMax()
  const boxCenter = new THREE.Vector3()
  new THREE.Box3(minB, maxB).getCenter(boxCenter)
  const anchor = boxCenter.clone()
  anchor[axis] = facePosOnAxis

  const axisNormal = new THREE.Vector3(
    axis === 'x' ? 1 : 0,
    axis === 'y' ? 1 : 0,
    axis === 'z' ? 1 : 0
  )
  const forward = new THREE.Vector3()
  cam.getWorldDirection(forward)
  const dragPlaneN = new THREE.Vector3().crossVectors(forward, axisNormal)
  if (dragPlaneN.lengthSq() < 1e-12) {
    const wq = cam.getWorldQuaternion(new THREE.Quaternion())
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(wq)
    dragPlaneN.crossVectors(camRight, axisNormal)
  }
  if (dragPlaneN.lengthSq() < 1e-12) {
    const wq = cam.getWorldQuaternion(new THREE.Quaternion())
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(wq)
    dragPlaneN.crossVectors(camUp, axisNormal)
  }
  if (dragPlaneN.lengthSq() < 1e-12) return null
  dragPlaneN.normalize()
  return { anchor, normal: dragPlaneN.clone()   }
}

/** 裁切平面常數已就地改在 sboxPlanes 上；只觸發材質重繪，勿每幀 applyPlanesToModels（全場景 traverse + 重設陣列極重） */
function invalidateSboxFragmentMaterials() {
  const components = componentsRef.value
  if (!components || !worldRef?.renderer) return
  worldRef.renderer.three.localClippingEnabled = true
  const fragments = components.get(OBC.FragmentsManager)
  for (const id of fragments.list.keys()) {
    const model = fragments.list.get(id)
    if (!model) continue
    model.object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        for (const mat of mats) {
          if (!mat) continue
          const m = mat as THREE.Material & { clipping?: boolean }
          if (m.clipping && m.clippingPlanes && m.clippingPlanes.length > 0) m.needsUpdate = true
        }
      }
    })
  }
}

function moveSectionBoxFace(
  faceKey: string,
  axis: 'x' | 'y' | 'z',
  _dir: 1 | -1,
  tKey: keyof typeof sectionBoxT,
  newWorldPos: number
) {
  const range =
    axis === 'x' ? sceneXRange.value : axis === 'y' ? sceneYRange.value : sceneZRange.value
  if (!range || range.max <= range.min) {
    sboxDbg('moveSectionBoxFace NO-OP: range', { axis, range, newWorldPos })
    return
  }
  if (!Number.isFinite(newWorldPos)) {
    sboxDbg('moveSectionBoxFace NO-OP: non-finite newWorldPos', newWorldPos)
    return
  }

  let newT = (newWorldPos - range.min) / (range.max - range.min)
  const GAP = 0.02
  if (tKey === 'maxX') newT = Math.min(1, Math.max(sectionBoxT.minX + GAP, newT))
  if (tKey === 'minX') newT = Math.max(0, Math.min(sectionBoxT.maxX - GAP, newT))
  if (tKey === 'maxY') newT = Math.min(1, Math.max(sectionBoxT.minY + GAP, newT))
  if (tKey === 'minY') newT = Math.max(0, Math.min(sectionBoxT.maxY - GAP, newT))
  if (tKey === 'maxZ') newT = Math.min(1, Math.max(sectionBoxT.minZ + GAP, newT))
  if (tKey === 'minZ') newT = Math.max(0, Math.min(sectionBoxT.maxZ - GAP, newT))
  sectionBoxT[tKey] = newT

  const worldPos = range.min + newT * (range.max - range.min)

  const planeIndex: Record<string, number> = {
    px: 0,
    nx: 1,
    py: 2,
    ny: 3,
    pz: 4,
    nz: 5,
  }
  const idx = planeIndex[faceKey]
  if (idx !== undefined && sboxPlanes[idx]) {
    const plane = sboxPlanes[idx]!
    if (faceKey === 'px') plane.constant = worldPos
    if (faceKey === 'nx') plane.constant = -worldPos
    if (faceKey === 'py') plane.constant = worldPos
    if (faceKey === 'ny') plane.constant = -worldPos
    if (faceKey === 'pz') plane.constant = worldPos
    if (faceKey === 'nz') plane.constant = -worldPos
  }

  invalidateSboxFragmentMaterials()
  updateSectionBoxVisuals(sboxWorldMin(), sboxWorldMax())
}

function attachSectionBoxPointerListeners() {
  if (!worldRef?.renderer) return
  const dom = worldRef.renderer.three.domElement

  // Cleanup old listeners
  if (sboxPointerDownHandler) {
    dom.removeEventListener('pointerdown', sboxPointerDownHandler, { capture: true })
    sboxPointerDownHandler = null
  }
  if (sboxPointerMoveHandler) {
    dom.removeEventListener('pointermove', sboxPointerMoveHandler, { capture: true })
    sboxPointerMoveHandler = null
  }
  if (sboxPointerUpHandler) {
    dom.removeEventListener('pointerup', sboxPointerUpHandler)
    sboxPointerUpHandler = null
  }
  if (sboxHoverMoveHandler) {
    dom.removeEventListener('pointermove', sboxHoverMoveHandler)
    sboxHoverMoveHandler = null
  }
  if (sboxPointerLeaveHandler) {
    dom.removeEventListener('pointerleave', sboxPointerLeaveHandler)
    sboxPointerLeaveHandler = null
  }
  if (sboxDragMoveRaf !== 0) {
    cancelAnimationFrame(sboxDragMoveRaf)
    sboxDragMoveRaf = 0
  }

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()

  function clientToNdc(clientX: number, clientY: number) {
    const rect = dom.getBoundingClientRect()
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
  }

  // ★ capture phase：盡早攔截 Section Box 面點選／拖曳
  sboxPointerDownHandler = (e: PointerEvent) => {
    if (e.button !== 0) return
    clientToNdc(e.clientX, e.clientY)
    raycaster.setFromCamera(ndc, worldRef!.camera.three)

    if (sboxArrow && clipMode.value === 'box') {
      const hitMesh = sboxArrow.userData.hitMesh as THREE.Mesh | undefined
      const arrowHitObjects = hitMesh ? [hitMesh] : []
      const arrowHits = raycaster.intersectObjects(arrowHitObjects, false)
      sboxDbg('pointerdown arrow branch', {
        arrowHits: arrowHits.length,
        activeFace: sboxActiveFaceKey,
        hasHitMesh: !!hitMesh,
        pointerId: e.pointerId,
      })
      if (arrowHits.length > 0 && sboxActiveFaceKey) {
        e.stopPropagation()
        e.stopImmediatePropagation()
        const quad = sboxFaceQuads.find((q) => q.userData.sboxFaceKey === sboxActiveFaceKey)
        if (!quad) {
          sboxDbg('pointerdown ABORT: no quad for activeFace', sboxActiveFaceKey)
          return
        }
        const axis = quad.userData.sboxAxis as 'x' | 'y' | 'z'
        const dir = quad.userData.sboxDir as 1 | -1
        const tKey = quad.userData.sboxTKey as keyof typeof sectionBoxT
        const dp = sboxComputeDragPlaneAtPointer(worldRef!.camera.three, axis, sboxActiveFaceKey)
        if (!dp) {
          sboxDbg('pointerdown ABORT: drag plane degenerate', { axis, face: sboxActiveFaceKey })
          return
        }
        const dragPlaneAtDown = new THREE.Plane().setFromNormalAndCoplanarPoint(dp.normal, dp.anchor)
        const startHit = new THREE.Vector3()
        if (!rayIntersectPlaneUnclamped(raycaster.ray, dragPlaneAtDown, startHit)) {
          sboxDbg('pointerdown ABORT: ray parallel to drag plane at down', { axis })
          return
        }
        const dragStartAxisWorld =
          axis === 'x' ? dp.anchor.x : axis === 'y' ? dp.anchor.y : dp.anchor.z
        sboxDragState = {
          faceKey: sboxActiveFaceKey,
          axis,
          dir,
          tKey,
          planeConstantAtStart: 0,
          clientXStart: e.clientX,
          clientYStart: e.clientY,
          dragStartAxisWorld,
          dragStartIntersectX: startHit.x,
          dragStartIntersectY: startHit.y,
          dragStartIntersectZ: startHit.z,
          dragPlaneAnchorX: dp.anchor.x,
          dragPlaneAnchorY: dp.anchor.y,
          dragPlaneAnchorZ: dp.anchor.z,
          dragPlaneNx: dp.normal.x,
          dragPlaneNy: dp.normal.y,
          dragPlaneNz: dp.normal.z,
        }
        sboxDbgMoveLastTs = 0
        sboxDragPendingClientX = e.clientX
        sboxDragPendingClientY = e.clientY
        sboxDbg('drag START', { faceKey: sboxActiveFaceKey, axis, dir, tKey, capture: e.pointerId })
        dom.setPointerCapture(e.pointerId)
        if (worldRef?.camera.hasCameraControls()) {
          worldRef.camera.controls.enabled = false
          sboxDbg('camera controls disabled')
        } else {
          sboxDbg('camera hasCameraControls=false (controls not toggled)')
        }
        return
      }
    }

    if (clipMode.value !== 'box') return
    const hits = raycaster.intersectObjects(sboxFaceQuads, false)
    if (hits.length === 0) {
      hideSboxFaceArrow()
      return
    }

    e.stopPropagation()
    e.stopImmediatePropagation()

    const mesh = hits[0]!.object as THREE.Mesh
    const { sboxFaceKey } = mesh.userData as { sboxFaceKey: string }
    sboxDbg('pointerdown face hit → show arrow', sboxFaceKey)
    showSboxFaceArrow(sboxFaceKey)
  }

  function flushSboxPointerDragMove() {
    const ds = sboxDragState
    if (!ds || clipMode.value !== 'box' || !worldRef) {
      return
    }

    clientToNdc(sboxDragPendingClientX, sboxDragPendingClientY)
    raycaster.setFromCamera(ndc, worldRef.camera.three)

    const planeIndex: Record<string, number> = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 }
    const idx = planeIndex[ds.faceKey]
    if (idx === undefined || !sboxPlanes[idx]) {
      sboxDbg('move SKIP: bad plane index or missing plane', {
        faceKey: ds.faceKey,
        idx,
        planesLen: sboxPlanes.length,
      })
      return
    }
    const pOnFace = new THREE.Vector3(
      ds.dragPlaneAnchorX,
      ds.dragPlaneAnchorY,
      ds.dragPlaneAnchorZ
    )
    const dragPlaneN = new THREE.Vector3(ds.dragPlaneNx, ds.dragPlaneNy, ds.dragPlaneNz)
    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(dragPlaneN, pOnFace)
    const intersectPt = new THREE.Vector3()
    const ok = rayIntersectPlaneUnclamped(raycaster.ray, dragPlane, intersectPt)
    if (!ok) {
      sboxDbg('move SKIP: ray parallel to drag plane', { axis: ds.axis })
      return
    }

    const delta =
      ds.axis === 'x'
        ? intersectPt.x - ds.dragStartIntersectX
        : ds.axis === 'y'
          ? intersectPt.y - ds.dragStartIntersectY
          : intersectPt.z - ds.dragStartIntersectZ
    const newAxisWorld = ds.dragStartAxisWorld + delta
    moveSectionBoxFace(ds.faceKey, ds.axis, ds.dir, ds.tKey, newAxisWorld)
    sboxDbgMoveThrottled('move OK', {
      axis: ds.axis,
      newAxisWorld,
      ndc: [ndc.x, ndc.y],
    })

    if (sboxArrow && sboxActiveFaceKey === ds.faceKey) {
      const min = sboxWorldMin()
      const max = sboxWorldMax()
      const center = new THREE.Vector3()
      new THREE.Box3(min, max).getCenter(center)
      const newFacePos = new THREE.Vector3(
        ds.axis === 'x' ? (ds.dir > 0 ? max.x : min.x) : center.x,
        ds.axis === 'y' ? (ds.dir > 0 ? max.y : min.y) : center.y,
        ds.axis === 'z' ? (ds.dir > 0 ? max.z : min.z) : center.z
      )
      const arrowDir = new THREE.Vector3(
        ds.axis === 'x' ? ds.dir : 0,
        ds.axis === 'y' ? ds.dir : 0,
        ds.axis === 'z' ? ds.dir : 0
      )
      const pad = sboxFaceArrowPadWorld()
      sboxArrow.position.copy(newFacePos).addScaledVector(arrowDir, pad)
      const sz = new THREE.Vector3()
      new THREE.Box3(min, max).getSize(sz)
      const dragArrowLen = Math.max(sz.x, sz.y, sz.z) * 0.25
      const hitMesh = sboxArrow.userData.hitMesh as THREE.Mesh | undefined
      if (hitMesh) {
        hitMesh.position.copy(sboxArrow.position).addScaledVector(arrowDir, dragArrowLen * 0.85)
      }
    }
    ;(worldRef.renderer as OBCF.PostproductionRenderer).needsUpdate = true
  }

  sboxPointerMoveHandler = (e: PointerEvent) => {
    if (!sboxDragState || clipMode.value !== 'box') {
      return
    }
    e.stopPropagation()
    e.stopImmediatePropagation()
    if (!worldRef) {
      sboxDbg('move SKIP: worldRef null')
      return
    }
    sboxDragPendingClientX = e.clientX
    sboxDragPendingClientY = e.clientY
    if (sboxDragMoveRaf === 0) {
      sboxDragMoveRaf = requestAnimationFrame(() => {
        sboxDragMoveRaf = 0
        flushSboxPointerDragMove()
      })
    }
  }

  sboxPointerUpHandler = () => {
    if (sboxDragState) {
      if (sboxDragMoveRaf !== 0) {
        cancelAnimationFrame(sboxDragMoveRaf)
        sboxDragMoveRaf = 0
        flushSboxPointerDragMove()
      }
      sboxDbg('drag END (pointerup)', { was: { ...sboxDragState } })
      sboxDragState = null
      if (worldRef?.camera.hasCameraControls()) {
        worldRef.camera.controls.enabled = true
      }
      if (worldRef?.renderer) {
        worldRef.renderer.three.domElement.style.cursor = ''
      }
      void componentsRef.value?.get(OBC.FragmentsManager).core.update(true)
    }
  }

  // Hover highlight (separate handler, no capture needed)
  sboxHoverMoveHandler = (e: PointerEvent) => {
    if (clipMode.value !== 'box' || sboxDragState) return
    updateSboxFaceHover(e.clientX, e.clientY)

    if (sboxArrow && worldRef?.renderer) {
      clientToNdc(e.clientX, e.clientY)
      raycaster.setFromCamera(ndc, worldRef.camera.three)
      const hitMesh = sboxArrow.userData.hitMesh as THREE.Mesh | undefined
      const h = hitMesh ? raycaster.intersectObject(hitMesh, false) : []
      const overArrow = h.length > 0
      worldRef.renderer.three.domElement.style.cursor = overArrow ? 'grab' : ''
      applySboxArrowHoverVisual(overArrow)
    }
  }

  sboxPointerLeaveHandler = () => {
    if (clipMode.value !== 'box') return
    applySboxArrowHoverVisual(false)
    if (worldRef?.renderer) worldRef.renderer.three.domElement.style.cursor = ''
  }

  // ★ KEY: capture:true so this fires before OBC's bubble-phase listeners
  dom.addEventListener('pointerdown', sboxPointerDownHandler, { capture: true })
  dom.addEventListener('pointermove', sboxPointerMoveHandler, { capture: true })
  dom.addEventListener('pointerup', sboxPointerUpHandler)
  dom.addEventListener('pointercancel', sboxPointerUpHandler)
  dom.addEventListener('pointermove', sboxHoverMoveHandler, { passive: true })
  dom.addEventListener('pointerleave', sboxPointerLeaveHandler)
}

function destroySectionBox() {
  if (sboxDragMoveRaf !== 0) {
    cancelAnimationFrame(sboxDragMoveRaf)
    sboxDragMoveRaf = 0
  }
  hideSboxFaceArrow()
  destroySectionBoxVisuals()
  sboxPlanes = []
  clearPlanesFromModels()
  if (worldRef?.renderer) {
    const renderer = worldRef.renderer as OBCF.PostproductionRenderer
    const dom = renderer.three.domElement
    if (sboxPointerDownHandler)
      dom.removeEventListener('pointerdown', sboxPointerDownHandler, { capture: true })
    if (sboxPointerMoveHandler)
      dom.removeEventListener('pointermove', sboxPointerMoveHandler, { capture: true })
    if (sboxPointerUpHandler) {
      dom.removeEventListener('pointerup', sboxPointerUpHandler)
      dom.removeEventListener('pointercancel', sboxPointerUpHandler)
    }
    if (sboxHoverMoveHandler) dom.removeEventListener('pointermove', sboxHoverMoveHandler)
    if (sboxPointerLeaveHandler) dom.removeEventListener('pointerleave', sboxPointerLeaveHandler)
  }
  sboxPointerDownHandler = null
  sboxPointerMoveHandler = null
  sboxPointerUpHandler = null
  sboxHoverMoveHandler = null
  sboxPointerLeaveHandler = null
  sboxDragState = null
}

async function enableSectionBox() {
  const components = componentsRef.value
  if (!components || !worldRef) return

  clearAllClipsAndSection()
  updateSceneClipBoundingRanges()

  const min = sboxWorldMin()
  const max = sboxWorldMax()

  sboxPlanes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), max.x),
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -min.x),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), max.y),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -min.y),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), max.z),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -min.z),
  ]

  applyPlanesToModels()
  clipMode.value = 'box'
  if (worldRef.renderer) {
    ;(worldRef.renderer as OBCF.PostproductionRenderer).postproduction.enabled = false
  }
  buildSectionBoxVisuals(min, max)
  attachSectionBoxPointerListeners()
  void components.get(OBC.FragmentsManager).core.update(true)
}

// ───────────────────────────────────────────────────────────────

function syncAxisCutSlidersFromActivePlane() {
  const components = componentsRef.value
  if (!components || !worldRef) return
  const planeId = axisCutPlaneId.value
  const mode = clipMode.value
  if (!planeId || mode === 'off' || mode === 'box') return
  const plane = components.get(OBC.Clipper).list.get(planeId)
  if (!plane) return
  const wp = new THREE.Vector3()
  plane.helper.getWorldPosition(wp)
  if (mode === 'x') {
    const r = sceneXRange.value
    if (!r || r.max <= r.min) return
    axisCutTX.value = Math.min(1, Math.max(0, (wp.x - r.min) / (r.max - r.min)))
  } else if (mode === 'y') {
    const r = sceneYRange.value
    if (!r || r.max <= r.min) return
    axisCutTY.value = Math.min(1, Math.max(0, (wp.y - r.min) / (r.max - r.min)))
  } else {
    const r = sceneZRange.value
    if (!r || r.max <= r.min) return
    axisCutTZ.value = Math.min(1, Math.max(0, (wp.z - r.min) / (r.max - r.min)))
  }
}

function ifcProgressFromCallback(p: unknown): number {
  if (typeof p !== 'number' || !Number.isFinite(p)) return 0
  const x = p <= 1 && p >= 0 ? p * 100 : p
  return Math.round(Math.min(100, Math.max(0, x)))
}

async function loadIfcFile(file: File) {
  console.log('loadIfcFile entered', file?.name)
  const components = componentsRef.value
  if (!components || !worldRef) {
    error.value = '檢視器尚未就緒，請稍候畫面載入完成後再試。'
    return
  }
  loading.value = true
  loadingIfc.value = true
  ifcProgressPercent.value = 1
  ifcLoadHint.value = ''
  error.value = ''
  let ifcModelId: string | null = null
  let stallHintTimer: ReturnType<typeof setTimeout> | null = null
  const clearStallHint = () => {
    if (stallHintTimer !== null) {
      clearTimeout(stallHintTimer)
      stallHintTimer = null
    }
    ifcLoadHint.value = ''
  }
  try {
    await nextTick()
    const fragmentsForClear = components.get(OBC.FragmentsManager)
    const hasExistingFragmentModels = [...fragmentsForClear.list.keys()].length > 0
    if (hasExistingFragmentModels) {
      status.value = `IFC：正在清空場景…（${file.name}）`
      await nextTick()
      console.log('清空場景開始')
      await disposeAllFragmentModels()
      console.log('清空場景完成')
    }
    console.log('開始解析 IFC')

    status.value = `IFC：讀取檔案到記憶體…（${file.name}）`
    ifcProgressPercent.value = 5
    await nextTick()
    const buf = new Uint8Array(await file.arrayBuffer())

    status.value = `IFC：轉換模型…（${file.name}）`
    ifcProgressPercent.value = 8
    await nextTick()

    const ifcLoader = components.get(OBC.IfcLoader)
    ifcModelId = nextModelId('ifc')
    fragModelLabels[ifcModelId] = file.name

    stallHintTimer = setTimeout(() => {
      if (!loadingIfc.value) return
      if (ifcProgressPercent.value >= 10) return
      ifcLoadHint.value =
        '已超過約 45 秒進度仍偏低：大型 IFC 首次轉換可能需數分鐘。請勿關閉分頁；若長時間完全沒變化，請按 F12 開啟開發者工具查看 Console 是否有紅色錯誤。'
    }, 45_000)

    console.log('ifcLoader.load 開始')
    const model = await ifcLoader.load(buf, true, ifcModelId, {
      processData: {
        progressCallback: (p, data) => {
          const pct = ifcProgressFromCallback(p)
          if (pct > 0) {
            ifcProgressPercent.value = pct
          }
          const phase =
            data?.process === 'geometries'
              ? '幾何'
              : data?.process === 'attributes'
                ? '屬性'
                : data?.process === 'relations'
                  ? '關聯'
                  : data?.process === 'conversion'
                    ? '轉換'
                    : ''
          if (phase) {
            status.value = `IFC：${phase} ${pct || '…'}% — ${file.name}`
          } else if (pct > 0) {
            status.value = `IFC：轉換中 ${pct}% — ${file.name}`
          }
        },
      },
    })
    console.log('ifcLoader.load 完成', model)
    if (!model?.object) {
      throw new Error('IFC 載入完成但未取得模型物件（FragmentsModel）')
    }

    const root = model.object
    console.log('model:', model)
    console.log('children count:', root.children.length, '(THREE 根節點為 model.object)')
    console.log('model.object position:', root.position)

    model.useCamera(worldRef.camera.three)
    worldRef.scene.three.add(root)

    root.updateWorldMatrix(true, true)
    const bbox = new THREE.Box3().setFromObject(root)
    if (bbox.isEmpty() || !Number.isFinite(bbox.min.x)) {
      console.warn('[IfcViewer] IFC bbox 仍為空，嘗試 fragments.core.update 後重算')
      await components.get(OBC.FragmentsManager).core.update(true)
      await nextTick()
      root.updateWorldMatrix(true, true)
      bbox.setFromObject(root)
    }
    if (!bbox.isEmpty() && Number.isFinite(bbox.min.x) && worldRef.camera.hasCameraControls()) {
      const center = bbox.getCenter(new THREE.Vector3())
      const size = bbox.getSize(new THREE.Vector3())
      const distance = Math.max(size.length(), 1)
      await worldRef.camera.controls.setLookAt(
        center.x + distance,
        center.y + distance,
        center.z + distance,
        center.x,
        center.y,
        center.z,
        true
      )
    } else {
      await fitCameraToScene()
    }
    void components.get(OBC.FragmentsManager).core.update(true)
    ;(worldRef.renderer as OBCF.PostproductionRenderer).needsUpdate = true

    clearStallHint()
    status.value = `已載入 IFC：${file.name}`
    syncLoadedModelRows()
  } catch (e) {
    clearStallHint()
    if (ifcModelId) delete fragModelLabels[ifcModelId]
    const msg = e instanceof Error ? e.message : String(e)
    error.value = `IFC 載入失敗：${msg}`
    status.value = ''
    console.error('[IfcViewer] loadIfcFile', e)
  } finally {
    clearStallHint()
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
  updateSceneClipBoundingRanges()
  void fragments.core.update(true)
}

async function loadExampleFrag(url: string, label: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${label}`)
  await loadFragBuffer(await res.arrayBuffer(), label, false)
}

function loadIFC(ev: Event) {
  const input = ev.target as HTMLInputElement
  console.log('loadIFC called')
  console.log('file:', input.files?.[0])
  const ifcLoader = componentsRef.value?.get(OBC.IfcLoader)
  console.log('ifcLoader ready:', ifcLoader)
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
    if (clearFragSceneBeforeLoad.value) await disposeAllFragmentModels()
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
    updateSceneClipBoundingRanges()
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
  const isolate = storeyIsolateName.value
  for (const n of storeyNames.value) {
    const data = classifier.getGroupData(STOREYS_CLASS, n)
    const map = await data.get()
    const visible =
      isolate !== null ? n === isolate : storeyVisible[n] !== false
    await hider.set(visible, map)
  }
  await fragments.core.update(true)
}

function storeyRowChecked(name: string): boolean {
  const isolate = storeyIsolateName.value
  if (isolate !== null) return name === isolate
  return storeyVisible[name] !== false
}

async function onStoreyCheckChange(name: string, checked: boolean) {
  storeyIsolateName.value = null
  storeyVisible[name] = checked
  await applyStoreyHiderFromChecks()
}

async function showAllStoreys() {
  storeyIsolateName.value = null
  for (const n of storeyNames.value) storeyVisible[n] = true
  await applyStoreyHiderFromChecks()
}

async function focusStorey(name: string) {
  if (!storeyNames.value.includes(name)) return
  const components = componentsRef.value
  if (!components || !worldRef) return
  if (freeRoamActive.value) await exitFreeRoamMode()
  storeyIsolateName.value = name
  await applyStoreyHiderFromChecks()
  try {
    const classifier = components.get(OBC.Classifier)
    const data = classifier.getGroupData(STOREYS_CLASS, name)
    const map = await data.get()
    if (map && Object.keys(map).length > 0) {
      await worldRef.camera.fitToItems(map)
    }
  } catch {
    /* ignore */
  }
}

function clearAllClipsAndSection() {
  destroySectionBox()
  sboxPlanes = []
  activeSectionClipEdges = null
  clipPlanePointerOverPlane = false
  clipPlaneDecorDragging = false
  const clipperClear = componentsRef.value?.get(OBC.Clipper)
  if (clipperClear) clipperClear.enabled = true
  clipperClear?.deleteAll()
  clipMode.value = 'off'
  if (worldRef?.renderer) {
    ;(worldRef.renderer as OBCF.PostproductionRenderer).postproduction.enabled = true
  }
  axisCutPlaneId.value = null
  void componentsRef.value?.get(OBC.FragmentsManager).core.update(true)
  if (clipMode.value === 'off' && worldRef?.renderer) {
    worldRef.renderer.three.localClippingEnabled = false
  }
}

async function enableAxisCutPlane(axis: 'x' | 'y' | 'z') {
  const components = componentsRef.value
  if (!components || !worldRef) return
  components.get(OBC.Clipper).enabled = true
  updateSceneClipBoundingRanges()
  applyClipperPlaneGizmoSize()
  if (axis === 'x' && !sceneXRange.value) return
  if (axis === 'y' && !sceneYRange.value) return
  if (axis === 'z' && !sceneZRange.value) return
  clearAllClipsAndSection()
  const clipper = components.get(OBC.Clipper)
  let id: string
  if (axis === 'x')
    id = clipper.createFromNormalAndCoplanarPoint(
      worldRef,
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(worldXFromAxisT(), 0, 0)
    )
  else if (axis === 'y')
    id = clipper.createFromNormalAndCoplanarPoint(
      worldRef,
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, worldYFromAxisT(), 0)
    )
  else
    id = clipper.createFromNormalAndCoplanarPoint(
      worldRef,
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0, worldZFromAxisT())
    )
  axisCutPlaneId.value = id
  clipMode.value = axis
  const r = worldRef.renderer
  if (r) r.three.localClippingEnabled = true
  void components.get(OBC.FragmentsManager).core.update(true)
}

async function toggleAxisCutQuick(axis: 'x' | 'y' | 'z') {
  if (!componentsRef.value || !worldRef) return
  if (clipMode.value === axis) {
    clearAllClipsAndSection()
    return
  }
  await enableAxisCutPlane(axis)
}

async function resetCameraView() {
  if (!worldRef?.camera?.controls) return
  await worldRef.camera.controls.setLookAt(78, 20, -2.2, 26, -4, 25)
}

function applyViewerCameraControlParams(c: CameraControls) {
  c.dollySpeed = 0.22
  c.minDistance = 1
  c.maxDistance = 500
  c.dollyToCursor = true
  c.smoothTime = 0.28
  c.draggingSmoothTime = 0.1
  const withPinch = c as CameraControls & { pinchSpeed?: number }
  withPinch.pinchSpeed = 0.3
}

function getSceneBoundingInfo() {
  const computed = computeSceneBoundingBox()
  const center = new THREE.Vector3(0, 5, 0),
    size = new THREE.Vector3(50, 50, 50)
  if (computed && !computed.isEmpty()) {
    computed.getCenter(center)
    computed.getSize(size)
  }
  return { center, size, dist: Math.max(size.x, size.y, size.z, 1) * 1.8 }
}

function applyOrbitPointerBindings() {
  if (!worldRef?.camera.hasCameraControls()) return
  const c = worldRef.camera.controls
  const isPerspective = worldRef.camera.three instanceof THREE.PerspectiveCamera
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
  if (mode === 'Orbit') applyOrbitPointerBindings()
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
  const { center, dist: d } = getSceneBoundingInfo()
  const c = worldRef.camera.controls
  if (preset === 'top')
    await c.setLookAt(center.x, center.y + d, center.z, center.x, center.y, center.z)
  else if (preset === 'front')
    await c.setLookAt(center.x, center.y, center.z + d, center.x, center.y, center.z)
  else if (preset === 'right')
    await c.setLookAt(center.x + d, center.y, center.z, center.x, center.y, center.z)
  else if (preset === 'iso')
    await c.setLookAt(
      center.x + d * 0.75,
      center.y + d * 0.55,
      center.z + d * 0.75,
      center.x,
      center.y,
      center.z
    )
}

function triggerIfcPicker() {
  ifcFileInputRef.value?.click()
}
function triggerFragPicker() {
  fragFileInputRef.value?.click()
}
/** 必須在使用者點擊的同步路徑內呼叫 input.click()，否則 Safari／部分瀏覽器會擋檔案選擇器 */
function pickIfcAndCloseLoadPopover() {
  triggerIfcPicker()
  loadFilesPopoverOpen.value = false
}
function pickFragAndCloseLoadPopover() {
  triggerFragPicker()
  loadFilesPopoverOpen.value = false
}

function toggleFullscreen() {
  const el = viewerShellRef.value
  if (!el) return
  if (!document.fullscreenElement) void el.requestFullscreen()
  else void document.exitFullscreen()
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
      <p
        v-if="error"
        role="alert"
        class="text-destructive border-destructive/30 bg-destructive/5 w-full rounded-md border px-2 py-1.5 text-xs sm:order-first"
      >
        {{ error }}
      </p>
      <p
        v-if="ifcLoadHint"
        class="text-foreground w-full rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs sm:order-first"
      >
        {{ ifcLoadHint }}
      </p>
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <Label class="text-muted-foreground shrink-0 text-xs">IFC</Label>
        <input
          ref="ifcFileInputRef"
          type="file"
          accept=".ifc"
          class="text-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-background file:px-2 file:py-1.5 file:text-sm"
          :disabled="loading"
          @change="loadIFC"
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
            >清空全部</Button
          >
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
        <Button type="button" size="sm" variant="outline" :disabled="loading" @click="onSampleArq"
          >Sample school_arq.frag</Button
        >
        <Button type="button" size="sm" variant="outline" :disabled="loading" @click="onSampleStr"
          >Sample school_str.frag</Button
        >
      </div>
      <div v-if="loadingIfc" class="w-full sm:max-w-xs">
        <div class="text-muted-foreground mb-1 flex justify-between text-xs">
          <span>IFC 載入中</span><span>{{ ifcProgressPercent }}%</span>
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
    </div>

    <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
      <aside
        class="border-border bg-card order-2 flex max-h-[min(40vh,16rem)] min-h-0 w-full shrink-0 flex-col border-t md:order-none md:max-h-none md:w-[min(15rem,calc(100vw-1rem))] md:border-b-0 md:border-l-0 md:border-r md:border-t-0"
      >
        <div class="border-border shrink-0 border-b px-3 py-2">
          <h2 class="text-foreground text-sm font-semibold tracking-tight">樓層</h2>
          <p class="text-muted-foreground mt-1 text-xs leading-snug">
            勾選顯示或隱藏；點樓層名稱僅顯示該層並對焦視角。
          </p>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <p
            v-if="storeyNames.length === 0"
            class="text-muted-foreground text-xs leading-relaxed"
            role="status"
          >
            {{ STOREY_PANEL_EMPTY_MSG }}
          </p>
          <template v-else>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              class="mb-3 h-8 w-full shrink-0"
              @click="void showAllStoreys()"
              >全部顯示</Button
            >
            <ul class="space-y-0.5">
              <li v-for="name in storeyNames" :key="name">
                <div
                  class="hover:bg-muted/50 flex min-h-9 items-center gap-2 rounded-md px-1.5 py-1"
                  :class="storeyIsolateName === name ? 'bg-primary/10' : ''"
                >
                  <Checkbox
                    :id="`ifc-storey-panel-${name}`"
                    class="size-3.5 shrink-0"
                    :checked="storeyRowChecked(name)"
                    @update:checked="(c) => void onStoreyCheckChange(name, c === true)"
                  />
                  <button
                    type="button"
                    class="text-foreground min-w-0 flex-1 truncate text-left text-xs font-normal leading-snug"
                    @click="void focusStorey(name)"
                  >
                    {{ name }}
                  </button>
                </div>
              </li>
            </ul>
          </template>
        </div>
      </aside>
      <div class="relative order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:order-none">
        <div
          ref="containerRef"
          class="ifc-viewer-canvas-host min-h-0 min-w-0 flex-1"
          :class="freeRoamActive && !showRoamVirtualSticks ? 'cursor-none' : ''"
        />

        <!-- 桌面漫遊：螢幕中央準星 -->
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

        <!-- 漫遊模式：手機雙搖桿 -->
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

        <!-- 底部工具列 -->
        <div
          class="pointer-events-none absolute inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-30 flex justify-center px-2 md:bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]"
        >
          <TooltipProvider :delay-duration="350">
            <div
              class="pointer-events-auto flex max-w-[min(100vw-1rem,56rem)] flex-wrap items-center justify-center gap-2"
            >
              <!-- 導覽 -->
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
                  <TooltipContent side="top">平移：Orbit 下主按鈕改為拖曳平移</TooltipContent>
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
                  <TooltipContent side="top">平面（2D）</TooltipContent>
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
                      freeRoamActive ? '結束漫遊' : '第一人稱漫遊（WASD、左鍵點準星選取／拖曳轉向）'
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
                  <TooltipContent side="top">符合視窗</TooltipContent>
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
                          <DropdownMenuItem class="cursor-pointer" @click="setViewPreset('top')"
                            >俯視</DropdownMenuItem
                          >
                          <DropdownMenuItem class="cursor-pointer" @click="setViewPreset('front')"
                            >前視</DropdownMenuItem
                          >
                          <DropdownMenuItem class="cursor-pointer" @click="setViewPreset('right')"
                            >右視</DropdownMenuItem
                          >
                          <DropdownMenuItem class="cursor-pointer" @click="setViewPreset('iso')"
                            >等角</DropdownMenuItem
                          >
                          <DropdownMenuItem class="cursor-pointer" @click="setViewPreset('reset')"
                            >重置為預設視角</DropdownMenuItem
                          >
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

                <!-- 單面剖切 X/Y/Z -->
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
                              clipMode === 'x' || clipMode === 'y' || clipMode === 'z'
                                ? 'border-primary/50 bg-primary/10 text-primary'
                                : ''
                            "
                            aria-label="剖切軸向（X／Y／Z）"
                          >
                            <Scissors class="size-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="center"
                          side="top"
                          :side-offset="8"
                          class="border-border bg-card text-foreground z-[60] w-auto min-w-0 rounded-xl border p-1 shadow-lg"
                        >
                          <div
                            class="flex flex-col items-stretch gap-0.5"
                            role="toolbar"
                            aria-label="剖切軸向"
                          >
                            <Tooltip>
                              <TooltipTrigger as-child>
                                <button
                                  type="button"
                                  class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/70 disabled:pointer-events-none disabled:opacity-50"
                                  :disabled="!viewerCanvasReady || !sceneXRange"
                                  :class="
                                    clipMode === 'x'
                                      ? 'border-primary/50 bg-primary/10 text-primary'
                                      : 'border-transparent text-foreground hover:bg-muted/80'
                                  "
                                  aria-label="X 軸剖切"
                                  @click="void toggleAxisCutQuick('x')"
                                >
                                  <RectangleVertical class="size-5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right"
                                >X 軸（YZ 平面），再點關閉</TooltipContent
                              >
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger as-child>
                                <button
                                  type="button"
                                  class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/70 disabled:pointer-events-none disabled:opacity-50"
                                  :disabled="!viewerCanvasReady || !sceneYRange"
                                  :class="
                                    clipMode === 'y'
                                      ? 'border-primary/50 bg-primary/10 text-primary'
                                      : 'border-transparent text-foreground hover:bg-muted/80'
                                  "
                                  aria-label="Y 軸剖切"
                                  @click="void toggleAxisCutQuick('y')"
                                >
                                  <RectangleHorizontal class="size-5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right"
                                >Y 軸（XZ 平面），再點關閉</TooltipContent
                              >
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger as-child>
                                <button
                                  type="button"
                                  class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/70 disabled:pointer-events-none disabled:opacity-50"
                                  :disabled="!viewerCanvasReady || !sceneZRange"
                                  :class="
                                    clipMode === 'z'
                                      ? 'border-primary/50 bg-primary/10 text-primary'
                                      : 'border-transparent text-foreground hover:bg-muted/80'
                                  "
                                  aria-label="Z 軸剖切"
                                  @click="void toggleAxisCutQuick('z')"
                                >
                                  <SquareStack class="size-5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right"
                                >Z 軸（XY 平面），再點關閉</TooltipContent
                              >
                            </Tooltip>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">單面剖切 X／Y／Z</TooltipContent>
                </Tooltip>

                <!-- Section Box -->
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      :disabled="
                        !viewerCanvasReady || (!sceneXRange && !sceneYRange && !sceneZRange)
                      "
                      class="relative size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                      :class="
                        clipMode === 'box' ? 'border-primary/50 bg-primary/10 text-primary' : ''
                      "
                      aria-label="Section Box（六面框切）"
                      @click="
                        clipMode === 'box' ? clearAllClipsAndSection() : void enableSectionBox()
                      "
                    >
                      <BoxSelect class="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Section Box：拖曳任一面調整；再點關閉</TooltipContent>
                </Tooltip>

                <!-- 載入 -->
                <Popover v-model:open="loadFilesPopoverOpen">
                  <PopoverTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      :disabled="loading"
                      class="size-11 min-h-11 min-w-11 shrink-0 rounded-lg"
                      :class="
                        loadFilesPopoverOpen ? 'border-primary/50 bg-primary/10 text-primary' : ''
                      "
                      aria-label="載入模型"
                    >
                      <Package class="size-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="center"
                    class="border-border bg-popover text-popover-foreground w-[min(calc(100vw-1rem),20rem)] p-0 shadow-lg"
                  >
                    <div class="border-border flex items-center justify-between border-b px-3 py-2">
                      <span class="text-sm font-medium">載入模型</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="text-muted-foreground h-8 w-8 shrink-0"
                        aria-label="關閉"
                        @click="loadFilesPopoverOpen = false"
                      >
                        <X class="size-4" />
                      </Button>
                    </div>
                    <Tabs v-model="loadFilesTab" class="gap-0">
                      <TabsList
                        class="bg-muted text-muted-foreground grid h-9 w-full grid-cols-2 rounded-none border-b p-0"
                      >
                        <TabsTrigger
                          value="ifc"
                          class="rounded-none data-[state=active]:shadow-none"
                          >IFC</TabsTrigger
                        >
                        <TabsTrigger
                          value="frag"
                          class="rounded-none data-[state=active]:shadow-none"
                          >FRAG</TabsTrigger
                        >
                      </TabsList>
                      <TabsContent value="ifc" class="mt-0 space-y-2 p-3">
                        <p class="text-muted-foreground text-xs">選擇 .ifc 檔案匯入。</p>
                        <Button
                          type="button"
                          size="sm"
                          class="h-8 w-full"
                          :disabled="loading"
                          @click="pickIfcAndCloseLoadPopover"
                          >選擇 IFC 檔案</Button
                        >
                      </TabsContent>
                      <TabsContent value="frag" class="mt-0 space-y-2 p-3">
                        <p class="text-muted-foreground text-xs">選擇 .frag 檔案（可複選）。</p>
                        <Button
                          type="button"
                          size="sm"
                          class="h-8 w-full"
                          :disabled="loading"
                          @click="pickFragAndCloseLoadPopover"
                          >選擇 FRAG 檔案</Button
                        >
                      </TabsContent>
                    </Tabs>
                  </PopoverContent>
                </Popover>
              </div>

              <!-- 屬性、設定、全螢幕 -->
              <div
                class="border-border bg-card flex items-center gap-0.5 rounded-xl border p-1 shadow-lg"
              >
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
                  <TooltipContent side="top">顯示／隱藏頂部載入區</TooltipContent>
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
            </div>
          </TooltipProvider>
        </div>
      </div>

      <!-- 屬性面板 -->
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
            ><X class="size-5"
          /></Button>
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
  </div>
</template>

<style scoped>
.ifc-viewer-canvas-host :deep(canvas) {
  touch-action: none;
}
</style>
