<template>
  <div class="w-full max-w-2xl mx-auto my-6">
    <form class="flex flex-col md:flex-row gap-2" @submit.prevent="emitSearch">
      <!-- 国セレクター -->
      <div class="relative w-full md:w-64 min-w-[200px]">
        <IconGlobe class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
        <select
          v-model="selectedCountry"
          class="w-full h-10 pl-9 pr-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
        >
          <option v-for="opt in countryOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- キーワード入力 -->
      <div class="relative flex-1">
        <IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          v-model="query"
          type="text"
          :placeholder="t('search_placeholder')"
          class="w-full h-10 pl-9 pr-9 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          v-show="query !== ''"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          aria-label="Clear"
          @click="clearQuery"
        >
          <IconXMark class="w-4 h-4" />
        </button>
      </div>

      <button
        type="submit"
        class="h-10 px-5 rounded-md bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors"
      >
        {{ t('search') }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocalStorage } from '@vueuse/core'
import { radioApi } from '../utils/radioApi'
import IconGlobe from '~icons/heroicons/globe-alt'
import IconSearch from '~icons/heroicons/magnifying-glass'
import IconXMark from '~icons/heroicons/x-mark-20-solid'

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'search', payload: { query: string, country: string }): void
  (e: 'country-changed', country: string): void
}>()

const query = ref('')
const selectedCountry = useLocalStorage('radio-selected-country', '')
const countryOptions = ref<{ value: string; label: string }[]>([])

onMounted(async () => {
  const countries = await radioApi.getCountries()
  countryOptions.value = [
    { value: '', label: 'All Countries' },
    ...countries.map((c: any) => ({
      value: c.name,
      label: `${c.name} (${c.stationcount})`,
    })),
  ]
})

watch(selectedCountry, (newVal) => {
  emit('country-changed', newVal)
})

const emitSearch = () => {
  emit('search', { query: query.value, country: selectedCountry.value })
}

const clearQuery = () => {
  query.value = ''
  emit('search', { query: '', country: selectedCountry.value })
}
</script>
