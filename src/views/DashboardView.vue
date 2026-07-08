<script setup lang="ts">
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

async function onLogout(): Promise<void> {
  await authStore.logout()
  await router.push('/login')
}
</script>

<template>
  <div>
    <header>
      <span v-if="authStore.user">{{ authStore.user.email }}</span>
      <button type="button" @click="onLogout">Log out</button>
    </header>
    <main>
      <h1>Dashboard</h1>
      <p>Your lists will appear here.</p>
    </main>
  </div>
</template>

<style scoped></style>
