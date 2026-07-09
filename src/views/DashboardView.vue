<script setup lang="ts">
import { useRouter } from 'vue-router'
import { HeartHandshake, ListTodo, LogOut, Trophy, Users } from '@lucide/vue'

import { useAuthStore } from '@/stores/auth'

const sections = [
  { to: '/leagues', label: 'Leagues', description: 'Manage your leagues.', icon: Trophy },
  {
    to: '/teams',
    label: 'Teams',
    description: 'Manage teams and tag them to a league.',
    icon: Users,
  },
  {
    to: '/volunteers',
    label: 'Volunteers',
    description: 'Manage volunteers and tag them to a league and teams.',
    icon: HeartHandshake,
  },
]

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

      <nav class="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Entity management">
        <RouterLink
          v-for="section in sections"
          :key="section.to"
          :to="section.to"
          class="group flex flex-col gap-2 rounded-md border border-subtle bg-card p-5 transition-colors duration-150 hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <component
            :is="section.icon"
            class="size-6 text-accent transition-transform duration-150 group-hover:scale-110"
            aria-hidden="true"
          />
          <span class="font-medium text-default">{{ section.label }}</span>
          <span class="text-sm text-muted">{{ section.description }}</span>
        </RouterLink>
      </nav>

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
