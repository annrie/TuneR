import { defineStore } from 'pinia'
import type { Station } from '../types'
import { fetchIcyMetadata } from '../utils/icyMetadata'

let icecastPlayer: any = null
const nativeAudio = typeof window !== 'undefined' ? new Audio() : null

// 再生断の診断ログ: どのイベントが発火するかで
// CPU起因（waiting/stalled）・接続喪失（error/ended）・OS抑制（suspend）を切り分ける
if (nativeAudio) {
  const events = ['playing', 'waiting', 'stalled', 'suspend', 'ended', 'pause', 'error'] as const
  for (const ev of events) {
    nativeAudio.addEventListener(ev, () => {
      const err =
        ev === 'error' && nativeAudio.error
          ? ` code=${nativeAudio.error.code} message=${nativeAudio.error.message}`
          : ''
      console.info(
        `[audio] ${ev} readyState=${nativeAudio.readyState} networkState=${nativeAudio.networkState}${err}`
      )
    })
  }
}

// フォールバック経路(Rust経由のICY取得)のポーリングタイマー。
// IcecastMetadataPlayer が使えない環境では1回しか曲名を取れず固定化するため、
// 一定間隔で再取得して曲名を更新する。
let metadataTimer: ReturnType<typeof setInterval> | null = null
const METADATA_POLL_MS = 20_000

// IcecastMetadataPlayer は CORS で弾かれても内部で HTML5 再生に切り替えて
// play() を成功扱いにするため、「成功したがメタデータが一切来ない」状態になりうる。
// 一定時間 nowPlaying が空のままならフォールバックのポーリングを起動する。
const METADATA_WATCHDOG_MS = 10_000

// 再生断ウォッチドッグ & 自動再接続:
// WKWebViewは接続断時に error/ended を発火せず無音のまま「再生中」で固まる
// ことがあるため、イベントだけに頼らず timeupdate の停滞を一次検知に使う。
const STALL_TIMEOUT_MS = 10_000
const STALL_CHECK_MS = 2_000
// 再接続のバックオフ間隔。使い切ったら諦めて streamStatus を 'error' に落とす
// （局側の長時間障害ではリトライし続けても無駄なため）
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000]

let stallTimer: ReturnType<typeof setInterval> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempt = 0
let lastProgressAt = 0
let lastMediaTime = -1
let watchdogAttached = false

export type StreamStatus = 'idle' | 'playing' | 'reconnecting' | 'error'

