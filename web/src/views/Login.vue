<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { post, session } from '@/api'
import QrCode from '@/components/QrCode.vue'

const router = useRouter()
const phone = ref('')
const password = ref('')
const code = ref('')
const step = ref<'password' | 'sms' | 'totp' | 'enroll'>('password')
const challenge = ref('')
const enrol = ref<{ secret: string; otpauthUri: string } | null>(null)
const devCode = ref('')
const error = ref('')
const busy = ref(false)

const prompt = computed(() => ({ sms: 'Enter the code we sent you by SMS.', totp: 'Enter the code from your authenticator app.', enroll: 'Admins must use two-step login. Add this account to an authenticator app, then enter the code it shows.', password: '' })[step.value])

async function finish(r: any) {
  session.token = r.accessToken
  session.me = r.staff
  await router.replace(r.staff.mustChangePassword ? '/account' : '/')
}

async function submit() {
  error.value = ''
  busy.value = true
  try {
    if (step.value === 'password') {
      const r = await post('/auth/login', { phone: phone.value, password: password.value })
      password.value = ''
      if (r.step === 'done') return await finish(r)
      challenge.value = r.challenge
      step.value = r.step
      devCode.value = r.devCode ?? ''
      if (r.step === 'enroll') enrol.value = { secret: r.secret, otpauthUri: r.otpauthUri }
    } else {
      await finish(await post('/auth/verify', { challenge: challenge.value, code: code.value.trim() }))
    }
  } catch (e: any) {
    error.value = e.message
    code.value = ''
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="login">
    <form class="dialog" @submit.prevent="submit">
      <div class="brand"><div class="brand-mark">M</div><div class="brand-text">Mwendavano<small style="color: var(--muted)">Monitor</small></div></div>
      <h1 style="font-size: 24px">Sign in</h1>
      <div v-if="error" class="error" role="alert">{{ error }}</div>
      <div class="form" v-if="step === 'password'">
        <label>Phone<input v-model="phone" class="input" type="tel" autocomplete="username" required /></label>
        <label>Password<input v-model="password" class="input" type="password" autocomplete="current-password" required /></label>
      </div>
      <div class="form" v-else>
        <p class="hint">{{ prompt }}</p>
        <QrCode v-if="enrol" :uri="enrol.otpauthUri" :secret="enrol.secret" />
        <p v-if="devCode" class="notice">Local development code: {{ devCode }}</p>
        <label>Code<input v-model="code" class="input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required /></label>
      </div>
      <button class="btn primary" type="submit" :disabled="busy">{{ step === 'password' ? 'Continue' : 'Sign in' }}</button>
    </form>
  </div>
</template>
