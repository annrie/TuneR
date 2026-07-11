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

export const usePlayerStore = defineStore('player', {
  state: () => ({
    currentStation: null as Station | null,
    isPlaying: false,
    volume: 0.8,
    nowPlaying: '' as string,
  }),
  actions: {
    async play(station: Station) {
      // ライブストリームは pause で接続が切れる（サーバ側 Connection: close）ため、
      // 同一局の再開でも常に接続を張り直す。分岐をなくして状態の食い違いも防ぐ。
      const isNewStation = this.currentStation?.stationuuid !== station.stationuuid
      this.currentStation = station
      if (isNewStation) this.nowPlaying = ''
      this.stopMetadataPolling()

      if (icecastPlayer) {
        icecastPlayer.stop()
        icecastPlayer = null
      }

      // 1. ネイティブ Audio で即座に再生
      if (nativeAudio) {
        nativeAudio.src = station.url_resolved
        nativeAudio.volume = this.volume
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
