<template>
  <div class="h-full flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:shadow-md transition-shadow">
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-center gap-3 overflow-hidden">
        <div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center overflow-hidden">
          <img
            v-if="station.favicon && !iconError"
            :src="station.favicon"
            :alt="station.name"
            class="w-full h-full object-cover"
            @error="iconError = true"
          />
          <IconRadio v-else class="w-6 h-6 text-gray-400" />
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-base break-words line-clamp-3" :title="station.name">{{ station.name }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
            {{ station.country }}<span v-if="station.language"> • {{ station.language }}</span>
          </p>
        </div>
      </div>
      <button
        type="button"
        class="flex-shrink-0 p-2 rounded-full transition-colors"
        :class="isFav ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
        :aria-label="isFav ? 'Remove from favorites' : 'Add to favorites'"
        @click.stop="toggleFav"
      >
        <IconHeartSolid v-if="isFav" class="w-5 h-5" />
        <IconHeart v-else class="w-5 h-5" />
      </button>
    </div>

    <div class="mt-3 mb-3 flex flex-wrap gap-1.5 flex-1">
      <span
        v-for="tag in tags"
        :key="tag"
        class="px-2 py-0.5 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
      >
        {{ tag }}
      </span>
    </div>

    <div class="flex justify-between items-center mt-auto pt-2 border-t border-gray-100 dark:border-gray-700">
      <span class="flex items-center gap-1.5 min-w-0 text-xs text-gray-500 dark:text-gray-400">
        <span class="min-w-0 truncate">{{ station.bitrate }} kbps • {{ station.codec }}</span>
        <span
          v-if="isUnplayable"
          class="flex-shrink-0 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
        >
          {{ t('codec_unsupported') }}
        </span>
      </span>
      <button
        type="button"
        class="p-1 rounded-full text-primary-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
        :aria-label="isPlayingThis ? 'Pause' : 'Play'"
        @click="togglePlay"
      >
        <IconPauseCircle v-if="isPlayingThis" class="w-11 h-11" />
        <IconPlayCircle v-else class="w-11 h-11" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Station } from '../types'
import { usePlayerStore } from '../stores/usePlayer'
import { useFavoritesStore } from '../stores/useFavorites'
import { isUnplayableStation } from '../utils/codecSupport'
import IconRadio from '~icons/heroicons/radio'
import IconHeart from '~icons/heroicons/heart'
import IconHeartSolid from '~icons/heroicons/heart-solid'
import IconPlayCircle from '~icons/heroicons/play-circle-solid'
import IconPauseCircle from '~icons/heroicons/pause-circle-solid'

const props = defineProps<{
  station: Station
}>()

const { t } = useI18n()
const player = usePlayerStore()
const favorites = useFavoritesStore()
const iconError = ref(false)

const isUnplayable = computed(() => isUnplayableStation(props.station))

const tags = computed(() => {
  if (!props.station.tags) return []
  return props.station.tags.split(',').map(t => t.trim()).filter(t => t).slice(0, 3)
})

const isPlayingThis = computed(() => {
  return player.currentStation?.stationuuid === props.station.stationuuid && player.isPlaying
})

const isFav = computed(() => favorites.isFavorite(props.station))

const togglePlay = () => player.togglePlay(props.station)
const toggleFav = () => favorites.toggleFavorite(props.station)
</script>
