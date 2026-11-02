<script setup lang="ts">
import { computed, ref } from 'vue'
import { ApiError, post, session } from '@/api'
import QrCode from '@/components/QrCode.vue'

const me = computed(() => session.me!)
const current = ref('')
const next = ref('')
const code = ref('')
const setup = ref<{ secret: string; otpauthUri: string } | null>(null)
const error = ref('')
const done = ref('')

async function run(fn: () => Promise<void>, ok: string) {
  error.value = done.value = ''
  try {
    await fn()
    done.value = ok
  } catch (e) {
    if (e instanceof ApiError) error.value = e.message
  }
}

const changePassword = () =>
  run(async () => {
    const r = await post('/auth/password', { current: current.value, next: next.value })
    session.token = r.accessToken
    session.me = r.staff
    current.value = next.value = ''
  }, 'Password changed.')

const startApp = () =>
  run(async () => {
    setup.value = await post('/auth/two-step/app')
  }, '')
const confirmApp = () =>
  run(async () => {
    session.me = await post('/auth/two-step/app/confirm', { code: code.value })
    setup.value = null
    code.value = ''
  }, 'Two-step login is on.')
const useSms = () =>
  run(async () => {
    session.me = await post('/auth/two-step/sms')
  }, 'Two-step login by SMS is on.')
const turnOff = () =>
  run(async () => {
    session.me = await post('/auth/two-step/off')
  }, 'Two-step login is off.')
</script>

<template>
  <header class="head"><div class="head-text"><span>{{ me.phone }}</span><h1>Your account</h1></div></header>

  <div v-if="me.mustChangePassword" class="notice">Choose your own password to start using the Monitor.</div>
  <div v-if="error" class="error" role="alert">{{ error }}</div>
  <div v-if="done" class="notice" style="background: var(--ok-bg); color: var(--ok)">{{ done }}</div>

  <section class="card" style="max-width: 520px">
    <h2>Password</h2>
    <form class="form" @submit.prevent="changePassword">
      <label>Current password<input v-model="current" class="input" type="password" autocomplete="current-password" required /></label>
      <label>New password<input v-model="next" class="input" type="password" autocomplete="new-password" minlength="10" required /></label>
      <p class="hint">At least 10 characters.</p>
      <div class="buttons"><button class="btn primary">Change password</button></div>
    </form>
  </section>

  <section v-if="!me.mustChangePassword" class="card" style="max-width: 520px">
    <h2>Two-step login</h2>
    <p class="hint">
      <template v-if="me.twoFactorMethod === 'totp'">On, with an authenticator app.</template>
      <template v-else-if="me.twoFactorMethod === 'sms'">On, with a code by SMS.</template>
      <template v-else>Off.</template>
      <template v-if="me.twoStepRequired"> Required, because you have Admin access.</template>
    </p>
    <form v-if="setup" class="form" @submit.prevent="confirmApp">
      <QrCode :uri="setup.otpauthUri" :secret="setup.secret" />
      <label>Code from the app<input v-model="code" class="input" inputmode="numeric" maxlength="6" required /></label>
      <div class="buttons"><button class="btn primary">Turn on</button></div>
    </form>
    <div v-else class="buttons">
      <button v-if="me.twoFactorMethod !== 'totp'" type="button" class="btn" @click="startApp">Use an authenticator app</button>
      <button v-if="me.smsAvailable && me.twoFactorMethod !== 'sms'" type="button" class="btn" @click="useSms">Use SMS codes</button>
      <button v-if="me.twoFactorMethod && !me.twoStepRequired" type="button" class="btn" @click="turnOff">Turn off</button>
    </div>
  </section>
</template>
