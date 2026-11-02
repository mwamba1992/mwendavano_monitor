<script setup lang="ts">
import { computed, ref } from 'vue'
import { ApiError, post, session } from '@/api'

const me = computed(() => session.me!)
const current = ref('')
const next = ref('')
const error = ref('')
const done = ref('')

async function changePassword() {
  error.value = done.value = ''
  try {
    const r = await post('/auth/password', { current: current.value, next: next.value })
    session.token = r.accessToken
    session.me = r.staff
    current.value = next.value = ''
    done.value = 'Password changed.'
  } catch (e) {
    if (e instanceof ApiError) error.value = e.message
  }
}
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
</template>
