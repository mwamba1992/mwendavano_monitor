<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { post, session } from '@/api'

const router = useRouter()
const phone = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const r = await post('/auth/login', { phone: phone.value, password: password.value })
    session.token = r.accessToken
    session.me = r.staff
    await router.replace(r.staff.mustChangePassword ? '/account' : '/')
  } catch (e: any) {
    error.value = e.message
    password.value = ''
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
      <div class="form">
        <label>Phone<input v-model="phone" class="input" type="tel" autocomplete="username" required /></label>
        <label>Password<input v-model="password" class="input" type="password" autocomplete="current-password" required /></label>
      </div>
      <button class="btn primary" type="submit" :disabled="busy">Sign in</button>
    </form>
  </div>
</template>
