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

/** 產生一組符合 RFC 5766 的 ice-ufrag（4–256 字元）與 ice-pwd（22–256 字元） */
function generateIceCredentials(): { ufrag: string; pwd: string } {
  const ufrag = Math.random().toString(36).slice(2, 10)
  const pwd = Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 14)
  return { ufrag, pwd }
}

/**
 * 為 SDP 補上 ice-ufrag/ice-pwd，避免 SetRemoteDescription 報錯。
 * @param sdp - 原始 SDP 字串
 * @param singleIce - 若為 true（用於送給 mediamtx 的 offer），先移除所有既有 ice 行，再整份 SDP 只插入一組（Pion 要求）；若為 false（answer），每個 m= 區塊可各自補一組
 */
function ensureIceInSdp(sdp: string, singleIce = false): string {
  const sep = sdp.includes('\r\n') ? '\r\n' : '\n'
  let lines = sdp.includes('\r\n') ? sdp.split('\r\n') : sdp.split('\n')

  // 送給 mediamtx 的 offer：先移除所有既有的 ice 行（可能為空或與 Pion 不相容），再強制插入唯一一組
  if (singleIce) {
    lines = lines.filter((l) => !l.startsWith('a=ice-ufrag:') && !l.startsWith('a=ice-pwd:'))
  }

  const out: string[] = []
  let needIce = false
  const sessionIce = singleIce ? generateIceCredentials() : null

  const pushIce = (cred: { ufrag: string; pwd: string }) => {
    out.push(`a=ice-ufrag:${cred.ufrag}`, `a=ice-pwd:${cred.pwd}`)
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('m=')) {
      if (needIce) {
        pushIce(sessionIce ?? generateIceCredentials())
        needIce = false
      }
      if (sessionIce && !out.some((l) => l.startsWith('a=ice-ufrag:'))) {
        pushIce(sessionIce)
      }
      out.push(line)
      needIce = true
    } else if (needIce && line.startsWith('a=')) {
      const isUfrag = line.startsWith('a=ice-ufrag:')
      const isPwd = line.startsWith('a=ice-pwd:')
      const isIce = isUfrag || isPwd
      const value = line.slice(line.indexOf(':') + 1).trim()
      const invalidUfrag = isUfrag && value.length < 4
      const invalidPwd = isPwd && value.length < 22
      const invalidIce = isIce && (invalidUfrag || invalidPwd)
      if (!isIce) {
        pushIce(sessionIce ?? generateIceCredentials())
        needIce = false
        out.push(line)
      } else if (invalidIce) {
        pushIce(sessionIce ?? generateIceCredentials())
        needIce = false
      } else {
        needIce = false
        out.push(line)
      }
    } else {
      if (line.startsWith('a=ice-ufrag:') || line.startsWith('a=ice-pwd:')) needIce = false
      out.push(line)
    }
  }
  if (needIce) {
    pushIce(sessionIce ?? generateIceCredentials())
  }
  if (singleIce && sessionIce && !out.some((l) => l.startsWith('a=ice-ufrag:'))) {
    out.push(`a=ice-ufrag:${sessionIce.ufrag}`, `a=ice-pwd:${sessionIce.pwd}`)
  }
  return out.join(sep)
}

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
      pc.addTransceiver('video', { direction: 'recvonly' })
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
      // 等 ICE 收集完成再送 offer；若 5 秒內未完成也送出，避免部分環境永遠不 complete 導致一直 loading
      const conn = pc
      if (conn.iceGatheringState !== 'complete') {
        await Promise.race([
          new Promise<void>((resolve) => {
            const onState = () => {
              if (conn.iceGatheringState === 'complete') {
                conn.onicegatheringstatechange = null
                resolve()
              }
            }
            conn.onicegatheringstatechange = onState
            if (conn.iceGatheringState === 'complete') resolve()
          }),
          new Promise<void>((r) => setTimeout(r, 5000)),
        ])
      }
      // mediamtx（Pion WebRTC）會對我們送出的 offer 做 setRemoteDescription；若 offer 缺少 ice-ufrag 會報錯。
      // Pion 要求整份 SDP 只用同一組 ice（bundled），故用 ensureIceInSdp(offer, true)。
      const offerSdp = pc.localDescription?.sdp ?? ''
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp', Accept: 'application/sdp' },
        body: ensureIceInSdp(offerSdp, true),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
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
      const sdp = ensureIceInSdp(body)
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }))
      // 若 WebRTC 連線失敗（ICE 等），顯示錯誤而非一直空白
      const peerConn = pc
      peerConn.onconnectionstatechange = () => {
        if (peerConn.connectionState === 'failed') {
          error.value = '串流連線失敗（無法與伺服器建立連線，請檢查網路或防火牆）'
        }
      }
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
