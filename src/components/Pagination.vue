<template>
  <div class="flex items-center justify-center gap-1 mb-24">
    <button
      type="button"
      class="p-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      :disabled="page <= 1"
      aria-label="First page"
      @click="goTo(1)"
    >
      <IconChevronDoubleLeft class="w-4 h-4" />
    </button>
    <button
      type="button"
      class="p-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      :disabled="page <= 1"
      aria-label="Previous page"
      @click="goTo(page - 1)"
    >
      <IconChevronLeft class="w-4 h-4" />
    </button>

    <button
      v-for="p in visiblePages"
      :key="p"
      type="button"
      class="min-w-9 h-9 px-2 rounded-md text-sm transition-colors"
      :class="p === page
        ? 'bg-primary-500 text-white font-semibold'
        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'"
      @click="goTo(p)"
    >
      {{ p }}
    </button>

    <button
      type="button"
      class="p-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      :disabled="page >= totalPages"
      aria-label="Next page"
      @click="goTo(page + 1)"
    >
      <IconChevronRight class="w-4 h-4" />
    </button>
    <button
      type="button"
      class="p-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      :disabled="page >= totalPages"
      aria-label="Last page"
      @click="goTo(totalPages)"
    >
      <IconChevronDoubleRight class="w-4 h-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import IconChevronLeft from '~icons/heroicons/chevron-left'
import IconChevronRight from '~icons/heroicons/chevron-right'
import IconChevronDoubleLeft from '~icons/heroicons/chevron-double-left'
import IconChevronDoubleRight from '~icons/heroicons/chevron-double-right'

const props = defineProps<{
  page: number
  itemsPerPage: number
  total: number
}>()

const emit = defineEmits<{
  (e: 'update:page', value: number): void
}>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.itemsPerPage)))

const visiblePages = computed(() => {
  const current = props.page
  const last = totalPages.value
  const window = 2
  const start = Math.max(1, current - window)
  const end = Math.min(last, current + window)
  const pages: number[] = []
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

const goTo = (p: number) => {
  const target = Math.max(1, Math.min(totalPages.value, p))
  if (target !== props.page) emit('update:page', target)
}
</script>
