<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import QRCode from 'qrcode'

const props = defineProps<{ uri: string; secret: string }>()
const src = ref('')
watchEffect(async () => {
  src.value = await QRCode.toDataURL(props.uri, { width: 360, margin: 1 })
})
</script>

<template>
  <img v-if="src" :src="src" class="qr" alt="QR code for your authenticator app" />
  <p class="hint">Or type this key into the app:</p>
  <div class="secret">{{ secret }}</div>
</template>
