import { ref, watch, onUnmounted, nextTick, type Ref } from 'vue'

/** mediamtx 官方 reader 載入後會掛在 window */
declare global {
  interface Window {
    MediaMTXWebRTCReader?: new (opts: {
      url: string
      onError?: (err: unknown) => void
      onTrack?: (evt: { streams: MediaStream[] }) => void
      close?: () => void
    }) => { close: () => void }
  }
}

const READER_SCRIPT_ID = 'mediamtx-reader-js'

function loadMediamtxReaderScript(baseUrl: string): Promise<void> {
  const scriptUrl = `${baseUrl.replace(/\/$/, '')}/reader.js`
  const existing = document.getElementById(READER_SCRIPT_ID) as HTMLScriptElement | null
  if (existing) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = READER_SCRIPT_ID
    script.src = scriptUrl
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('無法載入 reader.js'))
    document.head.appendChild(script)
  })
}

/**
 * 使用 WHEP 端點播放 WebRTC 串流（mediamtx 等）。
 * 若 URL 為 mediamtx（含 /whep），優先使用 mediamtx 官方的 MediaMTXWebRTCReader，避免 SDP 缺少 ice-ufrag 等問題。
 */
export function useWhepPlayer(whepUrl: Ref<string | null>) {
  const videoRef = ref<HTMLVideoElement | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** 已收到串流並綁定到 video（Vue 無法偵測 srcObject 變更，用此旗標驅動狀態文案） */
  const hasStream = ref(false)
  let readerInstance: { close: () => void } | null = null
  let pc: RTCPeerConnection | null = null

  function assignStreamToVideo(stream: MediaStream) {
    hasStream.value = true
    nextTick(() => {
      const el = videoRef.value
      if (el) {
        el.srcObject = stream
        el.play().catch(() => {})
      }
    })
  }

  async function connect() {
    const url = whepUrl.value
    if (!url) return
    loading.value = true
    error.value = null
    try {
      const baseUrl = url.replace(/\/[^/]+\/whep$/, '')
      const isMediamtxWhep = url.includes('/whep') && baseUrl.length > 0
      // 跨網域（前端 Vercel、mediamtx Railway）時 reader 會把 Location 解析成前端 origin，PATCH 送錯 → session not found。
      // mediamtx 一律改用手動 WHEP（僅 POST 取 answer），不依賴 reader。
      if (!isMediamtxWhep && typeof window !== 'undefined') {
        await loadMediamtxReaderScript(baseUrl)
        const Reader = window.MediaMTXWebRTCReader
        if (Reader) {
          readerInstance = new Reader({
            url,
            onError: (err) => {
              if (err instanceof Error) {
                error.value = err.message
              } else if (err && typeof err === 'object' && 'error' in err && typeof (err as { error: unknown }).error === 'string') {
                error.value = (err as { error: string }).error
              } else {
                error.value = '連線失敗'
              }
            },
            onTrack: (evt) => {
              if (evt.streams?.[0]) assignStreamToVideo(evt.streams[0])
            },
          })
          loading.value = false
          return
        }
      }
      // 手動 WHEP：POST offer 取 answer（mediamtx 跨網域時用此路徑，避免 reader PATCH 送錯）
      pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
      const stream = new MediaStream()
      pc.ontrack = (e) => {
        if (e.streams?.[0]) assignStreamToVideo(e.streams[0])
        else {
          stream.addTrack(e.track)
          assignStreamToVideo(stream)
        }
      }
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp', Accept: 'application/sdp' },
        body: pc.localDescription?.sdp ?? undefined,
      })
      const body = await res.text()
      if (!res.ok) {
        try {
          const j = JSON.parse(body) as { error?: string }
          if (j?.error) throw new Error(j.error)
        } catch (e) {
          if (e instanceof Error && e.message !== body) throw e
        }
        throw new Error(res.statusText || `HTTP ${res.status}`)
      }
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: body }))
    } catch (e) {
      error.value = e instanceof Error ? e.message : '連線失敗'
    } finally {
      loading.value = false
    }
  }

  function disconnect() {
    hasStream.value = false
    if (readerInstance) {
      try {
        readerInstance.close()
      } catch {
        // ignore
      }
      readerInstance = null
    }
    if (pc) {
      pc.close()
      pc = null
    }
    if (videoRef.value) {
      videoRef.value.srcObject = null
    }
  }

  watch(
    whepUrl,
    async (url) => {
      disconnect()
      if (url) {
        await nextTick()
        connect()
      }
    },
    { immediate: true }
  )

  onUnmounted(disconnect)

  return { videoRef, loading, error, hasStream, connect, disconnect }
}
