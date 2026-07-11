<template>
  <div>
    <SearchBar @search="onSearch" @country-changed="onCountryChanged" />

    <div v-if="loading" class="flex justify-center my-12">
      <IconLoading class="w-8 h-8 animate-spin text-primary-500" />
    </div>

    <div v-else-if="stations.length > 0">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8 mb-8">
        <StationCard
          v-for="station in paginatedStations"
          :key="station.stationuuid"
          :station="station"
        />
      </div>
      <Pagination
        v-if="stations.length > 20"
        v-model:page="page"
        :items-per-page="20"
        :total="stations.length"
      />
    </div>

    <div v-else-if="searched" class="text-center my-12 text-gray-500 dark:text-gray-400">
      {{ t('no_results') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocalStorage } from '@vueuse/core'
import { radioApi } from '../utils/radioApi'
import type { Station } from '../types'
import SearchBar from '../components/SearchBar.vue'
import StationCard from '../components/StationCard.vue'
import Pagination from '../components/Pagination.vue'
import IconLoading from '~icons/heroicons/arrow-path'

const { t } = useI18n()

const stations = ref<Station[]>([])
const page = ref(1)
const loading = ref(false)
const searched = ref(false)

const savedCountry = useLocalStorage('radio-selected-country', '')

const paginatedStations = computed(() => {
  const start = (page.value - 1) * 20
  const end = start + 20
  return stations.value.slice(start, end)
})

onMounted(async () => {
  loading.value = true
  stations.value = await radioApi.getTopStations(500, savedCountry.value)
  loading.value = false
})

const onCountryChanged = async (country: string) => {
  loading.value = true
  searched.value = false
  stations.value = await radioApi.getTopStations(500, country)
  page.value = 1
  loading.value = false
}

const onSearch = async (payload: { query: string, country: string }) => {
  const { query, country } = payload
  if (!query.trim()) {
    searched.value = false
    loading.value = true
    stations.value = await radioApi.getTopStations(500, country)
    page.value = 1
    loading.value = false
    return
  }

  loading.value = true
  searched.value = true
  stations.value = await radioApi.searchStations(query, country)
  page.value = 1
  loading.value = false
}
</script>