export const usePlayerStore = defineStore('player', {
  state: () => ({
    currentStation: null as Station | null,
    isPlaying: false,
    volume: 0.8,
    nowPlaying: '' as string,
    streamStatus: 'idle' as StreamStatus,
    // 本番ビルドはコンソールが見えないため、直近のMediaErrorコードを
    // UIに出せるよう保持する（1:ABORTED 2:NETWORK 3:DECODE 4:SRC_NOT_SUPPORTED）
    lastErrorCode: null as number | null,
  }),
  actions: {
    async play(station: Station, opts?: { reconnect?: boolean }) {
      // ライブストリームは pause で接続が切れる（サーバ側 Connection: close）ため、
      // 同一局の再開でも常に接続を張り直す。分岐をなくして状態の食い違いも防ぐ。
      const isNewStation = this.currentStation?.stationuuid !== station.stationuuid
      this.currentStation = station
      if (isNewStation) this.nowPlaying = ''
      this.stopMetadataPolling()
      // 旧ストリームのストール監視が後段のasync初期化中に誤発火し、
      // 新しい局への再接続を予約してしまわないよう先に止める（後で張り直す）
      this.stopStallWatchdog()

      // 手動再生では再接続の試行回数をリセットする（自動再接続からの呼び出しでは維持）
      if (!opts?.reconnect) {
        reconnectAttempt = 0
        this.cancelReconnect()
        this.lastErrorCode = null
      }
      this.streamStatus = opts?.reconnect ? 'reconnecting' : 'playing'
      this.attachWatchdog()

      if (icecastPlayer) {
        icecastPlayer.stop()
        icecastPlayer = null
      }

      // 1. ネイティブ Audio で即座に再生
      if (nativeAudio) {
        nativeAudio.src = station.url_resolved
        nativeAudio.volume = this.volume
        // 前ストリームの再生位置を基準に残すと、位置リセットのイベントが
        // 発火しない環境で新ストリームの前進を検知できなくなるため初期化する
        lastMediaTime = -1
        nativeAudio.play().catch(e => console.error('Native playback error:', e))
      }

      // 2. IcecastMetadataPlayer でメタデータ取得
      // tauri:// プロトコルでは Worker が使えないため動的インポートで遅延ロード。
      // この play() 呼び出し中にメタデータが届いたかをウォッチドッグ判定に使う
      let metadataArrived = false
      try {
        const { default: IcecastMetadataPlayer } = await import('icecast-metadata-player')
        const player = new IcecastMetadataPlayer(station.url_resolved, {
          onMetadata: (metadata: any) => {
            // 局切替後に旧プレイヤーの残イベントが届いても無視する
            // （新しい局のポーリングを誤って止めないため）
            if (icecastPlayer !== player) return
            if (metadata?.StreamTitle) {
              metadataArrived = true
              this.nowPlaying = metadata.StreamTitle
              // メタデータ経路が生きていると分かったのでフォールバックは不要
              this.stopMetadataPolling()
              this.syncMediaSession()
            }
          }
        })
        icecastPlayer = player
        player.audioElement.muted = true
        player.play().catch((e: any) => {
          console.warn('IcecastMetadataPlayer failed:', e)
          // フォールバック: Rust経由で定期的に曲名を取得して更新
          if (icecastPlayer === player) this.startMetadataPolling(station.url_resolved)
        })
        // play() が成功したままメタデータが届かないケース（CORS遮断など）の見張り
        setTimeout(() => {
          if (
            icecastPlayer === player &&
            this.isPlaying &&
            !metadataArrived &&
            metadataTimer === null
          ) {
            console.info('[icy] no metadata within watchdog, starting fallback polling')
            this.startMetadataPolling(station.url_resolved)
          }
        }, METADATA_WATCHDOG_MS)
      } catch (e) {
        console.warn('IcecastMetadataPlayer import failed:', e)
        this.startMetadataPolling(station.url_resolved)
      }

      this.isPlaying = true
      this.startStallWatchdog()
      this.syncMediaSession()

      // ロック画面/コントロールセンターの再生・一時停止ボタンをアプリに接続
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => {
          if (this.currentStation) this.play(this.currentStation)
        })
        navigator.mediaSession.setActionHandler('pause', () => this.pause())
      }
    },

    pause() {
      this.isPlaying = false
      this.streamStatus = 'idle'
      this.cancelReconnect()
      this.stopStallWatchdog()
      if (nativeAudio) nativeAudio.pause()
      if (icecastPlayer) icecastPlayer.stop()
      this.stopMetadataPolling()
      this.syncMediaSession()
    },

    // OS(ロック画面/コントロールセンター)のNow Playing表示を更新する。
    // WKWebView(iOS 15+)/macOSとも Media Session API 経由で橋渡しされる。
    syncMediaSession() {
      if (!('mediaSession' in navigator) || !this.currentStation) return
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.nowPlaying || this.currentStation.name,
        artist: this.nowPlaying ? this.currentStation.name : '',
        artwork: this.currentStation.favicon ? [{ src: this.currentStation.favicon }] : [],
      })
      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused'
    },

    // フォールバック経路で曲名を一定間隔ポーリングして更新する。
    // 既存タイマーは必ず止めてから張り直すので二重起動・混線しない。
    startMetadataPolling(url: string) {
      this.stopMetadataPolling()
      console.info('[icy] fallback polling started:', url)
      const update = async () => {
        const title = await fetchIcyMetadata(url)
        console.debug('[icy] polled title:', JSON.stringify(title))
        if (title) {
          this.nowPlaying = title
          this.syncMediaSession()
        }
      }
      update() // まず即時に1回取得
      metadataTimer = setInterval(update, METADATA_POLL_MS)
    },

    stopMetadataPolling() {
      if (metadataTimer !== null) {
        clearInterval(metadataTimer)
        metadataTimer = null
      }
    },

    // ---- 再生断ウォッチドッグ & 自動再接続 ----

    attachWatchdog() {
      if (watchdogAttached || !nativeAudio) return
      watchdogAttached = true
      nativeAudio.addEventListener('timeupdate', () => this.onStreamProgress())
      // 'playing' は接続成立直後にデータが進まなくても発火しうるため、
      // 復旧判定には使わずストール判定の猶予を延ばすだけにする
      // （試行回数がリセットされ続けて give-up に到達しなくなるのを防ぐ）
      nativeAudio.addEventListener('playing', () => {
        lastProgressAt = Date.now()
      })
      nativeAudio.addEventListener('error', () => {
        this.lastErrorCode = nativeAudio?.error?.code ?? null
        this.onStreamBroken('error')
      })
      nativeAudio.addEventListener('ended', () => this.onStreamBroken('ended'))
    },

    onStreamProgress() {
      if (!nativeAudio) return
      // src再代入による位置リセットでも timeupdate は発火しうるため、
      // イベントの発生ではなく「再生位置が実際に前進した」ことを
      // 音声データが流れている根拠とする（偽の復旧判定で試行回数が
      // リセットされ続け give-up に到達しなくなるのを防ぐ）
      const t = nativeAudio.currentTime
      const advanced = t > lastMediaTime && t > 0
      lastMediaTime = t
      if (!advanced) return

      lastProgressAt = Date.now()
      if (this.streamStatus === 'reconnecting') {
        console.info('[reconnect] stream recovered')
        this.streamStatus = 'playing'
        reconnectAttempt = 0
        // バックオフ待機中に自然復旧した場合、予約済みの再接続が
        // 健全な再生を張り直してしまわないよう破棄する
        this.cancelReconnect()
      }
    },

    onStreamBroken(reason: string) {
      // 手動停止中・諦め済み・再接続待機中は何もしない
      if (!this.isPlaying || this.streamStatus === 'error') return
      if (reconnectTimer !== null) return
      console.warn(`[reconnect] stream broken (${reason})`)
      this.scheduleReconnect()
    },

    scheduleReconnect() {
      if (!this.currentStation) return
      if (reconnectAttempt >= RECONNECT_DELAYS_MS.length) {
        console.warn('[reconnect] giving up after max attempts')
        // pause() が streamStatus を 'idle' に戻すため、'error' は後から設定する
        this.pause()
        this.streamStatus = 'error'
        return
      }
      const delay = RECONNECT_DELAYS_MS[reconnectAttempt]
      reconnectAttempt++
      this.streamStatus = 'reconnecting'
      console.info(`[reconnect] attempt ${reconnectAttempt}/${RECONNECT_DELAYS_MS.length} in ${delay}ms`)
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        if (!this.isPlaying || !this.currentStation) return
        this.play(this.currentStation, { reconnect: true })
      }, delay)
    },

    cancelReconnect() {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    },

    startStallWatchdog() {
      this.stopStallWatchdog()
      lastProgressAt = Date.now()
      stallTimer = setInterval(() => {
        if (!this.isPlaying || reconnectTimer !== null) return
        if (Date.now() - lastProgressAt > STALL_TIMEOUT_MS) {
          this.onStreamBroken('stall')
        }
      }, STALL_CHECK_MS)
    },

    stopStallWatchdog() {
      if (stallTimer !== null) {
        clearInterval(stallTimer)
        stallTimer = null
      }
    },

    togglePlay(station: Station) {
      if (this.currentStation?.stationuuid === station.stationuuid) {
        if (this.isPlaying) this.pause()
        else this.play(station)
      } else {
        this.play(station)
      }
    },

    setVolume(vol: number) {
      this.volume = vol
      if (nativeAudio) {
        nativeAudio.volume = vol
      }
    }
  }
})
