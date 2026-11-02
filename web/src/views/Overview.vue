<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, del, get, patch, post, session, type SystemKey } from '@/api'
import Sparkline from '@/components/Sparkline.vue'
import TrendChart from '@/components/TrendChart.vue'
import UptimeStrip from '@/components/UptimeStrip.vue'
import { clock, greeting, longDate, number, shortDate, siteColour, SYSTEM_LABEL, timeAgo } from '@/format'

const router = useRouter()
const route = useRoute()
const me = computed(() => session.me!)
const period = ref<'today' | '7d' | '30d'>('7d')
const periods = [{ id: 'today', label: 'Today' }, { id: '7d', label: '7 days' }, { id: '30d', label: '30 days' }] as const
const overview = ref<any>(null)
const systems = ref<any>(null)
const visitors = ref<any>(null)
const alerts = ref<any[]>([])
const error = ref('')
const search = ref('')

const hasVisitors = computed(() => (visitors.value?.sites.length ?? 0) > 0)
const places = computed(() => [
  { title: 'Countries', rows: visitors.value?.locations.countries ?? [] },
  { title: 'Cities', rows: visitors.value?.locations.cities ?? [] },
])

const pillClass = (c: any) => (c.status === 'Down' ? 'bad' : c.status === 'No data' ? 'none' : c.status === 'Degraded' || c.note ? 'warn' : '')
/** A real outage always beats the manual note. */
const pillText = (c: any) => (c.status === 'Down' || c.status === 'Degraded' ? c.status : c.note || c.status)
/** The one sentence the owner reads first. */
const summary = computed(() => {
  const cards: any[] = systems.value?.cards ?? []
  const down = cards.filter((c) => c.status === 'Down')
  const slow = cards.filter((c) => c.status === 'Degraded')
  if (down.length) return { level: 'bad', text: `${down.map((c) => c.name).join(', ')} ${down.length > 1 ? 'are' : 'is'} down` }
  if (slow.length) return { level: 'warn', text: `${slow.map((c) => c.name).join(', ')} ${slow.length > 1 ? 'are' : 'is'} degraded` }
  const live = cards.filter((c) => c.status === 'Online').length
  if (!live) return { level: 'warn', text: 'Waiting for the first health checks' }
  return { level: '', text: `All ${live} systems online${alerts.value.length ? ` · ${alerts.value.length} to look at` : ''}` }
})
const canNote = (c: any) => me.value.isOwner || me.value.access[(c.id === 'global' ? 'mauzo' : c.id) as SystemKey] === 'admin'
const noteSystems = computed(() => (Object.keys(SYSTEM_LABEL) as SystemKey[]).filter((s) => me.value.isOwner || ['admin', 'support'].includes(me.value.access[s])))

async function load() {
  try {
    const [o, s, v, a] = await Promise.all([get(`/overview?period=${period.value}`), get('/systems'), get('/visitors?days=14'), get<any[]>('/alerts')])
    overview.value = o
    systems.value = s
    visitors.value = v
    alerts.value = a
    session.alerts = a.length
    error.value = ''
  } catch (e) {
    if (e instanceof ApiError) error.value = e.message
  }
}

const editing = ref<any>(null)
const noteDraft = ref('')
function editCard(c: any) {
  editing.value = c
  noteDraft.value = c.note ?? ''
}
async function saveCard() {
  await patch(`/systems/${editing.value.id}/note`, { note: noteDraft.value || null })
  editing.value = null
  await load()
}

const adding = ref(false)
const draft = ref({ system: 'server', title: '', detail: '', severity: 'warn' })
function openNote() {
  draft.value = { system: noteSystems.value[0], title: '', detail: '', severity: 'warn' }
  adding.value = true
}
async function saveNote() {
  await post('/alerts/notes', draft.value)
  adding.value = false
  await load()
}
async function closeNote(id: number) {
  await del(`/alerts/notes/${id}`)
  await load()
}

