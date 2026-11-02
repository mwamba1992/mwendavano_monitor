<script setup lang="ts">
import { shortDate } from '@/format'

defineProps<{ days: { date: string; pct: number | null }[] }>()
const level = (p: number | null) => (p == null ? 'none' : p >= 99.9 ? 'ok' : p >= 98 ? 'warn' : 'bad')
const text = (d: { date: string; pct: number | null }) => `${shortDate(d.date)}: ${d.pct == null ? 'no checks' : `${d.pct.toFixed(2)}% up`}`
</script>

<template>
  <div class="strip" role="img" :aria-label="`Uptime for each of the last ${days.length} days`">
    <span v-for="d in days" :key="d.date" :class="level(d.pct)" :title="text(d)" />
  </div>
</template>
