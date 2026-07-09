<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ArrowLeft, Pencil, Plus, Trash2, Trophy, X } from '@lucide/vue'

import { EntityError } from '@/stores/entityError'
import { useLeagueStore } from '@/stores/league'
import { applyEntityError, requiredName } from '@/utils/entityForm'

const leagueStore = useLeagueStore()

const listError = ref('')

const createForm = reactive({ name: '' })
const createFieldErrors = reactive<{ name?: string }>({})
const createError = ref('')
const creating = ref(false)

const editingId = ref<string | null>(null)
const editForm = reactive({ name: '' })
const editFieldErrors = reactive<{ name?: string }>({})
const editError = ref('')
const saving = ref(false)

onMounted(loadLeagues)

async function loadLeagues(): Promise<void> {
  listError.value = ''
  try {
    await leagueStore.fetchLeagues()
  } catch (err) {
    listError.value =
      err instanceof EntityError ? err.message : 'Something went wrong. Please try again.'
  }
}

async function onCreate(): Promise<void> {
  createError.value = ''
  createFieldErrors.name = requiredName(createForm.name)
  if (createFieldErrors.name) {
    return
  }

  creating.value = true
  try {
    await leagueStore.createLeague({ name: createForm.name.trim() })
    createForm.name = ''
  } catch (err) {
    applyEntityError(err, createFieldErrors, createError)
  } finally {
    creating.value = false
  }
}

function startEdit(id: string | undefined, name: string | undefined): void {
  editingId.value = id ?? null
  editForm.name = name ?? ''
  editFieldErrors.name = undefined
  editError.value = ''
}

function cancelEdit(): void {
  editingId.value = null
}

async function onSaveEdit(): Promise<void> {
  if (!editingId.value) {
    return
  }
  editError.value = ''
  editFieldErrors.name = requiredName(editForm.name)
  if (editFieldErrors.name) {
    return
  }

  saving.value = true
  try {
    await leagueStore.updateLeague(editingId.value, { name: editForm.name.trim() })
    editingId.value = null
  } catch (err) {
    applyEntityError(err, editFieldErrors, editError)
    if (err instanceof EntityError && err.kind === 'not-found') {
      // The row went stale (deleted elsewhere / ownership changed) - resync the list.
      editingId.value = null
      editError.value = ''
      await loadLeagues()
      listError.value = err.message
    }
  } finally {
    saving.value = false
  }
}

async function onDelete(id: string | undefined): Promise<void> {
  if (!id) {
    return
  }
  listError.value = ''
  try {
    await leagueStore.deleteLeague(id)
    if (editingId.value === id) {
      editingId.value = null
    }
  } catch (err) {
    if (err instanceof EntityError && err.kind === 'not-found') {
      // The row went stale (deleted elsewhere / ownership changed) - resync the list.
      await loadLeagues()
    }
    listError.value =
      err instanceof EntityError ? err.message : 'Something went wrong. Please try again.'
  }
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
          <Trophy class="size-5 text-accent" aria-hidden="true" />
          <span>Leagues</span>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <h1 class="text-2xl font-semibold text-default">Leagues</h1>

      <form
        novalidate
        class="space-y-4 rounded-md border border-subtle bg-card p-6"
        @submit.prevent="onCreate"
      >
        <h2 class="font-medium text-default">New league</h2>

        <p
          v-if="createError"
          role="alert"
          class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {{ createError }}
        </p>

        <div class="space-y-1.5">
          <label for="league-name" class="block text-sm font-medium text-default">Name</label>
          <input
            id="league-name"
            v-model="createForm.name"
            type="text"
            placeholder="e.g. Sunday Rec League"
            class="w-full rounded-md border bg-canvas px-3 py-2 text-default placeholder:text-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent"
            :class="createFieldErrors.name ? 'border-danger' : 'border-subtle'"
          />
          <p v-if="createFieldErrors.name" class="text-sm text-danger">
            {{ createFieldErrors.name }}
          </p>
        </div>

        <button
          type="submit"
          :disabled="creating"
          class="flex items-center gap-2 rounded-md bg-accent px-4 py-2 font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus class="size-4" aria-hidden="true" />
          {{ creating ? 'Creating…' : 'Create league' }}
        </button>
      </form>

      <p
        v-if="listError"
        role="alert"
        class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >
        {{ listError }}
      </p>

      <p v-if="leagueStore.loading" class="text-muted">Loading leagues…</p>

      <div
        v-else-if="leagueStore.loaded && leagueStore.leagues.length === 0"
        data-testid="empty-state"
        class="flex flex-col items-center gap-3 rounded-md border border-subtle bg-card px-6 py-16 text-center"
      >
        <Trophy class="size-10 text-muted" aria-hidden="true" />
        <p class="text-muted">No leagues yet.</p>
        <p class="text-sm text-muted">Create your first league above.</p>
      </div>

      <ul v-else class="space-y-3">
        <li
          v-for="league in leagueStore.leagues"
          :key="league.id"
          class="rounded-md border border-subtle bg-card p-4"
        >
          <form
            v-if="editingId === league.id"
            novalidate
            class="space-y-3"
            @submit.prevent="onSaveEdit"
          >
            <p
              v-if="editError"
              role="alert"
              class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {{ editError }}
            </p>

            <div class="space-y-1.5">
              <label :for="`edit-league-name-${league.id}`" class="sr-only">Name</label>
              <input
                :id="`edit-league-name-${league.id}`"
                v-model="editForm.name"
                type="text"
                class="w-full rounded-md border bg-canvas px-3 py-2 text-default placeholder:text-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent"
                :class="editFieldErrors.name ? 'border-danger' : 'border-subtle'"
              />
              <p v-if="editFieldErrors.name" class="text-sm text-danger">
                {{ editFieldErrors.name }}
              </p>
            </div>

            <div class="flex gap-2">
              <button
                type="submit"
                :disabled="saving"
                class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                {{ saving ? 'Saving…' : 'Save' }}
              </button>
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-md border border-subtle bg-card px-3 py-1.5 text-sm text-default transition-colors duration-150 hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                @click="cancelEdit"
              >
                <X class="size-3.5" aria-hidden="true" />
                Cancel
              </button>
            </div>
          </form>

          <div v-else class="flex items-center justify-between gap-4">
            <span class="font-medium text-default">{{ league.name }}</span>
            <div class="flex items-center gap-2">
              <button
                type="button"
                :aria-label="`Edit ${league.name}`"
                class="rounded-md p-1.5 text-muted transition-colors duration-150 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
                @click="startEdit(league.id, league.name)"
              >
                <Pencil class="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                :aria-label="`Delete ${league.name}`"
                class="rounded-md p-1.5 text-muted transition-colors duration-150 hover:text-danger focus:outline-none focus:ring-2 focus:ring-accent"
                @click="onDelete(league.id)"
              >
                <Trash2 class="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>

<style scoped></style>
