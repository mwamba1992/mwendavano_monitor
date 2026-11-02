<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ApiError, get, patch, post, session, type Level, type SystemKey } from '@/api'
import { initials, LEVEL_LABEL, logTime, SYSTEM_LABEL, timeAgo } from '@/format'

const SYSTEMS: SystemKey[] = ['mauzo', 'soko', 'wafanyakazi', 'cargo', 'server']
const LEVELS: Level[] = ['admin', 'support', 'view', 'none']
const COLOURS = ['#2f5e59', '#7a4a00', '#22396b', '#3d4a08', '#8a1c12', '#0f6b6b']

const me = computed(() => session.me!)
const team = ref<any[]>([])
const log = ref<any[]>([])
const person = ref<number | null>(null)
const error = ref('')
const who = computed(() => team.value.find((t) => t.id === person.value)?.name ?? 'everyone')

const blank = () => ({ name: '', phone: '', email: '', jobRole: '', access: { mauzo: 'none', soko: 'none', wafanyakazi: 'none', cargo: 'none', server: 'none' } as Record<SystemKey, Level> })
const form = ref(blank())
/** null = closed, 0 = inviting, otherwise the id being edited. */
const editing = ref<number | null>(null)
const formError = ref('')
const secret = ref<{ name: string; password: string } | null>(null)
const target = computed(() => team.value.find((t) => t.id === editing.value))
const canEdit = (t: any) => t.id !== me.value.id && (!t.isOwner || me.value.isOwner)
/** Staff who manage others but are not the owner cannot hand out Admin on Server. */
const levelsFor = (s: SystemKey) => (s === 'server' && !me.value.isOwner && form.value.access.server !== 'admin' ? LEVELS.filter((l) => l !== 'admin') : LEVELS)

async function loadTeam() {
  try {
    team.value = await get('/staff')
  } catch (e) {
    if (e instanceof ApiError) error.value = e.message
  }
}
async function loadLog() {
  log.value = await get(`/activity${person.value ? `?staffId=${person.value}` : ''}`).catch(() => [])
}

function openInvite() {
  form.value = blank()
  formError.value = ''
  editing.value = 0
}
function openEdit(t: any) {
  form.value = { name: t.name, phone: t.phone, email: t.email ?? '', jobRole: t.jobRole, access: { ...t.access } }
  formError.value = ''
  editing.value = t.id
}

async function run(fn: () => Promise<any>) {
  formError.value = ''
  try {
    const r = await fn()
    if (r.temporaryPassword) secret.value = { name: r.staff.name, password: r.temporaryPassword }
    editing.value = null
    await Promise.all([loadTeam(), loadLog()])
  } catch (e) {
    if (e instanceof ApiError) formError.value = e.message
  }
}
const save = () => run(() => (editing.value === 0 ? post('/staff/invite', form.value) : patch(`/staff/${editing.value}`, { name: form.value.name, email: form.value.email, jobRole: form.value.jobRole, access: form.value.access })))
const action = (b: object) => run(() => patch(`/staff/${editing.value}`, b))

watch(person, loadLog)
onMounted(() => Promise.all([loadTeam(), loadLog()]))
</script>

