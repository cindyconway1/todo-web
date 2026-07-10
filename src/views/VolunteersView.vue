<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ArrowLeft, HeartHandshake, ListTodo, Pencil, Plus, Trash2, X } from '@lucide/vue'

import TagPicker from '@/components/TagPicker.vue'
import type { TagOption } from '@/components/TagPicker.vue'
import { EntityError } from '@/stores/entityError'
import { useLeagueStore } from '@/stores/league'
import { useTeamStore } from '@/stores/team'
import { useVolunteerStore } from '@/stores/volunteer'
import { applyEntityError, requiredName } from '@/utils/entityForm'

const volunteerStore = useVolunteerStore()
const leagueStore = useLeagueStore()
const teamStore = useTeamStore()

const listError = ref('')

const createForm = reactive<{ name: string; leagueId: string | null; teamIds: string[] }>({
  name: '',
  leagueId: null,
  teamIds: [],
})
const createFieldErrors = reactive<{ name?: string; leagueId?: string; teamIds?: string }>({})
const createError = ref('')
const creating = ref(false)

const editingId = ref<string | null>(null)
const editForm = reactive<{ name: string; leagueId: string | null; teamIds: string[] }>({
  name: '',
  leagueId: null,
  teamIds: [],
})
const editFieldErrors = reactive<{ name?: string; leagueId?: string; teamIds?: string }>({})
const editError = ref('')
const saving = ref(false)

onMounted(async () => {
  // Leagues and teams feed the TagPickers: only entities the user owns come back from the
  // API, so only owned options are ever offered as tags.
  await Promise.all([
    loadVolunteers(),
    leagueStore.fetchLeagues().catch(() => {}),
    teamStore.fetchTeams().catch(() => {}),
  ])
})

function leagueOptions(): TagOption[] {
  return leagueStore.leagues
    .filter((league) => league.id)
    .map((league) => ({ id: league.id as string, name: league.name ?? 'Unnamed league' }))
}

function teamOptions(): TagOption[] {
  return teamStore.teams
    .filter((team) => team.id)
    .map((team) => ({ id: team.id as string, name: team.name ?? 'Unnamed team' }))
}

function leagueName(id: string | null | undefined): string | undefined {
  if (!id) {
    return undefined
  }
  return leagueStore.leagues.find((league) => league.id === id)?.name
}

function teamNames(ids: string[] | undefined): string[] {
  return (ids ?? [])
    .map((id) => teamStore.teams.find((team) => team.id === id)?.name)
    .filter((name): name is string => Boolean(name))
}

async function loadVolunteers(): Promise<void> {
  listError.value = ''
  try {
    await volunteerStore.fetchVolunteers()
  } catch (err) {
    listError.value =
      err instanceof EntityError ? err.message : 'Something went wrong. Please try again.'
  }
}

async function onCreate(): Promise<void> {
  createError.value = ''
  createFieldErrors.leagueId = undefined
  createFieldErrors.teamIds = undefined
  createFieldErrors.name = requiredName(createForm.name)
  if (createFieldErrors.name) {
    return
  }

  creating.value = true
  try {
    await volunteerStore.createVolunteer({
      name: createForm.name.trim(),
      leagueId: createForm.leagueId,
      teamIds: createForm.teamIds,
    })
    createForm.name = ''
    createForm.leagueId = null
    createForm.teamIds = []
  } catch (err) {
    applyEntityError(err, createFieldErrors, createError)
  } finally {
    creating.value = false
  }
}

