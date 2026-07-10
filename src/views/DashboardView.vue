<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { HeartHandshake, Layers, ListTodo, LogOut, Trophy, Users } from '@lucide/vue'

import { useAuthStore } from '@/stores/auth'
import { useDashboardStore } from '@/stores/dashboard'

const managementLinks = [
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

const loadError = ref<string | null>(null)

// scopeType route tokens use the backend ScopeType enum names (League / Team / Volunteer —
// the People group holds volunteers); the /lists/{scopeType}/{entityId} route must parse
// the same casing.
const groupSections = computed(() => [
  {
    key: 'leagues',
    label: 'Leagues',
    scopeType: 'League',
    icon: Trophy,
    groups: dashboardStore.dashboard?.leagues ?? [],
  },
  {
    key: 'teams',
    label: 'Teams',
    scopeType: 'Team',
    icon: Users,
    groups: dashboardStore.dashboard?.teams ?? [],
  },
  {
    key: 'people',
    label: 'People',
    scopeType: 'Volunteer',
    icon: HeartHandshake,
    groups: dashboardStore.dashboard?.people ?? [],
  },
])

const visibleSections = computed(() =>
  groupSections.value.filter((section) => section.groups.length > 0),
)
const isEmpty = computed(() => visibleSections.value.length === 0)

onMounted(async () => {
  try {
    await dashboardStore.fetchDashboard()
  } catch {
    loadError.value = 'Your lists could not be loaded. Please try again.'
  }
})

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
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold text-default">Dashboard</h1>
        <RouterLink
          to="/all-items"
          class="flex items-center gap-1.5 rounded-md text-sm text-accent transition-colors duration-150 hover:text-accent-hover focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <Layers class="size-4" aria-hidden="true" />
          All Items
        </RouterLink>
      </div>

      <nav class="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Entity management">
        <RouterLink
          v-for="link in managementLinks"
          :key="link.to"
          :to="link.to"
          class="group flex flex-col gap-2 rounded-md border border-subtle bg-card p-5 transition-colors duration-150 hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <component
            :is="link.icon"
            class="size-6 text-accent transition-transform duration-150 group-hover:scale-110"
            aria-hidden="true"
          />
          <span class="font-medium text-default">{{ link.label }}</span>
          <span class="text-sm text-muted">{{ link.description }}</span>
        </RouterLink>
      </nav>

      <p v-if="dashboardStore.loading" class="mt-8 text-muted">Loading your lists…</p>

      <p
        v-else-if="loadError"
        class="mt-8 rounded-md border border-danger px-4 py-3 text-sm text-danger"
      >
        {{ loadError }}
      </p>

      <div
        v-else-if="isEmpty"
        class="mt-8 flex flex-col items-center gap-3 rounded-md border border-subtle bg-card px-6 py-16 text-center"
      >
        <ListTodo class="size-10 text-muted" aria-hidden="true" />
        <p class="font-medium text-default">Nothing to do yet</p>
        <p class="text-sm text-muted">
          Create a league, team, or volunteer above and its to-do list will show up here.
        </p>
      </div>

      <template v-else>
        <section
          v-for="section in visibleSections"
          :key="section.key"
          class="mt-8"
          :aria-label="section.label"
        >
          <h2 class="flex items-center gap-2 text-lg font-semibold text-default">
            <component :is="section.icon" class="size-5 text-accent" aria-hidden="true" />
            {{ section.label }}
          </h2>
          <div class="mt-3 flex flex-col gap-4">
            <article
              v-for="group in section.groups"
              :key="group.entityId"
              class="rounded-md border border-subtle bg-card p-5"
            >
              <RouterLink
                :to="`/lists/${section.scopeType}/${group.entityId}`"
                class="rounded-md font-medium text-default transition-colors duration-150 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {{ group.entityName }}
              </RouterLink>
              <div v-for="list in group.lists ?? []" :key="list.listId" class="mt-3">
                <RouterLink
                  :to="`/lists/${section.scopeType}/${group.entityId}`"
                  class="rounded-md text-sm font-medium text-muted transition-colors duration-150 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {{ list.listName }}
                </RouterLink>
                <!-- Items render exactly as returned: the API pre-sorts (due date asc, nulls
                     last) and excludes completed items, so no client-side sort or filter. -->
                <ul v-if="list.items?.length" class="mt-2 flex flex-col gap-1.5">
                  <li
                    v-for="item in list.items"
                    :key="item.id"
                    class="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span class="text-default">{{ item.title }}</span>
                    <span v-if="item.dueDate" class="shrink-0 text-xs text-muted">
                      Due {{ item.dueDate }}
                    </span>
                  </li>
                </ul>
                <p v-else class="mt-2 text-sm text-muted">No open items.</p>
              </div>
            </article>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped></style>
