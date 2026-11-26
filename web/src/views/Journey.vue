<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, get, session } from '@/api'
import { number, shortDate, timeAgo } from '@/format'

type App = 'soko' | 'mauzo'
const route = useRoute()
const router = useRouter()

const canSee = (s: App) => !!session.me && (session.me.isOwner || session.me.access[s] !== 'none')
const apps = computed(() => ([{ id: 'soko', label: 'Sokoni' }, { id: 'mauzo', label: 'Mauzo' }] as const).filter((a) => canSee(a.id)))
const periods = [{ id: '7d', label: '7 days' }, { id: '30d', label: '30 days' }, { id: 'all', label: 'All time' }] as const

const app = ref<App>(route.query.app === 'mauzo' || !canSee('soko') ? 'mauzo' : 'soko')
const period = ref(String(route.query.period ?? '7d'))
const data = ref<any>(null)
const error = ref('')
const loading = ref(false)
const noSaleOnly = ref(false)

const SOURCE_LABEL: Record<string, string> = { unknown: 'Not known (direct or before tracking)', whatsapp: 'WhatsApp', instagram: 'Instagram', 'ig-story': 'Instagram story', poster: 'Poster', 'google-play': 'Google Play', facebook: 'Facebook', tiktok: 'TikTok' }
const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? s

const sources = computed(() => {
  const list: { source: string; devices: number }[] = data.value?.sources ?? []
  const total = list.reduce((n, s) => n + s.devices, 0)
  return list.map((s) => ({ ...s, pct: total ? Math.round((s.devices / total) * 100) : 0 }))
})
const shops = computed(() => (data.value?.shops ?? []).filter((s: any) => !noSaleOnly.value || s.call))
const toCall = computed(() => (data.value?.shops ?? []).filter((s: any) => s.call).length)
const funnelHint = computed(() =>
  app.value === 'soko'
    ? 'Phones that reached each step, in order. A buyer who was already signed in counts as signed in.'
    : 'New shops only: phones of shops that existed before tracking started are left out. Active days are the last 7 days.',
)

async function load() {
  loading.value = true
  try {
    data.value = await get(`/journey?app=${app.value}&period=${period.value}`)
    error.value = ''
  } catch (e) {
    if (e instanceof ApiError) error.value = e.message
  } finally {
    loading.value = false
  }
}

watch([app, period], () => {
  router.replace({ query: { ...route.query, app: app.value, period: period.value } })
  data.value = null
  load()
})
onMounted(load)
</script>

