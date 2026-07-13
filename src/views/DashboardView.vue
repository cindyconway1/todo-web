<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Calendar, HeartHandshake, Inbox, ListTodo, LogOut, Trophy, Users } from '@lucide/vue'

import PriorityBadge from '@/components/PriorityBadge.vue'
import type { components } from '@/api/schema'
import { useAuthStore } from '@/stores/auth'
import { useDashboardStore } from '@/stores/dashboard'
import { EntityError } from '@/stores/entityError'

type GroupDto = components['schemas']['GroupDto']

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

// Fixed render order. scopeType is lowercase to match the list-detail links the entity
// views already emit (e.g. /lists/league/{id}); the People group holds volunteers.
const groupDefs = [
  { key: 'leagues', title: 'Leagues', scopeType: 'league', icon: Trophy },
  { key: 'teams', title: 'Teams', scopeType: 'team', icon: Users },
  { key: 'people', title: 'People', scopeType: 'volunteer', icon: HeartHandshake },
] as const

const router = useRouter()
const authStore = useAuthStore()
const dashboardStore = useDashboardStore()

const dashboardError = ref('')

const groups = computed(() =>
  groupDefs.map((def) => ({
    ...def,
    entities: (dashboardStore.dashboard?.[def.key] ?? []) as GroupDto[],
  })),
)

const isEmpty = computed(
  () => dashboardStore.loaded && groups.value.every((group) => group.entities.length === 0),
)

onMounted(async () => {
  try {
    await dashboardStore.fetchDashboard()
  } catch (err) {
    dashboardError.value =
      err instanceof EntityError ? err.message : 'Something went wrong. Please try again.'
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
          class="group flex items-center gap-1.5 text-sm text-accent transition-colors duration-150 hover:underline focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <Inbox class="size-4 transition-transform duration-150 group-hover:scale-110" aria-hidden="true" />
          All items
        </RouterLink>
      </div>

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

      <p
        v-if="dashboardError"
        role="alert"
        class="mt-8 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >
        {{ dashboardError }}
      </p>

      <p v-else-if="dashboardStore.loading && !dashboardStore.loaded" class="mt-8 text-muted">
        Loading your lists…
      </p>

      <div
        v-else-if="isEmpty"
        data-testid="empty-state"
        class="mt-8 flex flex-col items-center gap-3 rounded-md border border-subtle bg-card px-6 py-16 text-center"
      >
        <ListTodo class="size-10 text-muted" aria-hidden="true" />
        <p class="text-muted">Welcome! Nothing here yet.</p>
        <p class="text-sm text-muted">
          Create a league, team, or volunteer above — each one gets its own to-do list, and they
          all show up here.
        </p>
      </div>

      <!-- Groups, lists and items render exactly as the API returns them: the server
           pre-sorts items (due date asc, nulls last) and excludes completed ones, so
           nothing here re-sorts or re-filters. -->
      <template v-else>
        <section
          v-for="group in groups.filter((candidate) => candidate.entities.length > 0)"
          :key="group.key"
          :data-testid="`group-${group.key}`"
          class="mt-10"
        >
          <h2 class="flex items-center gap-2 text-lg font-semibold text-default">
            <component :is="group.icon" class="size-5 text-accent" aria-hidden="true" />
            {{ group.title }}
          </h2>

          <div class="mt-4 space-y-4">
            <article
              v-for="entity in group.entities"
              :key="entity.entityId"
              class="rounded-md border border-subtle bg-card p-5"
            >
              <RouterLink
                :to="`/lists/${group.scopeType}/${entity.entityId}`"
                class="font-medium text-default transition-colors duration-150 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {{ entity.entityName }}
              </RouterLink>

              <div v-for="list in entity.lists" :key="list.listId" class="mt-3">
                <RouterLink
                  :to="`/lists/${group.scopeType}/${entity.entityId}`"
                  class="text-sm text-muted transition-colors duration-150 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {{ list.listName }}
                </RouterLink>

                <p v-if="!list.items?.length" class="mt-2 text-sm text-muted">All caught up!</p>
                <ul v-else class="mt-2 space-y-2">
                  <li
                    v-for="item in list.items"
                    :key="item.id"
                    data-testid="dashboard-item"
                    class="flex items-start justify-between gap-3 rounded-md border border-subtle bg-canvas px-3 py-2"
                  >
                    <div class="min-w-0 space-y-0.5">
                      <p class="text-sm font-medium text-default">{{ item.title }}</p>
                      <p v-if="item.description" class="text-xs text-muted">
                        {{ item.description }}
                      </p>
                    </div>
                    <div class="flex shrink-0 flex-col items-end gap-1">
                      <PriorityBadge v-if="item.priorityName" :name="item.priorityName" />
                      <p
                        v-if="item.dueDate"
                        class="flex items-center gap-1.5 text-xs text-muted"
                      >
                        <Calendar class="size-3.5" aria-hidden="true" />
                        <!-- dueDate is the contract's date-only YYYY-MM-DD string; shown as-is. -->
                        <span>Due {{ item.dueDate }}</span>
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </article>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped></style>
