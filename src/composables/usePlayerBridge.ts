import { watch, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/usePlayer'
import type { StreamStatus } from '../stores/usePlayer'
import type { Station } from '../types'

type PlayerCommand =
  | { type: 'sync' }
  | { type: 'toggle' }
  | { type: 'volume'; value: number }
  | { type: 'play'; station: Station }

interface PlayerState {
  station: Station | null
  isPlaying: boolean
  nowPlaying: string
  volume: number
  streamStatus: StreamStatus
}

/**
 * メインウィンドウ側のブリッジ。
 * - ミニウィンドウからの `player:command` を受信して再生を制御
 * - 再生状態が変わるたびに `player:state` を発信してミニ窓へ通知
 * 音源（Audio要素）はメインウィンドウだけが持つ。
 */
export function usePlayerBridge() {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    return
  }

  const player = usePlayerStore()
  let unlisten: (() => void) | null = null
  let emitState: (() => void) | null = null

  const setup = async () => {
    const { listen, emit } = await import('@tauri-apps/api/event')

    const broadcast = () => {
      const payload: PlayerState = {
        station: player.currentStation,
        isPlaying: player.isPlaying,
        nowPlaying: player.nowPlaying,
        volume: player.volume,
        streamStatus: player.streamStatus,
      }
      emit('player:state', payload)
    }
    emitState = broadcast

    unlisten = await listen<PlayerCommand>('player:command', (event) => {
      const cmd = event.payload
      switch (cmd.type) {
        case 'sync':
          broadcast()
          break
        case 'toggle':
          if (player.currentStation) player.togglePlay(player.currentStation)
          break
        case 'volume':
          player.setVolume(cmd.value)
          break
        case 'play':
          player.play(cmd.station)
          break
      }
    })

    // 状態変化を監視してミニ窓へ通知
    watch(
      () => [
        player.currentStation?.stationuuid,
        player.isPlaying,
        player.nowPlaying,
        player.volume,
        player.streamStatus,
      ],
      () => broadcast(),
    )
  }

  setup()

  onUnmounted(() => {
    unlisten?.()
    emitState = null
  })
}
