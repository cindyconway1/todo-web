<script setup lang="ts">
import { computed, reactive } from 'vue'
import { Calendar, X } from '@lucide/vue'

import type { components } from '@/api/schema'

type TodoItemDto = components['schemas']['TodoItemDto']

/** Emitted on save. Empty description/dueDate are omitted (they are optional in the contract). */
export interface ItemEditorPayload {
  title: string
  description?: string
  dueDate?: string
}

export type ItemFieldErrors = Partial<Record<'title' | 'description' | 'dueDate', string>>

const TITLE_MAX = 200
const DESCRIPTION_MAX = 200

const props = defineProps<{
  submitLabel: string
  savingLabel: string
  saving?: boolean
  cancellable?: boolean
  /** Present when editing an existing item; absent for the create form. */
  item?: TodoItemDto
  /** Backend (422) field errors, applied by the parent via applyEntityError. */
  serverFieldErrors?: ItemFieldErrors
  formError?: string
}>()

const emit = defineEmits<{ save: [payload: ItemEditorPayload]; cancel: [] }>()

const form = reactive({
  title: props.item?.title ?? '',
  description: props.item?.description ?? '',
  // The native date input's value is already the contract's YYYY-MM-DD - bound straight
  // through with no timezone math. It only ever yields a valid date or '', so malformed
  // input is impossible by construction.
  dueDate: props.item?.dueDate ?? '',
})

const localErrors = reactive<ItemFieldErrors>({})

const titleError = computed(() => localErrors.title ?? props.serverFieldErrors?.title)
const descriptionError = computed(
  () => localErrors.description ?? props.serverFieldErrors?.description,
)
const dueDateError = computed(() => props.serverFieldErrors?.dueDate)

// Distinct input ids per editor instance so the create form and an inline edit form
// can coexist on the page.
const idSuffix = props.item?.id ?? 'new'

function validate(): boolean {
  const title = form.title.trim()
  localErrors.title = !title
    ? 'Title is required.'
    : title.length > TITLE_MAX
      ? `Title must be ${TITLE_MAX} characters or fewer.`
      : undefined
  localErrors.description =
    form.description.trim().length > DESCRIPTION_MAX
      ? `Description must be ${DESCRIPTION_MAX} characters or fewer.`
      : undefined
  return !localErrors.title && !localErrors.description
}

function onSubmit(): void {
  if (!validate()) {
    return
  }
  const payload: ItemEditorPayload = { title: form.title.trim() }
  const description = form.description.trim()
  if (description) {
    payload.description = description
  }
  if (form.dueDate) {
    payload.dueDate = form.dueDate
  }
  emit('save', payload)
}

function reset(): void {
  form.title = ''
  form.description = ''
  form.dueDate = ''
  localErrors.title = undefined
  localErrors.description = undefined
}

defineExpose({ reset })
</script>

<template>
  <form novalidate class="space-y-4" @submit.prevent="onSubmit">
    <p
      v-if="formError"
      role="alert"
      class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      {{ formError }}
    </p>

    <div class="space-y-1.5">
      <label :for="`item-title-${idSuffix}`" class="block text-sm font-medium text-default">
        Title
      </label>
      <input
        :id="`item-title-${idSuffix}`"
        v-model="form.title"
        type="text"
        placeholder="e.g. Order team jerseys"
        class="w-full rounded-md border bg-canvas px-3 py-2 text-default placeholder:text-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent"
        :class="titleError ? 'border-danger' : 'border-subtle'"
      />
      <p v-if="titleError" class="text-sm text-danger">{{ titleError }}</p>
    </div>

    <div class="space-y-1.5">
      <label :for="`item-description-${idSuffix}`" class="block text-sm font-medium text-default">
        Description <span class="font-normal text-muted">(optional)</span>
      </label>
      <textarea
        :id="`item-description-${idSuffix}`"
        v-model="form.description"
        rows="2"
        placeholder="Add a note…"
        class="w-full resize-none rounded-md border bg-canvas px-3 py-2 text-default placeholder:text-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent"
        :class="descriptionError ? 'border-danger' : 'border-subtle'"
      ></textarea>
      <p v-if="descriptionError" class="text-sm text-danger">{{ descriptionError }}</p>
    </div>

    <div class="space-y-1.5">
      <label
        :for="`item-due-date-${idSuffix}`"
        class="flex items-center gap-1.5 text-sm font-medium text-default"
      >
        <Calendar class="size-3.5 text-muted" aria-hidden="true" />
        Due date <span class="font-normal text-muted">(optional)</span>
      </label>
      <!-- Native date input (decided for this PoC): the popup inherits the app's
           `color-scheme: dark` from the root; its chrome is browser-native by design. -->
      <input
        :id="`item-due-date-${idSuffix}`"
        v-model="form.dueDate"
        type="date"
        class="rounded-md border bg-canvas px-3 py-2 text-default transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent"
        :class="dueDateError ? 'border-danger' : 'border-subtle'"
      />
      <p v-if="dueDateError" class="text-sm text-danger">{{ dueDateError }}</p>
    </div>

    <div class="flex gap-2">
      <button
        type="submit"
        :disabled="saving"
        class="rounded-md bg-accent px-4 py-2 font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-60"
      >
        {{ saving ? savingLabel : submitLabel }}
      </button>
      <button
        v-if="cancellable"
        type="button"
        class="flex items-center gap-1.5 rounded-md border border-subtle bg-card px-3 py-2 text-sm text-default transition-colors duration-150 hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
        @click="emit('cancel')"
      >
        <X class="size-3.5" aria-hidden="true" />
        Cancel
      </button>
    </div>
  </form>
</template>

<style scoped></style>
