<script setup lang="ts">
import { computed, onMounted, reactive, ref, useTemplateRef } from 'vue'
import { ArrowLeft, ListTodo } from '@lucide/vue'

import ItemEditor from '@/components/ItemEditor.vue'
import type { ItemEditorPayload, ItemFieldErrors } from '@/components/ItemEditor.vue'
import ItemRow from '@/components/ItemRow.vue'
import { EntityError } from '@/stores/entityError'
import { usePriorityStore } from '@/stores/priority'
import { useTodoItemStore } from '@/stores/todoItem'
import { applyEntityError } from '@/utils/entityForm'

const props = defineProps<{
  scopeType: string
  scopeEntityId: string
}>()

const todoItemStore = useTodoItemStore()
const priorityStore = usePriorityStore()

const listError = ref('')

const createEditor = useTemplateRef('createEditor')
const createFieldErrors = reactive<ItemFieldErrors>({})
const createError = ref('')
const creating = ref(false)

const editingId = ref<string | null>(null)
const editFieldErrors = reactive<ItemFieldErrors>({})
const editError = ref('')
const saving = ref(false)

const scopeLabel = computed(
  () => props.scopeType.charAt(0).toUpperCase() + props.scopeType.slice(1).toLowerCase(),
)

onMounted(load)

async function load(): Promise<void> {
  listError.value = ''
  try {
    // The priority options feed the editors' dropdowns; they are independent of the
    // list lookup, so fetch both together.
    const [list] = await Promise.all([
      todoItemStore.getListForScope(props.scopeType, props.scopeEntityId),
      priorityStore.fetchPriorities(),
    ])
    if (list.id) {
      await todoItemStore.fetchItems(list.id)
    }
  } catch (err) {
    listError.value =
      err instanceof EntityError ? err.message : 'Something went wrong. Please try again.'
  }
}

function clearFieldErrors(errors: ItemFieldErrors): void {
  errors.title = undefined
  errors.description = undefined
  errors.dueDate = undefined
}

async function onCreate(payload: ItemEditorPayload): Promise<void> {
  if (!todoItemStore.listId) {
    return
  }
  createError.value = ''
  clearFieldErrors(createFieldErrors)

  creating.value = true
  try {
    await todoItemStore.createItem(todoItemStore.listId, payload)
    createEditor.value?.reset()
  } catch (err) {
    applyEntityError(err, createFieldErrors, createError)
  } finally {
    creating.value = false
  }
}

function startEdit(id: string | undefined): void {
  editingId.value = id ?? null
  clearFieldErrors(editFieldErrors)
  editError.value = ''
}

function cancelEdit(): void {
  editingId.value = null
}

async function onSaveEdit(payload: ItemEditorPayload): Promise<void> {
  if (!editingId.value) {
    return
  }
  editError.value = ''
  clearFieldErrors(editFieldErrors)

  saving.value = true
  try {
    await todoItemStore.updateItem(editingId.value, payload)
    editingId.value = null
  } catch (err) {
    applyEntityError(err, editFieldErrors, editError)
    if (err instanceof EntityError && err.kind === 'not-found') {
      // The row went stale (deleted elsewhere / ownership changed) - resync the list.
      editingId.value = null
      editError.value = ''
      await load()
      listError.value = err.message
    }
  } finally {
    saving.value = false
  }
}

async function onComplete(id: string | undefined): Promise<void> {
  if (!id) {
    return
  }
  listError.value = ''
  try {
    await todoItemStore.completeItem(id)
  } catch (err) {
    if (err instanceof EntityError && err.kind === 'not-found') {
      await load()
    }
    listError.value =
      err instanceof EntityError ? err.message : 'Something went wrong. Please try again.'
  }
}

async function onDelete(id: string | undefined): Promise<void> {
  if (!id) {
    return
  }
  listError.value = ''
  try {
    await todoItemStore.deleteItem(id)
    if (editingId.value === id) {
      editingId.value = null
    }
  } catch (err) {
    if (err instanceof EntityError && err.kind === 'not-found') {
      await load()
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
          <ListTodo class="size-5 text-accent" aria-hidden="true" />
          <span>{{ scopeLabel }} to-dos</span>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <h1 class="text-2xl font-semibold text-default">{{ scopeLabel }} to-dos</h1>

      <div class="space-y-4 rounded-md border border-subtle bg-card p-6">
        <h2 class="font-medium text-default">New to-do</h2>
        <ItemEditor
          ref="createEditor"
          submit-label="Add to-do"
          saving-label="Adding…"
          :saving="creating"
          :priorities="priorityStore.priorities"
          :server-field-errors="createFieldErrors"
          :form-error="createError"
          @save="onCreate"
        />
      </div>

      <p
        v-if="listError"
        role="alert"
        class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >
        {{ listError }}
      </p>

      <p v-if="todoItemStore.loading && !todoItemStore.loaded" class="text-muted">
        Loading to-dos…
      </p>

      <div
        v-else-if="todoItemStore.loaded && todoItemStore.items.length === 0"
        data-testid="empty-state"
        class="flex flex-col items-center gap-3 rounded-md border border-subtle bg-card px-6 py-16 text-center"
      >
        <ListTodo class="size-10 text-muted" aria-hidden="true" />
        <p class="text-muted">All caught up!</p>
        <p class="text-sm text-muted">Nothing to do here — add your first to-do above.</p>
      </div>

      <!-- Items render in the exact order the API returned them (server sorts due-date
           asc, nulls last); nothing here re-sorts. -->
      <ul v-else class="space-y-3">
        <li v-for="item in todoItemStore.items" :key="item.id">
          <div
            v-if="editingId === item.id"
            class="space-y-4 rounded-md border border-subtle bg-card p-4"
          >
            <ItemEditor
              :item="item"
              submit-label="Save"
              saving-label="Saving…"
              :saving="saving"
              :priorities="priorityStore.priorities"
              cancellable
              :server-field-errors="editFieldErrors"
              :form-error="editError"
              @save="onSaveEdit"
              @cancel="cancelEdit"
            />
          </div>
          <ItemRow
            v-else
            :item="item"
            @complete="onComplete(item.id)"
            @edit="startEdit(item.id)"
            @delete="onDelete(item.id)"
          />
        </li>
      </ul>
    </main>
  </div>
</template>

<style scoped></style>
