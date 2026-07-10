<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  Circle,
  HeartHandshake,
  ListTodo,
  LogOut,
  Trophy,
  Users,
} from '@lucide/vue'

import { useAuthStore } from '@/stores/auth'
import { useDashboardStore } from '@/stores/dashboard'
import { EntityError } from '@/stores/entityError'

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
const dashboardStore = useDashboardStore()

const loadError = ref('')

// Route tokens are the backend ScopeType enum names (League / Team / Volunteer),
// lowercased for the kebab-case URL convention.
const groups = computed(() => {
  const dashboard = dashboardStore.dashboard
  return [
    {
      key: 'leagues',
      label: 'Leagues',
      icon: Trophy,
      scopeType: 'league',
      entities: dashboard?.leagues ?? [],
    },
    {
      key: 'teams',
      label: 'Teams',
      icon: Users,
      scopeType: 'team',
      entities: dashboard?.teams ?? [],
    },
    {
      key: 'people',
      label: 'People',
      icon: HeartHandshake,
      scopeType: 'volunteer',
      entities: dashboard?.people ?? [],
    },
  ]
})

const populatedGroups = computed(() => groups.value.filter((group) => group.entities.length > 0))
const isEmpty = computed(() => populatedGroups.value.length === 0)

onMounted(loadDashboard)

async function loadDashboard(): Promise<void> {
  loadError.value = ''
  try {
    await dashboardStore.fetchDashboard()
  } catch (err) {
    loadError.value =
      err instanceof EntityError ? err.message : 'Something went wrong. Please try again.'
  }
}

function formatDueDate(dueDate: string): string {
  return new Date(dueDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

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

    <main class="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <div class="flex items-center justify-between gap-4">
        <h1 class="text-2xl font-semibold text-default">Dashboard</h1>
        <RouterLink
          to="/all-items"
          class="group flex items-center gap-1.5 text-sm text-accent transition-colors duration-150 hover:text-accent-hover"
        >
          All items
          <ArrowRight
            class="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </RouterLink>
      </div>

      <nav class="grid gap-4 sm:grid-cols-3" aria-label="Entity management">
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

      <p
        v-if="loadError"
        role="alert"
        class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >
        {{ loadError }}
      </p>

      <p v-else-if="dashboardStore.loading" class="text-muted">Loading your lists…</p>

      <div
        v-else-if="dashboardStore.loaded && isEmpty"
        data-testid="empty-state"
        class="flex flex-col items-center gap-3 rounded-md border border-subtle bg-card px-6 py-16 text-center"
      >
        <ListTodo class="size-10 text-muted" aria-hidden="true" />
        <p class="text-muted">No to-do lists yet.</p>
        <p class="text-sm text-muted">
          Create a league, team, or volunteer above and its to-do list will show up here.
        </p>
      </div>

      <template v-else-if="dashboardStore.loaded">
        <section
          v-for="group in populatedGroups"
          :key="group.key"
          class="space-y-3"
          :aria-label="group.label"
          :data-testid="`group-${group.key}`"
        >
          <h2 class="flex items-center gap-2 text-lg font-semibold text-default">
            <component :is="group.icon" class="size-5 text-accent" aria-hidden="true" />
            {{ group.label }}
          </h2>

          <div
            v-for="entity in group.entities"
            :key="entity.entityId"
            data-testid="entity-card"
            class="space-y-3 rounded-md border border-subtle bg-card p-4"
          >
            <RouterLink
              :to="`/lists/${group.scopeType}/${entity.entityId}`"
              class="font-medium text-default transition-colors duration-150 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {{ entity.entityName }}
            </RouterLink>

            <div v-for="list in entity.lists ?? []" :key="list.listId" class="space-y-2">
              <RouterLink
                :to="`/lists/${group.scopeType}/${entity.entityId}`"
                class="text-sm text-muted transition-colors duration-150 hover:text-accent"
              >
                {{ list.listName }}
              </RouterLink>

              <ul v-if="list.items?.length" class="space-y-2">
                <li
                  v-for="item in list.items"
                  :key="item.id"
                  data-testid="todo-item"
                  class="flex items-center gap-2 text-sm"
                >
                  <Circle class="size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span class="text-default">{{ item.title }}</span>
                  <span v-if="item.dueDate" class="ml-auto text-xs text-muted">
                    Due {{ formatDueDate(item.dueDate) }}
                  </span>
                </li>
              </ul>
              <p v-else class="text-sm text-muted">All caught up — no open items.</p>
            </div>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped></style>