watch(period, load)
let timer: number
onMounted(async () => {
  await load()
  timer = window.setInterval(load, 60_000)
  if (route.hash) await nextTick(() => document.querySelector(route.hash)?.scrollIntoView())
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <section class="hero rise" aria-label="Summary">
    <div class="hero-top">
      <div>
        <div class="hero-date">{{ longDate() }}</div>
        <h1>{{ greeting() }}, {{ me.name.split(' ')[0] }}</h1>
        <div v-if="systems" class="pulse-line" :class="summary.level" role="status"><span class="pulse" />{{ summary.text }}</div>
      </div>
      <div class="head-tools">
        <form class="search" @submit.prevent="router.push({ path: '/users', query: { q: search, joined: 'all' } })">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input v-model="search" type="search" aria-label="Search" placeholder="Search users, shops, phones" />
        </form>
        <div class="periods" role="group" aria-label="Period">
          <button v-for="p in periods" :key="p.id" type="button" :class="{ on: period === p.id }" @click="period = p.id">{{ p.label }}</button>
        </div>
      </div>
    </div>
    <div v-if="overview" class="hero-kpis">
      <div v-for="k in overview.kpis" :key="k.key" class="hero-kpi">
        <span class="kpi-label">{{ k.label }}</span>
        <span class="kpi-value">{{ k.value }}</span>
        <Sparkline :values="k.trend" :label="k.label" />
        <div class="kpi-foot"><span v-if="k.delta" class="delta" :class="{ down: k.down }">{{ k.delta }}</span><span>{{ k.note }}</span></div>
      </div>
    </div>
  </section>

  <div v-if="error" class="error" role="alert">{{ error }}</div>

  <section v-if="systems" id="systems" class="section rise" aria-labelledby="systems-h">
    <div class="section-head">
      <h2 id="systems-h">Systems</h2>
      <span class="hint">Checked every minute<template v-if="systems.lastCheckAt"> · last check {{ clock(systems.lastCheckAt) }}</template></span>
    </div>
    <div class="grid-sys">
      <article v-for="c in systems.cards" :key="c.id" class="sys" :class="`edge-${c.id}`">
        <div class="sys-top">
          <div class="sys-mark" :class="`mark-${c.id}`">{{ c.initials }}</div>
          <div class="sys-name"><h3>{{ c.name }}</h3><span>{{ c.domain }}</span></div>
          <button v-if="canNote(c)" type="button" class="pill" :class="pillClass(c)" :title="`Set a note on ${c.name}`" @click="editCard(c)"><span class="live" />{{ pillText(c) }}</button>
          <span v-else class="pill" :class="pillClass(c)"><span class="live" />{{ pillText(c) }}</span>
        </div>
        <div class="stats"><div v-for="s in c.stats" :key="s.l" class="stat"><b>{{ s.v }}</b>{{ s.l }}</div></div>
        <UptimeStrip :days="c.days" />
        <div class="strip-note"><span>30 days ago</span><span>Today</span></div>
        <div class="sys-foot">
          <span>Uptime {{ c.uptime == null ? '—' : `${c.uptime.toFixed(2)}%` }}</span>
          <span>{{ c.lastDeploy ? `Deployed ${shortDate(c.lastDeploy)}` : 'Deploy date unknown' }}</span>
        </div>
      </article>
    </div>
  </section>

  <div v-if="visitors" class="row rise">
    <section id="visitors" class="card wide" aria-labelledby="visitors-h">
      <div class="section-head">
        <div><h2 id="visitors-h">Website visitors</h2><span class="hint">Unique visitors per day, last 14 days</span></div>
        <div class="legend"><span v-for="s in visitors.sites" :key="s"><i :style="{ background: siteColour(s) }" />{{ s }}</span></div>
      </div>
      <TrendChart v-if="hasVisitors" :days="visitors.days" :sites="visitors.sites" />
      <p v-else class="empty">No visitor numbers yet. They start once the site logs are being read.</p>
    </section>

    <section class="card narrow spread" aria-labelledby="sources-h">
      <h2 id="sources-h">How visitors find us</h2>
      <div v-for="s in visitors.sources" :key="s.name" class="source">
        <div><span>{{ s.name }}</span><b>{{ s.pct }}%</b></div>
        <div class="track"><div class="fill" :style="{ width: `${s.pct}%` }" /></div>
      </div>
      <p v-if="!visitors.sources.length" class="empty">Nothing to show yet.</p>
    </section>
  </div>

  <div v-if="hasVisitors" class="row rise">
    <section class="card wide" aria-labelledby="places-h">
      <div><h2 id="places-h">Where visitors are</h2><span class="hint">Visits in the last 14 days. Cities are estimates: a phone often shows the city of its network.</span></div>
      <div v-if="visitors.locations.countries.length" class="places">
        <div v-for="g in places" :key="g.title">
          <h3>{{ g.title }}</h3>
          <div v-for="p in g.rows" :key="p.name" class="source">
            <div><span>{{ p.name }}</span><b>{{ number(p.n) }} · {{ p.pct }}%</b></div>
            <div class="track"><div class="fill" :style="{ width: `${p.pct}%` }" /></div>
          </div>
        </div>
      </div>
      <p v-else class="empty">Nothing to show yet.</p>
      <p class="geo-credit"><a href="https://db-ip.com" target="_blank" rel="noopener">IP Geolocation by DB-IP</a></p>
    </section>
  </div>

  <div class="row rise">
    <section v-if="overview?.signups.length" class="card wide" aria-labelledby="new-h">
      <div class="section-head"><h2 id="new-h">New sign-ups</h2><router-link to="/users" class="linkbtn">All users</router-link></div>
      <div class="scroll">
        <table style="min-width: 560px">
          <thead><tr><th>Name</th><th>System</th><th>Type</th><th>Location</th><th class="right">When</th></tr></thead>
          <tbody>
            <tr v-for="(u, i) in overview.signups" :key="i">
              <td class="strong">{{ u.name }}</td>
              <td><span class="tag" :class="`tag-${u.system}`">{{ SYSTEM_LABEL[u.system] }}</span></td>
              <td>{{ u.type }}</td>
              <td>{{ u.location }}</td>
              <td class="right nowrap">{{ timeAgo(u.joined) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="alerts" class="card narrow" aria-labelledby="alerts-h">
      <div class="section-head">
        <h2 id="alerts-h">Needs attention</h2>
        <button v-if="noteSystems.length" type="button" class="linkbtn" @click="openNote">Add note</button>
      </div>
      <div v-for="a in alerts" :key="a.id" class="alert">
        <span class="dot" :class="{ bad: a.level === 'bad' }" />
        <div>{{ a.title }}<small>{{ a.detail }}</small></div>
        <button v-if="a.noteId" type="button" class="linkbtn" @click="closeNote(a.noteId)">Close</button>
      </div>
      <p v-if="!alerts.length" class="empty">All clear.</p>
    </section>
  </div>

  <section v-if="systems?.server" class="card rise" aria-labelledby="server-h">
    <div class="section-head"><h2 id="server-h">Server and services</h2><span class="hint">Contabo VPS</span></div>
    <div class="tiles">
      <div v-for="t in systems.server" :key="t.key" class="tile">
        <div class="tile-top">{{ t.name }}<span class="dot" :class="{ ok: t.level === 'ok', bad: t.level === 'bad' }" /></div>
        <b>{{ t.value }}</b>
        <div class="meter"><div :class="t.level" :style="{ width: `${t.pct}%` }" /></div>
        {{ t.note }}
      </div>
    </div>
  </section>

  <div v-if="editing" class="panel" @click.self="editing = null">
    <form class="dialog form" @submit.prevent="saveCard">
      <h2>{{ editing.name }} note</h2>
      <p class="hint">Shown on the card, for example "In App Review". Leave empty to go back to the live status.</p>
      <label>Note<input v-model="noteDraft" class="input" maxlength="40" /></label>
      <div class="buttons"><button class="btn primary">Save</button><button type="button" class="btn" @click="editing = null">Cancel</button></div>
    </form>
  </div>

  <div v-if="adding" class="panel" @click.self="adding = false">
    <form class="dialog form" @submit.prevent="saveNote">
      <h2>Add a note</h2>
      <label>System<select v-model="draft.system"><option v-for="s in noteSystems" :key="s" :value="s">{{ SYSTEM_LABEL[s] }}</option></select></label>
      <label>Title<input v-model="draft.title" class="input" maxlength="140" required /></label>
      <label>Detail<input v-model="draft.detail" class="input" maxlength="300" /></label>
      <label>Importance<select v-model="draft.severity"><option value="warn">Warning</option><option value="bad">Urgent</option></select></label>
      <div class="buttons"><button class="btn primary">Save</button><button type="button" class="btn" @click="adding = false">Cancel</button></div>
    </form>
  </div>
</template>
