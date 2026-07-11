<template>
  <div
    v-if="player.currentStation"
    class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-50 p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
  >
    <div class="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">

      <!-- Station Info -->
      <div class="flex items-center gap-3 w-full md:w-1/3">
        <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
          <img
            v-if="player.currentStation.favicon && !iconError"
            :src="player.currentStation.favicon"
            :alt="player.currentStation.name"
            class="w-full h-full object-cover"
            @error="iconError = true"
          />
          <IconRadio v-else class="w-5 h-5 text-gray-400" />
        </div>
        <div class="flex-1 min-w-0 py-1">
          <div class="font-bold text-sm break-words line-clamp-2" :title="player.currentStation.name">
            {{ player.currentStation.name }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ player.currentStation.country }}</div>
          <NowPlayingTitle v-if="player.nowPlaying" :text="player.nowPlaying" class="mt-0.5" />
        </div>
      </div>

      <!-- Controls -->
      <div class="flex items-center justify-center w-full md:w-1/3">
        <button
          type="button"
          class="p-3 rounded-full bg-primary-500 text-white hover:bg-primary-600 shadow-lg transition-colors"
          :aria-label="player.isPlaying ? 'Pause' : 'Play'"
          @click="player.togglePlay(player.currentStation!)"
        >
          <IconPause v-if="player.isPlaying" class="w-7 h-7" />
          <IconPlay v-else class="w-7 h-7" />
        </button>
      </div>

      <!-- Volume & Links -->
      <div class="hidden md:flex flex-col items-end justify-center w-full md:w-1/3 gap-2">
        <div class="flex gap-3">
          <a
            v-if="player.currentStation.homepage"
            :href="player.currentStation.homepage"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-primary-500 hover:text-primary-600 hover:underline flex items-center gap-1"
            @click.prevent="openExternal(player.currentStation.homepage)"
          >
            <IconGlobe class="w-3 h-3" />
            {{ t('station_homepage') }}
          </a>
          <a
            :href="timetableSearchUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:underline flex items-center gap-1"
            @click.prevent="openExternal(timetableSearchUrl)"
          >
            <IconCalendar class="w-3 h-3" />
            {{ t('station_timetable') }}
          </a>
        </div>
        <div class="flex items-center gap-3">
          <IconSpeaker class="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <input
            v-model.number="volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            class="w-24 accent-primary-500"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '../stores/usePlayer'
import NowPlayingTitle from './NowPlayingTitle.vue'
import IconRadio from '~icons/heroicons/radio'
import IconPlay from '~icons/heroicons/play-solid'
import IconPause from '~icons/heroicons/pause-solid'
import IconGlobe from '~icons/heroicons/globe-alt'
import IconCalendar from '~icons/heroicons/calendar'
import IconSpeaker from '~icons/heroicons/speaker-wave'

const { t } = useI18n()
const player = usePlayerStore()
const volume = ref(player.volume)
const iconError = ref(false)

watch(volume, (newVol) => {
  player.setVolume(newVol)
})

watch(() => player.currentStation?.stationuuid, () => {
  iconError.value = false
})

const timetableSearchUrl = computed(() => {
  if (!player.currentStation) return '#'
  const q = encodeURIComponent(`${player.currentStation.name} timetable schedule`)
  return `https://www.google.com/search?q=${q}`
})

const openExternal = async (url: string) => {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(url)
    } catch (e) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
</script>
