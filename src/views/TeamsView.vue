<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ArrowLeft, ListTodo, Pencil, Plus, Trash2, Users, X } from '@lucide/vue'

import TagPicker from '@/components/TagPicker.vue'
import type { TagOption } from '@/components/TagPicker.vue'
import { EntityError } from '@/stores/entityError'
import { useLeagueStore } from '@/stores/league'
import { useTeamStore } from '@/stores/team'
import { applyEntityError, requiredName } from '@/utils/entityForm'

const teamStore = useTeamStore()
const leagueStore = useLeagueStore()

const listError = ref('')

const createForm = reactive<{ name: string; leagueId: string | null }>({
  name: '',
  leagueId: null,
})
const createFieldErrors = reactive<{ name?: string; leagueId?: string }>({})
const createError = ref('')
const creating = ref(false)

const editingId = ref<string | null>(null)
const editForm = reactive<{ name: string; leagueId: string | null }>({ name: '', leagueId: null })
const editFieldErrors = reactive<{ name?: string; leagueId?: string }>({})
const editError = ref('')
const saving = ref(false)

onMounted(async () => {
  // Leagues feed the TagPicker: only entities the user owns come back from the API, so
  // only owned leagues are ever offered as tags.
  await Promise.all([loadTeams(), leagueStore.fetchLeagues().catch(() => {})])
})

function leagueOptions(): TagOption[] {
  return leagueStore.leagues
    .filter((league) => league.id)
    .map((league) => ({ id: league.id as string, name: league.name ?? 'Unnamed league' }))
}

function leagueName(id: string | null | undefined): string | undefined {
  if (!id) {
    return undefined
  }
  return leagueStore.leagues.find((league) => league.id === id)?.name
}

async function loadTeams(): Promise<void> {
  listError.value = ''
  try {
    await teamStore.fetchTeams()
  } catch (err) {
    listError.value =
      err instanceof EntityError ? err.message : 'Something went wrong. Please try again.'
  }
}

async function onCreate(): Promise<void> {
  createError.value = ''
  createFieldErrors.leagueId = undefined
  createFieldErrors.name = requiredName(createForm.name)
  if (createFieldErrors.name) {
    return
  }

  creating.value = true
  try {
    await teamStore.createTeam({
      name: createForm.name.trim(),
      leagueId: createForm.leagueId,
    })
    createForm.name = ''
    createForm.leagueId = null
  } catch (err) {
    applyEntityError(err, createFieldErrors, createError)
  } finally {
    creating.value = false
  }
}

