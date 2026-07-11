<template>
  <div class="min-h-screen flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
    <MiniPlayer v-if="isMiniWindow" />
    <template v-else>
      <AppHeader />
      <main class="flex-1 container mx-auto px-4 pb-32">
        <RouterView />
      </main>
      <RadioPlayer />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useColorMode } from '@vueuse/core'
import AppHeader from './components/AppHeader.vue'
import RadioPlayer from './components/RadioPlayer.vue'
import MiniPlayer from './views/MiniPlayer.vue'
import { usePlayerBridge } from './composables/usePlayerBridge'

// 単一のグローバル color mode（<html>要素に dark クラスを付与）
useColorMode({
  attribute: 'class',
  selector: 'html',
  modes: { light: '', dark: 'dark' },
  storageKey: 'tuner-color-mode',
})

// ミニウィンドウ判定（同期的: Rust側が ?window=mini を付与）
const isMiniWindow =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('window') === 'mini'

// メインウィンドウのみが音源を持ち、ミニ窓からの指令を受ける
if (!isMiniWindow) {
  usePlayerBridge()
}
</script>
