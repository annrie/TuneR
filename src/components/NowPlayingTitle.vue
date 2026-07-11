<template>
  <div
    ref="container"
    class="overflow-hidden whitespace-nowrap text-sm text-primary-600 dark:text-primary-400 font-medium"
    :title="text"
  >
    <span
      ref="inner"
      class="inline-block"
      :class="{ 'title-marquee': overflows }"
      :style="marqueeStyle"
    >
      🎵 {{ text }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{ text: string }>()

// 曲名がはみ出す場合だけ電光掲示板風に往復スクロールさせる。
// はみ出し量を実測して CSS 変数で距離・所要時間をアニメーションに渡す。
const container = ref<HTMLElement | null>(null)
const inner = ref<HTMLElement | null>(null)
const overflows = ref(false)
const marqueeStyle = ref<Record<string, string>>({})

watch(
  () => props.text,
  async () => {
    overflows.value = false
    marqueeStyle.value = {}
    await nextTick()
    const c = container.value
    const el = inner.value
    if (!c || !el) return
    const overflow = el.scrollWidth - c.clientWidth
    if (overflow > 8) {
      overflows.value = true
      marqueeStyle.value = {
        '--marquee-shift': `-${overflow}px`,
        // 読める速さ(約25px/秒)。短い曲名でもせわしなくならないよう最低6秒
        '--marquee-duration': `${Math.max(6, overflow / 25)}s`,
      }
    }
  },
  { immediate: true }
)
</script>

<style scoped>
/* 両端で一呼吸置いてから往復する電光掲示板風スクロール */
.title-marquee {
  animation: title-marquee var(--marquee-duration, 8s) linear infinite alternate;
}

@keyframes title-marquee {
  0%,
  12% {
    transform: translateX(0);
  }
  88%,
  100% {
    transform: translateX(var(--marquee-shift, 0px));
  }
}
</style>