function startEdit(team: { id?: string; name?: string; leagueId?: string | null }): void {
  editingId.value = team.id ?? null
  editForm.name = team.name ?? ''
  editForm.leagueId = team.leagueId ?? null
  editFieldErrors.name = undefined
  editFieldErrors.leagueId = undefined
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
  editFieldErrors.leagueId = undefined
  editFieldErrors.name = requiredName(editForm.name)
  if (editFieldErrors.name) {
    return
  }

  saving.value = true
  try {
    await teamStore.updateTeam(editingId.value, {
      name: editForm.name.trim(),
      leagueId: editForm.leagueId,
    })
    editingId.value = null
  } catch (err) {
    applyEntityError(err, editFieldErrors, editError)
    if (err instanceof EntityError && err.kind === 'not-found') {
      // The row went stale (deleted elsewhere / ownership changed) - resync the list.
      editingId.value = null
      editError.value = ''
      await loadTeams()
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
    await teamStore.deleteTeam(id)
    if (editingId.value === id) {
      editingId.value = null
    }
  } catch (err) {
    if (err instanceof EntityError && err.kind === 'not-found') {
      // The row went stale (deleted elsewhere / ownership changed) - resync the list.
      await loadTeams()
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
          <Users class="size-5 text-accent" aria-hidden="true" />
          <span>Teams</span>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <h1 class="text-2xl font-semibold text-default">Teams</h1>

      <form
        novalidate
        class="space-y-4 rounded-md border border-subtle bg-card p-6"
        @submit.prevent="onCreate"
      >
        <h2 class="font-medium text-default">New team</h2>

        <p
          v-if="createError"
          role="alert"
          class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {{ createError }}
        </p>

        <div class="space-y-1.5">
          <label for="team-name" class="block text-sm font-medium text-default">Name</label>
          <input
            id="team-name"
            v-model="createForm.name"
            type="text"
            placeholder="e.g. Ravenclaw Rockets"
            class="w-full rounded-md border bg-canvas px-3 py-2 text-default placeholder:text-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent"
            :class="createFieldErrors.name ? 'border-danger' : 'border-subtle'"
          />
          <p v-if="createFieldErrors.name" class="text-sm text-danger">
            {{ createFieldErrors.name }}
          </p>
        </div>

        <TagPicker
          v-model="createForm.leagueId"
          label="League"
          :options="leagueOptions()"
          empty-text="No leagues yet — create one on the Leagues page first."
          :error="createFieldErrors.leagueId"
        />

        <button
          type="submit"
          :disabled="creating"
          class="flex items-center gap-2 rounded-md bg-accent px-4 py-2 font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus class="size-4" aria-hidden="true" />
          {{ creating ? 'Creating…' : 'Create team' }}
        </button>
      </form>

      <p
        v-if="listError"
        role="alert"
        class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >
        {{ listError }}
      </p>

      <p v-if="teamStore.loading" class="text-muted">Loading teams…</p>

      <div
        v-else-if="teamStore.loaded && teamStore.teams.length === 0"
        data-testid="empty-state"
        class="flex flex-col items-center gap-3 rounded-md border border-subtle bg-card px-6 py-16 text-center"
      >
        <Users class="size-10 text-muted" aria-hidden="true" />
        <p class="text-muted">No teams yet.</p>
        <p class="text-sm text-muted">Create your first team above.</p>
      </div>

      <ul v-else class="space-y-3">
        <li
          v-for="team in teamStore.teams"
          :key="team.id"
          class="rounded-md border border-subtle bg-card p-4"
        >
          <form
            v-if="editingId === team.id"
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
              <label :for="`edit-team-name-${team.id}`" class="sr-only">Name</label>
              <input
                :id="`edit-team-name-${team.id}`"
                v-model="editForm.name"
                type="text"
                class="w-full rounded-md border bg-canvas px-3 py-2 text-default placeholder:text-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent"
                :class="editFieldErrors.name ? 'border-danger' : 'border-subtle'"
              />
              <p v-if="editFieldErrors.name" class="text-sm text-danger">
                {{ editFieldErrors.name }}
              </p>
            </div>

            <TagPicker
              v-model="editForm.leagueId"
              label="League"
              :options="leagueOptions()"
              empty-text="No leagues yet — create one on the Leagues page first."
              :error="editFieldErrors.leagueId"
            />

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
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium text-default">{{ team.name }}</span>
              <span
                v-if="leagueName(team.leagueId)"
                class="rounded-md border border-subtle bg-canvas px-2 py-0.5 text-xs text-muted"
              >
                {{ leagueName(team.leagueId) }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <RouterLink
                :to="`/lists/team/${team.id}`"
                :aria-label="`View to-dos for ${team.name}`"
                class="flex items-center gap-1.5 rounded-md p-1.5 text-sm text-muted transition-colors duration-150 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <ListTodo class="size-4" aria-hidden="true" />
                View to-dos
              </RouterLink>
              <button
                type="button"
                :aria-label="`Edit ${team.name}`"
                class="rounded-md p-1.5 text-muted transition-colors duration-150 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
                @click="startEdit(team)"
              >
                <Pencil class="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                :aria-label="`Delete ${team.name}`"
                class="rounded-md p-1.5 text-muted transition-colors duration-150 hover:text-danger focus:outline-none focus:ring-2 focus:ring-accent"
                @click="onDelete(team.id)"
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
