<script setup lang="ts">
import { computed } from 'vue'

/** A single quiet line. The number beside it is the headline; this only shows the direction. */
const props = defineProps<{ values: number[]; label: string }>()
const W = 120
const H = 36
const PAD = 3
const id = `spark-${Math.random().toString(36).slice(2, 8)}`

const points = computed(() => {
  const v = props.values
  const max = Math.max(1, ...v)
  const min = Math.min(...v, 0)
  const span = max - min || 1
  return v.map((n, i) => [PAD + (i / Math.max(1, v.length - 1)) * (W - PAD * 2), H - PAD - ((n - min) / span) * (H - PAD * 2)] as const)
})
const line = computed(() => points.value.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '))
const area = computed(() => {
  const p = points.value
  return p.length ? `M${p[0][0]},${H} L${line.value.replace(/ /g, ' L')} L${p[p.length - 1][0]},${H} Z` : ''
})
</script>

<template>
  <svg v-if="values.length > 1" class="spark" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" role="img" :aria-label="`${label}, last 14 days: ${values.join(', ')}`">
    <title>Last 14 days</title>
    <defs><linearGradient :id="id" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".28" /><stop offset="1" stop-color="currentColor" stop-opacity="0" /></linearGradient></defs>
    <path :d="area" :fill="`url(#${id})`" />
    <polyline :points="line" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
  </svg>
</template>
