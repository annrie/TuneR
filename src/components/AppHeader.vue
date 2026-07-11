<template>
  <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-50">
    <div class="container mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-6">
        <RouterLink to="/" class="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
          <IconRadio class="w-6 h-6 text-primary-500 dark:text-primary-400" />
          {{ t('app_name') }}
        </RouterLink>
        <nav class="hidden md:flex gap-1">
          <RouterLink
            to="/"
            class="px-3 py-1.5 rounded-md text-sm transition-colors text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            active-class=""
            exact-active-class="bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 font-semibold"
          >
            {{ t('home') }}
          </RouterLink>
          <RouterLink
            to="/favorites"
            class="px-3 py-1.5 rounded-md text-sm transition-colors text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            active-class="bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 font-semibold"
          >
            {{ t('favorites') }}
          </RouterLink>
        </nav>
      </div>

      <div class="flex items-center gap-3">
        <!-- Language Switcher (Headless UI Listbox) -->
        <Listbox v-model="currentLocale" @update:modelValue="onLocaleChange">
          <div class="relative">
            <ListboxButton class="relative flex items-center gap-2 pl-3 pr-8 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-w-32">
              <IconLanguage class="w-4 h-4" />
              <span class="truncate">{{ selectedLocaleName }}</span>
              <IconChevronDown class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </ListboxButton>
            <transition leave-active-class="transition duration-100 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
              <ListboxOptions class="absolute right-0 mt-1 max-h-60 w-44 overflow-auto rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-10 focus:outline-none">
                <ListboxOption
                  v-for="loc in availableLocales"
                  :key="loc.code"
                  v-slot="{ active, selected }"
                  :value="loc.code"
                  as="template"
                >
                  <li
                    class="cursor-pointer select-none px-3 py-2 text-sm"
                    :class="[
                      active ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-gray-100',
                      selected && 'font-semibold',
                    ]"
                  >
                    {{ loc.name }}
                  </li>
                </ListboxOption>
              </ListboxOptions>
            </transition>
          </div>
        </Listbox>

        <!-- Color Mode (3-way: auto / light / dark) -->
        <button
          type="button"
          class="p-2 rounded-md text-primary-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
          :aria-label="`Color mode: ${colorPref}`"
          @click="cycleColorMode"
        >
          <IconMoon v-if="colorPref === 'dark'" class="w-5 h-5" />
          <IconSun v-else-if="colorPref === 'light'" class="w-5 h-5" />
          <IconDesktop v-else class="w-5 h-5" />
        </button>

        <!-- Mobile Menu -->
        <button
          type="button"
          class="md:hidden p-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Menu"
          @click="mobileOpen = !mobileOpen"
        >
          <IconBars class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Mobile Menu Panel -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <nav v-if="mobileOpen" class="md:hidden border-t border-gray-200 dark:border-gray-800 p-4 flex flex-col gap-1">
        <RouterLink
          to="/"
          class="px-3 py-2 rounded-md transition-colors text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          exact-active-class="bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 font-semibold"
          @click="mobileOpen = false"
        >{{ t('home') }}</RouterLink>
        <RouterLink
          to="/favorites"
          class="px-3 py-2 rounded-md transition-colors text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          active-class="bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 font-semibold"
          @click="mobileOpen = false"
        >{{ t('favorites') }}</RouterLink>
      </nav>
    </Transition>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStorage } from '@vueuse/core'
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue'
import { availableLocales, type Locale } from '../i18n'

type ColorPref = 'auto' | 'light' | 'dark'
import IconRadio from '~icons/heroicons/radio'
import IconLanguage from '~icons/heroicons/language'
import IconChevronDown from '~icons/heroicons/chevron-down'
import IconMoon from '~icons/heroicons/moon-20-solid'
import IconSun from '~icons/heroicons/sun-20-solid'
import IconDesktop from '~icons/heroicons/computer-desktop-20-solid'
import IconBars from '~icons/heroicons/bars-3'

const { locale, t } = useI18n()

// App.vue の useColorMode が <html> に dark クラスを適用するので、
// ここではユーザー設定（preference）のみを直接 localStorage で扱う
const colorPref = useStorage<ColorPref>('tuner-color-mode', 'auto')

const mobileOpen = ref(false)
const currentLocale = ref<Locale>(locale.value as Locale)

const selectedLocaleName = computed(() => {
  const found = availableLocales.find(l => l.code === currentLocale.value)
  return found?.name ?? currentLocale.value
})

const onLocaleChange = (newLocale: Locale) => {
  locale.value = newLocale
  localStorage.setItem('tuner-locale', newLocale)
}

const cycleColorMode = () => {
  const order: ColorPref[] = ['auto', 'light', 'dark']
  const idx = order.indexOf(colorPref.value)
  colorPref.value = order[(idx + 1) % order.length]
}
</script>
