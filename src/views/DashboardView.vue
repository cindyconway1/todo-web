<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ListTodo, LogOut } from '@lucide/vue'

import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

async function onLogout(): Promise<void> {
  await authStore.logout()
  await router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-canvas text-default">
    <header class="border-b border-subtle bg-card">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <div class="flex items-center gap-2 font-semibold">
          <ListTodo class="size-5 text-accent" aria-hidden="true" />
          <span>ToDo</span>
        </div>
        <div class="flex items-center gap-4">
          <span v-if="authStore.user" class="text-sm text-muted">{{ authStore.user.email }}</span>
          <button
            type="button"
            class="group flex items-center gap-2 rounded-md border border-subtle bg-card px-3 py-1.5 text-sm text-default transition-colors duration-150 hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
            @click="onLogout"
          >
            <LogOut
              class="size-4 transition-transform duration-150 group-hover:-translate-x-0.5"
              aria-hidden="true"
            />
            Log out
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-12">
      <h1 class="text-2xl font-semibold text-default">Dashboard</h1>

      <div
        class="mt-8 flex flex-col items-center gap-3 rounded-md border border-subtle bg-card px-6 py-16 text-center"
      >
        <ListTodo class="size-10 text-muted" aria-hidden="true" />
        <p class="text-muted">Your lists will appear here.</p>
      </div>
    </main>
  </div>
</template>

<style scoped></style>
