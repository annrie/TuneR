<template>
  <div>
    <h1 class="text-3xl font-bold mb-8 mt-6">{{ t('favorites') }}</h1>

    <div v-if="!favorites.favorites.length" class="text-center my-12 text-gray-500 dark:text-gray-400">
      {{ t('no_results') }}
    </div>

    <div v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StationCard
          v-for="station in paginatedFavorites"
          :key="station.stationuuid"
          :station="station"
        />
      </div>
      <Pagination
        v-if="favorites.favorites.length > 20"
        v-model:page="page"
        :items-per-page="20"
        :total="favorites.favorites.length"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFavoritesStore } from '../stores/useFavorites'
import StationCard from '../components/StationCard.vue'
import Pagination from '../components/Pagination.vue'

const { t } = useI18n()
const favorites = useFavoritesStore()
const page = ref(1)

const paginatedFavorites = computed(() => {
  const start = (page.value - 1) * 20
  const end = start + 20
  return favorites.favorites.slice(start, end)
})
</script>
