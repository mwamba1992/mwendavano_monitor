<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { get, logout, session } from '@/api'
import { initials } from '@/format'

const route = useRoute()
const me = computed(() => session.me!)
const role = computed(() => me.value.jobRole || (me.value.isOwner ? 'Owner' : 'Staff'))
const seesPeople = computed(() => me.value.isOwner || (['mauzo', 'soko', 'wafanyakazi', 'cargo'] as const).some((s) => me.value.access[s] !== 'none'))

const items = computed(() => [
  { to: '/', label: 'Overview', on: route.path === '/' && !route.hash, icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  ...(seesPeople.value ? [{ to: '/users', label: 'Users', on: route.path === '/users', icon: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-3.9 3.1-7 7-7s7 3.1 7 7M16 4.5a4 4 0 0 1 0 7M19 14.5c1.8 1.1 3 3.4 3 6.5' }] : []),
  { to: '/#visitors', label: 'Visitors', on: route.hash === '#visitors', icon: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  ...(me.value.canManageStaff ? [{ to: '/staff', label: 'Staff and access', on: route.path === '/staff', icon: 'M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18' }] : []),
  { to: '/#systems', label: 'Systems', on: route.hash === '#systems', icon: 'M3 4h18v7H3zM3 13h18v7H3zM7 7.5h.01M7 16.5h.01' },
  { to: '/#alerts', label: 'Alerts', on: route.hash === '#alerts', count: session.alerts, icon: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0' },
])

async function loadCount() {
  if (me.value.mustChangePassword) return
  session.alerts = (await get<unknown[]>('/alerts').catch(() => [])).length
}
let timer: number
onMounted(() => {
  void loadCount()
  timer = window.setInterval(loadCount, 60_000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="shell">
    <nav class="side" aria-label="Main">
      <div class="brand">
        <div class="brand-mark">M</div>
        <div class="brand-text">Mwendavano<small>Monitor</small></div>
      </div>
      <div class="nav">
        <router-link v-for="i in items" :key="i.label" :to="i.to" :class="{ on: i.on }" active-class="" exact-active-class="">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="i.icon" /></svg>
          {{ i.label }}
          <span v-if="i.count" class="count">{{ i.count }}</span>
        </router-link>
      </div>
      <div class="me">
        <router-link to="/account" class="me-link">
          <span class="avatar">{{ initials(me.name) }}</span>
          <span class="me-text"><span>{{ me.name }}</span><small>{{ role }}</small></span>
        </router-link>
        <button type="button" class="signout" @click="logout">Sign out</button>
      </div>
    </nav>
    <main class="main"><router-view /></main>
  </div>
</template>
