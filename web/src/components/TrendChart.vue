<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { number, shortDate, siteColour } from '@/format'

/** Visitors per day, one line per site. One axis, recessive grid, one tooltip for every series. */
const props = defineProps<{ days: { date: string; counts: Record<string, number> }[]; sites: string[] }>()

const box = ref<HTMLElement | null>(null)
const width = ref(640)
const H = 248
const TOP = 12
const BOTTOM = 26
const LEFT = 40
const right = computed(() => (width.value >= 560 && props.sites.length <= 4 ? 128 : 12))
const plotW = computed(() => Math.max(10, width.value - LEFT - right.value))
const plotH = H - TOP - BOTTOM

const niceMax = (v: number) => {
  const m = 10 ** Math.floor(Math.log10(Math.max(v, 1)))
  return [1, 2, 2.5, 5, 10].map((s) => s * m).find((c) => c >= v) ?? v
}
const maxY = computed(() => niceMax(Math.max(1, ...props.days.flatMap((d) => props.sites.map((s) => d.counts[s])))))
const ticks = computed(() => [0, 0.5, 1].map((f) => maxY.value * f))
const x = (i: number) => LEFT + (i / Math.max(1, props.days.length - 1)) * plotW.value
const y = (v: number) => TOP + plotH - (v / maxY.value) * plotH
const path = (s: string) => props.days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.counts[s]).toFixed(1)}`).join(' ')
const fill = (s: string) => `${path(s)} L${x(props.days.length - 1)},${y(0)} L${x(0)},${y(0)} Z`
const shortSite = (s: string) => s.replace(/\.(com|mwendavano\.com)$/, '')

/** Line-end labels, pushed apart so close lines stay readable. */
const ends = computed(() => {
  const last = props.days[props.days.length - 1]
  const list = props.sites.map((s) => ({ site: s, y: y(last?.counts[s] ?? 0) })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < list.length; i++) if (list[i].y - list[i - 1].y < 16) list[i].y = list[i - 1].y + 16
  return list
})

const hover = ref<number | null>(null)
function move(e: PointerEvent) {
  const r = (e.currentTarget as SVGElement).getBoundingClientRect()
  const i = Math.round(((e.clientX - r.left - LEFT) / plotW.value) * (props.days.length - 1))
  hover.value = Math.min(props.days.length - 1, Math.max(0, i))
}
function key(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  const at = hover.value ?? props.days.length - 1
  hover.value = Math.min(props.days.length - 1, Math.max(0, at + (e.key === 'ArrowLeft' ? -1 : 1)))
}
const tipLeft = computed(() => (hover.value == null ? 0 : Math.min(width.value - 190, Math.max(0, x(hover.value) + (hover.value > props.days.length / 2 ? -186 : 12)))))
const everyOther = computed(() => (width.value < 480 ? 3 : width.value < 760 ? 2 : 1))

let ro: ResizeObserver | undefined
onMounted(() => {
  ro = new ResizeObserver(([e]) => (width.value = e.contentRect.width))
  ro.observe(box.value!)
})
onUnmounted(() => ro?.disconnect())
</script>

<template>
  <div ref="box" class="trend">
    <svg :width="width" :height="H" :viewBox="`0 0 ${width} ${H}`" role="img" tabindex="0" :aria-label="`Daily visitors for ${sites.join(', ')}, last ${days.length} days. Use the arrow keys to read each day.`" @pointermove="move" @pointerleave="hover = null" @keydown="key" @blur="hover = null">
      <defs>
        <linearGradient v-for="s in sites" :id="`fill-${shortSite(s)}`" :key="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" :stop-color="siteColour(s)" stop-opacity=".16" /><stop offset="1" :stop-color="siteColour(s)" stop-opacity="0" /></linearGradient>
      </defs>
      <g v-for="t in ticks" :key="t">
        <line :x1="LEFT" :x2="LEFT + plotW" :y1="y(t)" :y2="y(t)" stroke="#e9efec" />
        <text :x="LEFT - 8" :y="y(t) + 4" text-anchor="end" class="axis-text">{{ number(t) }}</text>
      </g>
      <template v-for="(d, i) in days" :key="d.date"><text v-if="(days.length - 1 - i) % everyOther === 0" :x="x(i)" :y="H - 6" text-anchor="middle" class="axis-text">{{ shortDate(d.date) }}</text></template>
      <path v-for="s in sites" :key="`a${s}`" :d="fill(s)" :fill="`url(#fill-${shortSite(s)})`" />
      <path v-for="s in sites" :key="`l${s}`" :d="path(s)" fill="none" :stroke="siteColour(s)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <template v-if="right > 12">
        <g v-for="e in ends" :key="e.site"><circle :cx="LEFT + plotW" :cy="y(days[days.length - 1].counts[e.site])" r="4" :fill="siteColour(e.site)" stroke="#fff" stroke-width="2" /><text :x="LEFT + plotW + 10" :y="e.y + 4" class="end-text">{{ shortSite(e.site) }}</text></g>
      </template>
      <g v-if="hover != null">
        <line :x1="x(hover)" :x2="x(hover)" :y1="TOP" :y2="y(0)" stroke="#10211f" stroke-opacity=".3" />
        <circle v-for="s in sites" :key="s" :cx="x(hover)" :cy="y(days[hover].counts[s])" r="4.5" :fill="siteColour(s)" stroke="#fff" stroke-width="2" />
      </g>
    </svg>
    <div v-if="hover != null" class="tip" :style="{ left: `${tipLeft}px` }">
      <small>{{ shortDate(days[hover].date) }}</small>
      <div v-for="s in sites" :key="s"><b>{{ number(days[hover].counts[s]) }}</b><i :style="{ background: siteColour(s) }" />{{ shortSite(s) }}</div>
    </div>
    <details class="as-table">
      <summary>View as table</summary>
      <div class="scroll">
        <table>
          <thead><tr><th>Day</th><th v-for="s in sites" :key="s" class="right">{{ s }}</th></tr></thead>
          <tbody><tr v-for="d in days" :key="d.date"><td>{{ shortDate(d.date) }}</td><td v-for="s in sites" :key="s" class="right mono">{{ number(d.counts[s]) }}</td></tr></tbody>
        </table>
      </div>
    </details>
  </div>
</template>
