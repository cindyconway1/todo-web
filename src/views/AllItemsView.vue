<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowLeft, CalendarDays, CircleCheckBig, ListChecks } from '@lucide/vue'

import type { components } from '@/api/schema'
import { useAllItemsStore } from '@/stores/allItems'
import { EntityError } from '@/stores/entityError'

type AllItemDto = components['schemas']['AllItemDto']

const allItemsStore = useAllItemsStore()

const listError = ref('')

onMounted(loadItems)

async function loadItems(): Promise<void> {
  listError.value = ''
  try {
    await allItemsStore.fetchAll()
  } catch (err) {
    listError.value =
      err instanceof EntityError ? err.message : 'Something went wrong. Please try again.'
  }
}

// Fixed locale so the label is stable regardless of the browser's region settings.
const dueDateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function formatDueDate(dueDate: string): string {
  // Parse the date part as local time - `new Date('yyyy-mm-dd')` is UTC and can
  // shift the displayed day in western timezones.
  return dueDateFormat.format(new Date(`${dueDate.slice(0, 10)}T00:00:00`))
}

// e.g. "Team · Wildcats / Groceries" - names the scope and list an item came
// from, since this view flattens that structure away. No click-through link:
// AllItemDto carries no scope entity id to route to.
function sourceLabel(item: AllItemDto): string {
  const scope = [item.scopeType, item.scopeName].filter(Boolean).join(' · ')
  return [scope, item.listName].filter(Boolean).join(' / ')
}
</script>

<template>
  <div class="min-h-screen bg-canvas text-default">
    <header class="border-b border-subtle bg-card">
      <div class="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
        <RouterLink
          to="/"
          class="group flex items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-accent"
        >
          <ArrowLeft
            class="size-4 transition-transform duration-150 group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
          Dashboard
        </RouterLink>
        <span class="text-muted" aria-hidden="true">/</span>
        <div class="flex items-center gap-2 font-semibold">
          <ListChecks class="size-5 text-accent" aria-hidden="true" />
          <span>All Items</span>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold text-default">All Items</h1>
        <p class="text-sm text-muted">
          Everything still to do, across all of your lists, soonest due first.
        </p>
      </div>

      <p
        v-if="listError"
        role="alert"
        class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >
        {{ listError }}
      </p>

      <p v-if="allItemsStore.loading" class="text-muted">Loading items…</p>

      <div
        v-else-if="allItemsStore.loaded && allItemsStore.items.length === 0"
        data-testid="empty-state"
        class="flex flex-col items-center gap-3 rounded-md border border-subtle bg-card px-6 py-16 text-center"
      >
        <CircleCheckBig class="size-10 text-success" aria-hidden="true" />
        <p class="font-medium text-default">All clear!</p>
        <p class="text-sm text-muted">Nothing left to do across any of your lists.</p>
      </div>

      <ul v-else class="space-y-3">
        <li
          v-for="item in allItemsStore.items"
          :key="item.id"
          data-testid="all-item"
          class="rounded-md border border-subtle bg-card p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 space-y-1">
              <p data-testid="item-title" class="font-medium text-default">{{ item.title }}</p>
              <p v-if="item.description" class="text-sm text-muted">{{ item.description }}</p>
              <p data-testid="source-label" class="text-xs text-muted">
                {{ sourceLabel(item) }}
              </p>
            </div>
            <p
              v-if="item.dueDate"
              data-testid="due-date"
              class="flex shrink-0 items-center gap-1.5 text-sm text-muted"
            >
              <CalendarDays class="size-4" aria-hidden="true" />
              {{ formatDueDate(item.dueDate) }}
            </p>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>

<style scoped></style>
