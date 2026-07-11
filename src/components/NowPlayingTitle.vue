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
      <span ref="textEl" class="inline-block">🎵 {{ text }}</span>
      <!-- ループを継ぎ目なく見せるための2枚目（はみ出す時だけ描画） -->
      <span v-if="overflows" class="inline-block pl-12">🎵 {{ text }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{ text: string }>()

// 曲名がはみ出す場合だけ電光掲示板風に左へ流す。
// テキスト幅+間隔ぶん流れきったところでアニメーションが一周し、
// 2枚目のコピーがちょうど先頭位置に来るため継ぎ目なくループする。
const GAP_PX = 48 // pl-12 と一致させること

const container = ref<HTMLElement | null>(null)
const inner = ref<HTMLElement | null>(null)
const textEl = ref<HTMLElement | null>(null)
const overflows = ref(false)
const marqueeStyle = ref<Record<string, string>>({})

watch(
  () => props.text,
  async () => {
    overflows.value = false
    marqueeStyle.value = {}
    await nextTick()
    const c = container.value
    const el = textEl.value
    if (!c || !el) return
    const textWidth = el.scrollWidth
    if (textWidth - c.clientWidth > 8) {
      const shift = textWidth + GAP_PX
      overflows.value = true
      marqueeStyle.value = {
        '--marquee-shift': `-${shift}px`,
        // 読める速さ(約25px/秒)。短い曲名でもせわしなくならないよう最低6秒
        '--marquee-duration': `${Math.max(6, shift / 25)}s`,
      }
    }
  },
  { immediate: true }
)
</script>

<style scoped>
/* 先頭で一呼吸置いてから左へ流れ、頭からループする電光掲示板風スクロール */
.title-marquee {
  animation: title-marquee var(--marquee-duration, 8s) linear infinite;
}

@keyframes title-marquee {
  0%,
  12% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(var(--marquee-shift, 0px));
  }
}
</style>