<template>
  <header class="head">
    <div class="head-text"><span>Who on the Mwendavano team can see what</span><h1>Staff and access</h1></div>
    <div class="head-tools"><button type="button" class="btn primary" @click="openInvite">Invite staff</button></div>
  </header>

  <div v-if="error" class="error" role="alert">{{ error }}</div>

  <section class="card" aria-labelledby="team-h">
    <div class="section-head"><h2 id="team-h">Team</h2><span class="hint">Tap a person to see their activity</span></div>
    <div class="scroll">
      <table style="min-width: 900px">
        <thead><tr><th>Person</th><th>Role</th><th v-for="s in SYSTEMS" :key="s" class="center">{{ SYSTEM_LABEL[s] }}</th><th>Two-step login</th><th>Last seen</th><th /></tr></thead>
        <tbody>
          <tr v-for="(t, i) in team" :key="t.id" :class="{ picked: person === t.id }">
            <td>
              <button type="button" class="person" :aria-pressed="person === t.id" @click="person = person === t.id ? null : t.id">
                <span class="avatar" :style="{ background: COLOURS[i % COLOURS.length] }">{{ initials(t.name) }}</span>
                <span><b>{{ t.name }}</b><small>{{ t.email || t.phone }}</small></span>
              </button>
            </td>
            <td>{{ t.jobRole }}<template v-if="!t.active"> · off</template></td>
            <td v-for="s in SYSTEMS" :key="s" class="center"><span class="lvl" :class="`lvl-${t.access[s]}`">{{ LEVEL_LABEL[t.access[s]] }}</span></td>
            <td><span class="pill" :class="{ bad: !t.twoFactorMethod }">{{ t.twoFactorMethod ? 'On' : 'Off' }}</span></td>
            <td class="nowrap">{{ timeAgo(t.lastSeenAt) }}</td>
            <td><button v-if="canEdit(t)" type="button" class="linkbtn" @click="openEdit(t)">Edit</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="legend" style="font-size: 12px; color: var(--ink-2)">
      <span><b class="lvl lvl-admin">Admin</b>everything, full phone numbers</span>
      <span><b class="lvl lvl-support">Support</b>see users and details</span>
      <span><b class="lvl lvl-view">View</b>numbers only</span>
      <span><b class="lvl lvl-none">None</b>no access</span>
    </div>
  </section>

  <section class="card" style="gap: 4px" aria-labelledby="log-h">
    <div class="section-head" style="padding-bottom: 8px"><h2 id="log-h">Activity: {{ who }}</h2><span class="hint">Every staff action in the Monitor is recorded here</span></div>
    <div v-for="l in log" :key="l.id" class="logline">
      <time>{{ logTime(l.createdAt) }}</time>
      <span class="tag" :class="l.system ? `tag-${l.system}` : ''">{{ SYSTEM_LABEL[l.system] ?? 'Monitor' }}</span>
      <span>{{ l.staffName }}: {{ l.text }}</span>
    </div>
    <p v-if="!log.length" class="empty">No activity yet.</p>
  </section>

  <div v-if="editing !== null" class="panel" @click.self="editing = null">
    <form class="dialog form" @submit.prevent="save">
      <h2>{{ editing === 0 ? 'Invite staff' : `Edit ${target?.name}` }}</h2>
      <div v-if="formError" class="error" role="alert">{{ formError }}</div>
      <label>Name<input v-model="form.name" class="input" maxlength="120" required /></label>
      <label v-if="editing === 0">Phone<input v-model="form.phone" class="input" type="tel" required /></label>
      <label>Email (optional)<input v-model="form.email" class="input" type="email" maxlength="160" /></label>
      <label>Role<input v-model="form.jobRole" class="input" maxlength="80" placeholder="Customer support" /></label>
      <div class="access-grid">
        <label v-for="s in SYSTEMS" :key="s">{{ SYSTEM_LABEL[s] }}
          <select v-model="form.access[s]"><option v-for="l in levelsFor(s)" :key="l" :value="l">{{ LEVEL_LABEL[l] }}</option></select>
        </label>
      </div>
      <p class="hint">Anyone with Admin on a system must use two-step login. Admin on Server also lets them manage staff.</p>
      <div class="buttons">
        <button class="btn primary">{{ editing === 0 ? 'Send invite' : 'Save' }}</button>
        <button type="button" class="btn" @click="editing = null">Cancel</button>
      </div>
      <div v-if="editing !== 0" class="buttons">
        <button type="button" class="btn" @click="action({ resetPassword: true })">Reset password</button>
        <button type="button" class="btn" @click="action({ resetTwoStep: true })">Reset two-step</button>
        <button type="button" class="btn" @click="action({ active: !target?.active })">{{ target?.active ? 'Turn account off' : 'Turn account on' }}</button>
      </div>
    </form>
  </div>

  <div v-if="secret" class="panel">
    <div class="dialog">
      <h2>Temporary password for {{ secret.name }}</h2>
      <p class="hint">Give it to them privately. It is shown only now, and they must change it when they first sign in.</p>
      <div class="secret">{{ secret.password }}</div>
      <div class="buttons"><button type="button" class="btn primary" @click="secret = null">Done</button></div>
    </div>
  </div>
</template>