<template>
  <header class="head">
    <div class="head-text"><span>Where people drop off, from opening the app to ordering or selling</span><h1>Customer journey</h1></div>
    <div class="head-tools">
      <div v-if="apps.length > 1" class="periods" role="group" aria-label="App">
        <button v-for="a in apps" :key="a.id" type="button" :class="{ on: app === a.id }" :aria-pressed="app === a.id" @click="app = a.id">{{ a.label }}</button>
      </div>
      <div class="periods" role="group" aria-label="Period">
        <button v-for="p in periods" :key="p.id" type="button" :class="{ on: period === p.id }" :aria-pressed="period === p.id" @click="period = p.id">{{ p.label }}</button>
      </div>
    </div>
  </header>

  <div v-if="error" class="error" role="alert">{{ error }}</div>
  <div v-else-if="data && !data.ready" class="notice">
    No journey data yet. Steps arrive once the API update is live, the Monitor may read <code>core.app_event</code>, and people use the new app release.
  </div>
  <div v-else-if="data?.failed" class="notice">Some of these numbers could not be read just now.</div>

  <p v-if="!data && loading" class="empty">Loading…</p>

  <template v-if="data?.ready">
    <section class="card" aria-labelledby="funnel-h">
      <div class="section-head"><h2 id="funnel-h">Funnel</h2><span class="hint">{{ funnelHint }}</span></div>
      <ol class="funnel">
        <li v-for="(s, i) in data.funnel" :key="s.key">
          <div class="funnel-top">
            <span class="funnel-label"><span class="funnel-n">{{ i + 1 }}</span>{{ s.label }}</span>
            <span class="funnel-num"><b>{{ number(s.devices) }}</b><small>{{ s.ofFirst }}% of step 1</small></span>
          </div>
          <div class="track"><div class="bar" :style="{ width: `${s.ofFirst}%` }" /></div>
          <small v-if="s.ofPrevious !== null" class="funnel-drop" :class="{ bad: s.ofPrevious < 50 }">
            {{ s.ofPrevious }}% kept from the step before<template v-if="data.funnel[i - 1].devices - s.devices > 0"> · {{ number(data.funnel[i - 1].devices - s.devices) }} dropped</template>
          </small>
        </li>
      </ol>
    </section>

    <div class="row">
      <section v-if="app === 'soko'" class="card wide" aria-labelledby="people-h">
        <div class="section-head"><h2 id="people-h">Recent visitors</h2><span class="hint">Latest 50 phones</span></div>
        <div class="scroll">
          <table style="min-width: 640px">
            <thead><tr><th>Who</th><th>What they did</th><th>Came from</th><th>Last seen</th></tr></thead>
            <tbody>
              <tr v-for="v in data.visitors" :key="v.device">
                <td class="strong nowrap">{{ v.who }}<small v-if="!v.signedIn" class="mono-small"> · {{ v.device }}</small></td>
                <td>{{ v.path }}<span v-if="v.ordered" class="pill" style="margin-left: 8px">Ordered</span></td>
                <td class="nowrap">{{ v.source ? sourceLabel(v.source) : '—' }}</td>
                <td class="nowrap">{{ timeAgo(v.lastAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!data.visitors.length" class="empty">No one opened the app in this period.</p>
        <p v-if="data.peopleHidden" class="hint">Names are hidden at your access level.</p>
      </section>

      <section v-if="app === 'mauzo'" class="card wide" aria-labelledby="shops-h">
        <div class="section-head">
          <h2 id="shops-h">New shops</h2>
          <label class="field check"><input v-model="noSaleOnly" type="checkbox" /> No sale yet only ({{ toCall }})</label>
        </div>
        <p class="hint">Shops that signed up in this period. Those with no sale yet are the ones to call.</p>
        <div class="scroll">
          <table style="min-width: 760px">
            <thead><tr><th>Shop</th><th>Signed up</th><th class="right">Products</th><th class="right">Sales</th><th class="right">Days active (7)</th><th>Last active</th><th>Sokoni</th><th></th></tr></thead>
            <tbody>
              <tr v-for="s in shops" :key="s.id">
                <td class="strong">
                  <router-link v-if="!data.peopleHidden" :to="{ path: '/users', query: { q: s.name, joined: 'all' } }">{{ s.name }}</router-link>
                  <template v-else>{{ s.name }}</template>
                  <small class="sub">{{ s.usesApp ? `Uses the app${s.platform ? ` (${s.platform})` : ''}` : 'Not seen in the app yet' }}</small>
                </td>
                <td class="nowrap">{{ shortDate(s.signedUp) }}</td>
                <td class="mono right">{{ number(s.products) }}</td>
                <td class="mono right">{{ number(s.sales) }}</td>
                <td class="mono right">{{ s.usesApp ? s.daysActive7 : '—' }}</td>
                <td class="nowrap">{{ timeAgo(s.lastActive) }}</td>
                <td>{{ s.inSoko ? 'Yes' : 'No' }}</td>
                <td><span v-if="s.call" class="pill warn">No sale yet · call</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!shops.length" class="empty">{{ noSaleOnly ? 'Every new shop in this period has recorded a sale.' : 'No shop signed up in this period.' }}</p>
      </section>

      <section class="card narrow" aria-labelledby="src-h">
        <div class="section-head"><h2 id="src-h">Installs by source</h2></div>
        <p class="hint">New phones in this period, by the link that led to the install (Android only).</p>
        <div v-for="s in sources" :key="s.source" class="source">
          <div><span>{{ sourceLabel(s.source) }}</span><b>{{ number(s.devices) }}</b></div>
          <div class="track"><div class="bar" :style="{ width: `${s.pct}%` }" /></div>
        </div>
        <p v-if="!sources.length" class="empty">No new phones in this period.</p>
      </section>
    </div>

    <section v-if="app === 'soko'" class="card" aria-labelledby="prod-h">
      <div class="section-head"><h2 id="prod-h">Most viewed products</h2><span class="hint">Orders are Soko orders that included the product</span></div>
      <div class="scroll">
        <table style="min-width: 560px">
          <thead><tr><th>Product</th><th>Shop</th><th class="right">Views</th><th class="right">Viewers</th><th class="right">Added to cart</th><th class="right">Orders</th></tr></thead>
          <tbody>
            <tr v-for="p in data.products" :key="p.id">
              <td class="strong">{{ p.name }}</td>
              <td>{{ p.shop }}</td>
              <td class="mono right">{{ number(p.views) }}</td>
              <td class="mono right">{{ number(p.viewers) }}</td>
              <td class="mono right">{{ number(p.adds) }}</td>
              <td class="mono right">{{ number(p.orders) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!data.products.length" class="empty">No product was viewed in this period.</p>
    </section>
  </template>
</template>

<style scoped>
.funnel { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
.funnel li { display: flex; flex-direction: column; gap: 6px; }
.funnel-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.funnel-label { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 14px; }
.funnel-n { width: 22px; height: 22px; flex: none; border-radius: 6px; background: #edf1ef; color: var(--ink-2); font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
.funnel-num { display: flex; align-items: baseline; gap: 8px; }
.funnel-num b { font-family: var(--mono); font-size: 18px; font-weight: 600; }
.funnel-num small, .funnel-drop { font-size: 12px; color: var(--muted); }
.funnel-drop.bad { color: var(--bad); }
.track { height: 8px; }
.bar { height: 100%; border-radius: 999px; background: var(--teal); min-width: 2px; }
.sub { display: block; font-size: 12px; font-weight: 400; color: var(--muted); margin-top: 2px; }
.mono-small { font-family: var(--mono); font-size: 12px; font-weight: 400; color: var(--muted); }
.check { min-height: 44px; cursor: pointer; }
.check input { width: 18px; height: 18px; accent-color: var(--teal); }
code { font-family: var(--mono); font-size: 13px; }
</style>
