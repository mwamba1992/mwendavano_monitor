<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError, blob, get, post } from '@/api'
import { number, shortDate, SYSTEM_LABEL, timeAgo } from '@/format'

const route = useRoute()
const NAMES: Record<string, string> = { mauzo: 'Dukani Mauzo', soko: 'Dukani Soko', wafanyakazi: 'Wafanyakazi', cargo: 'Cargo' }
const STATUS: Record<string, string> = { Active: '', Trial: 'trial', Inactive: 'none', Blocked: 'bad' }

const data = ref<any>(null)
const system = ref('')
const q = ref(String(route.query.q ?? ''))
const type = ref('')
const joined = ref(String(route.query.joined ?? '7d'))
const page = ref(1)
const error = ref('')
const revealed = ref<Record<string, string>>({})

const query = (extra: Record<string, string> = {}) => {
  const p = new URLSearchParams({ joined: joined.value, ...extra })
  if (system.value) p.set('system', system.value)
  if (type.value) p.set('type', type.value)
  if (q.value.trim()) p.set('q', q.value.trim())
  return p.toString()
}

const totals = computed(() => {
  const list = data.value?.totals ?? []
  const sum = (k: string) => list.reduce((n: number, t: any) => n + (t[k] ?? 0), 0)
  return [{ system: '', label: 'All systems', total: sum('total'), week: sum('week') }, ...list.map((t: any) => ({ ...t, label: NAMES[t.system] }))]
})
const pages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / (data.value?.pageSize ?? 50))))
const canExport = computed(() => !!data.value?.rows.length)

async function load() {
  try {
    data.value = await get(`/users?${query({ page: String(page.value) })}`)
    error.value = ''
  } catch (e) {
    if (e instanceof ApiError) error.value = e.message
  }
}

async function exportCsv() {
  try {
    const url = URL.createObjectURL(await blob(`/users/export.csv?${query()}`))
    const a = document.createElement('a')
    a.href = url
    a.download = 'mwendavano-users.csv'
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    if (e instanceof ApiError) error.value = e.message
  }
}

async function reveal(r: any) {
  try {
    const { phone } = await post(`/users/${r.system}/${r.id}/reveal-phone`)
    revealed.value = { ...revealed.value, [`${r.system}:${r.id}`]: phone }
  } catch (e) {
    if (e instanceof ApiError) error.value = e.message
  }
}

let wait: number
watch(q, () => {
  clearTimeout(wait)
  wait = window.setTimeout(() => (page.value === 1 ? load() : (page.value = 1)), 300)
})
watch([system, type, joined], () => (page.value === 1 ? load() : (page.value = 1)))
watch(page, load)
onMounted(load)
</script>

<template>
  <header class="head">
    <div class="head-text"><span>Everyone who signed up, in every system</span><h1>Users</h1></div>
    <div class="head-tools"><button type="button" class="btn" :disabled="!canExport" @click="exportCsv">Export CSV</button></div>
  </header>

  <div v-if="error" class="error" role="alert">{{ error }}</div>

  <section v-if="data" aria-label="Totals by system" class="totals">
    <button v-for="t in totals" :key="t.system" type="button" class="total" :class="{ on: system === t.system }" :aria-pressed="system === t.system" @click="system = t.system">
      {{ t.label }}<b>{{ number(t.total) }}</b><small>+{{ number(t.week) }} this week</small>
    </button>
  </section>

  <section class="card" aria-label="User list">
    <div class="filters">
      <div class="search">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4d5f5c" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input v-model="q" type="search" aria-label="Search users" placeholder="Name, phone or shop" />
      </div>
      <label class="field">Type
        <select v-model="type">
          <option value="">All types</option>
          <option value="owner">Shop owner</option>
          <option value="staff">Shop staff</option>
          <option value="buyer">Buyer</option>
          <option value="worker">Worker</option>
          <option value="manager">Manager</option>
          <option value="customer">Cargo customer</option>
        </select>
      </label>
      <label class="field">Joined
        <select v-model="joined">
          <option value="7d">Last 7 days</option>
          <option value="today">Today</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
      </label>
      <span v-if="data" class="hint" style="margin-left: auto">Showing {{ data.rows.length }} of {{ number(data.total) }}</span>
    </div>

    <div v-if="data?.failed.length" class="notice">Could not read {{ data.failed.map((s: string) => SYSTEM_LABEL[s]).join(', ') }} just now.</div>

    <div class="scroll">
      <table style="min-width: 860px">
        <thead><tr><th>Name</th><th>Phone</th><th>System</th><th>Type</th><th>Plan or shop</th><th>Joined</th><th>Last active</th><th>Status</th></tr></thead>
        <tbody>
          <tr v-for="r in data?.rows" :key="`${r.system}:${r.id}`">
            <td class="strong">{{ r.name }}</td>
            <td class="mono nowrap">
              <template v-if="revealed[`${r.system}:${r.id}`]">{{ revealed[`${r.system}:${r.id}`] }}</template>
              <button v-else-if="r.canReveal" type="button" class="phone-btn" title="Show the full number. This is recorded." @click="reveal(r)">{{ r.phone }}</button>
              <template v-else>{{ r.phone }}</template>
            </td>
            <td><span class="tag" :class="`tag-${r.system}`">{{ SYSTEM_LABEL[r.system] }}</span></td>
            <td>{{ r.type }}</td>
            <td>{{ r.plan }}</td>
            <td class="nowrap">{{ shortDate(r.joined) }}</td>
            <td class="nowrap">{{ timeAgo(r.lastActive) }}</td>
            <td><span class="pill" :class="STATUS[r.status]">{{ r.status }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="data?.peopleHidden" class="empty">You can see totals for this system, but not the people in it.</p>
    <p v-else-if="data && !data.rows.length" class="empty">No users in this system for the selected period.</p>
    <div v-if="pages > 1" class="pager">
      <button type="button" class="btn" :disabled="page <= 1" @click="page--">Previous</button>
      <span>Page {{ page }} of {{ pages }}</span>
      <button type="button" class="btn" :disabled="page >= pages" @click="page++">Next</button>
    </div>
  </section>
</template>