function startEdit(volunteer: {
  id?: string
  name?: string
  leagueId?: string | null
  teamIds?: string[]
}): void {
  editingId.value = volunteer.id ?? null
  editForm.name = volunteer.name ?? ''
  editForm.leagueId = volunteer.leagueId ?? null
  editForm.teamIds = [...(volunteer.teamIds ?? [])]
  editFieldErrors.name = undefined
  editFieldErrors.leagueId = undefined
  editFieldErrors.teamIds = undefined
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
  editFieldErrors.teamIds = undefined
  editFieldErrors.name = requiredName(editForm.name)
  if (editFieldErrors.name) {
    return
  }

  saving.value = true
  try {
    await volunteerStore.updateVolunteer(editingId.value, {
      name: editForm.name.trim(),
      leagueId: editForm.leagueId,
      teamIds: editForm.teamIds,
    })
    editingId.value = null
  } catch (err) {
    applyEntityError(err, editFieldErrors, editError)
    if (err instanceof EntityError && err.kind === 'not-found') {
      // The row went stale (deleted elsewhere / ownership changed) - resync the list.
      editingId.value = null
      editError.value = ''
      await loadVolunteers()
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
    await volunteerStore.deleteVolunteer(id)
    if (editingId.value === id) {
      editingId.value = null
    }
  } catch (err) {
    if (err instanceof EntityError && err.kind === 'not-found') {
      // The row went stale (deleted elsewhere / ownership changed) - resync the list.
      await loadVolunteers()
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
          <HeartHandshake class="size-5 text-accent" aria-hidden="true" />
          <span>Volunteers</span>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <h1 class="text-2xl font-semibold text-default">Volunteers</h1>

      <form
        novalidate
        class="space-y-4 rounded-md border border-subtle bg-card p-6"
        @submit.prevent="onCreate"
      >
        <h2 class="font-medium text-default">New volunteer</h2>

        <p
          v-if="createError"
          role="alert"
          class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {{ createError }}
        </p>

        <div class="space-y-1.5">
          <label for="volunteer-name" class="block text-sm font-medium text-default">Name</label>
          <input
            id="volunteer-name"
            v-model="createForm.name"
            type="text"
            placeholder="e.g. Sam Referee"
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

        <TagPicker
          v-model="createForm.teamIds"
          label="Teams"
          multiple
          :options="teamOptions()"
          empty-text="No teams yet — create one on the Teams page first."
          :error="createFieldErrors.teamIds"
        />

        <button
          type="submit"
          :disabled="creating"
          class="flex items-center gap-2 rounded-md bg-accent px-4 py-2 font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus class="size-4" aria-hidden="true" />
          {{ creating ? 'Creating…' : 'Create volunteer' }}
        </button>
      </form>

      <p
        v-if="listError"
        role="alert"
        class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >
        {{ listError }}
      </p>

      <p v-if="volunteerStore.loading" class="text-muted">Loading volunteers…</p>

      <div
        v-else-if="volunteerStore.loaded && volunteerStore.volunteers.length === 0"
        data-testid="empty-state"
        class="flex flex-col items-center gap-3 rounded-md border border-subtle bg-card px-6 py-16 text-center"
      >
        <HeartHandshake class="size-10 text-muted" aria-hidden="true" />
        <p class="text-muted">No volunteers yet.</p>
        <p class="text-sm text-muted">Create your first volunteer above.</p>
      </div>

      <ul v-else class="space-y-3">
        <li
          v-for="volunteer in volunteerStore.volunteers"
          :key="volunteer.id"
          class="rounded-md border border-subtle bg-card p-4"
        >
          <form
            v-if="editingId === volunteer.id"
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
              <label :for="`edit-volunteer-name-${volunteer.id}`" class="sr-only">Name</label>
              <input
                :id="`edit-volunteer-name-${volunteer.id}`"
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

            <TagPicker
              v-model="editForm.teamIds"
              label="Teams"
              multiple
              :options="teamOptions()"
              empty-text="No teams yet — create one on the Teams page first."
              :error="editFieldErrors.teamIds"
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
              <span class="font-medium text-default">{{ volunteer.name }}</span>
              <span
                v-if="leagueName(volunteer.leagueId)"
                class="rounded-md border border-accent/40 bg-canvas px-2 py-0.5 text-xs text-muted"
              >
                {{ leagueName(volunteer.leagueId) }}
              </span>
              <span
                v-for="name in teamNames(volunteer.teamIds)"
                :key="name"
                class="rounded-md border border-subtle bg-canvas px-2 py-0.5 text-xs text-muted"
              >
                {{ name }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <RouterLink
                :to="`/lists/volunteer/${volunteer.id}`"
                :aria-label="`View to-dos for ${volunteer.name}`"
                class="flex items-center gap-1.5 rounded-md p-1.5 text-sm text-muted transition-colors duration-150 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <ListTodo class="size-4" aria-hidden="true" />
                View to-dos
              </RouterLink>
              <button
                type="button"
                :aria-label="`Edit ${volunteer.name}`"
                class="rounded-md p-1.5 text-muted transition-colors duration-150 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
                @click="startEdit(volunteer)"
              >
                <Pencil class="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                :aria-label="`Delete ${volunteer.name}`"
                class="rounded-md p-1.5 text-muted transition-colors duration-150 hover:text-danger focus:outline-none focus:ring-2 focus:ring-accent"
                @click="onDelete(volunteer.id)"
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
