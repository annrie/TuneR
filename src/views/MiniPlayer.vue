<template>
  <div class="h-screen flex flex-col gap-3 p-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">

    <!-- 現在再生中 -->
    <div class="flex items-center gap-2">
      <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
        <img
          v-if="station?.favicon && !iconError"
          :src="station.favicon"
          :alt="station.name"
          class="w-full h-full object-cover"
          @error="iconError = true"
        />
        <IconRadio v-else class="w-5 h-5 text-gray-400" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-sm truncate" :title="station?.name">{{ station?.name ?? '—' }}</div>
        <NowPlayingTitle v-if="nowPlaying" :text="nowPlaying" />
      </div>
      <button
        type="button"
        class="p-2 rounded-full flex-shrink-0 shadow transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        :class="station ? 'bg-primary-500 text-white hover:bg-primary-600' : 'bg-gray-300 dark:bg-gray-700 text-gray-500'"
        :disabled="!station"
        :aria-label="isPlaying ? t('pause') : t('play')"
        @click="sendToggle"
      >
        <IconPause v-if="isPlaying" class="w-5 h-5" />
        <IconPlay v-else class="w-5 h-5" />
      </button>
    </div>

    <!-- 音量 -->
    <div class="flex items-center gap-2">
      <IconSpeaker class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
      <input
        v-model.number="volume"
        type="range"
        min="0"
        max="1"
        step="0.01"
        class="flex-1 accent-primary-500"
        aria-label="Volume"
        @input="sendVolume"
      />
      <span class="text-xs text-gray-400 w-8 text-right tabular-nums">
        {{ Math.round(volume * 100) }}%
      </span>
    </div>

    <!-- お気に入り選択 -->
    <div class="relative">
      <IconHeart class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
      <select
        :value="station?.stationuuid ?? ''"
        :disabled="favorites.favorites.length === 0"
        class="w-full h-10 pl-9 pr-8 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed truncate"
        @change="onSelectFavorite"
      >
        <option value="" disabled>
          {{ favorites.favorites.length === 0 ? t('no_results') : `— ${t('favorites')} —` }}
        </option>
        <option v-for="fav in favorites.favorites" :key="fav.stationuuid" :value="fav.stationuuid">
          {{ fav.name }}
        </option>
      </select>
      <IconChevronDown class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Station } from '../types'
import { useFavoritesStore } from '../stores/useFavorites'
import NowPlayingTitle from '../components/NowPlayingTitle.vue'
import IconRadio from '~icons/heroicons/radio'
import IconPlay from '~icons/heroicons/play-solid'
import IconPause from '~icons/heroicons/pause-solid'
import IconSpeaker from '~icons/heroicons/speaker-wave'
import IconHeart from '~icons/heroicons/heart'
import IconChevronDown from '~icons/heroicons/chevron-down'

const { t } = useI18n()
const favorites = useFavoritesStore()

const station = ref<Station | null>(null)
const isPlaying = ref(false)
const nowPlaying = ref('')
const volume = ref(0.8)
const iconError = ref(false)

let unlisten: (() => void) | null = null

onMounted(async () => {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return
  const { listen, emit } = await import('@tauri-apps/api/event')

  unlisten = await listen<{
    station: Station | null
    isPlaying: boolean
    nowPlaying: string
    volume: number
  }>('player:state', (event) => {
    const prevUuid = station.value?.stationuuid
    station.value = event.payload.station
    isPlaying.value = event.payload.isPlaying
    nowPlaying.value = event.payload.nowPlaying
    volume.value = event.payload.volume
    if (event.payload.station?.stationuuid !== prevUuid) iconError.value = false
  })

  // メイン窓へ現在状態をリクエスト
  emit('player:command', { type: 'sync' })
})

onUnmounted(() => {
  unlisten?.()
})

const sendCommand = (cmd: Record<string, unknown>) => {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return
  import('@tauri-apps/api/event').then(({ emit }) => emit('player:command', cmd))
}

const sendToggle = () => sendCommand({ type: 'toggle' })

const sendVolume = () => sendCommand({ type: 'volume', value: volume.value })

const onSelectFavorite = (e: Event) => {
  const uuid = (e.target as HTMLSelectElement).value
  const fav = favorites.favorites.find((f) => f.stationuuid === uuid)
  if (fav) sendCommand({ type: 'play', station: fav })
}
</script>
