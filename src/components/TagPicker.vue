<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@lucide/vue'

export interface TagOption {
  id: string
  name: string
}

const props = withDefaults(
  defineProps<{
    label: string
    options: TagOption[]
    // Single-select mode uses `string | null`; multi-select mode uses `string[]`.
    modelValue: string | string[] | null
    multiple?: boolean
    emptyText?: string
    error?: string
  }>(),
  { multiple: false, emptyText: 'Nothing to select yet.', error: '' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | string[] | null]
}>()

const selectedIds = computed<Set<string>>(() => {
  if (props.modelValue === null) {
    return new Set()
  }
  return new Set(Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue])
})

function toggle(id: string): void {
  if (props.multiple) {
    const current = Array.isArray(props.modelValue) ? props.modelValue : []
    emit(
      'update:modelValue',
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  } else {
    emit('update:modelValue', props.modelValue === id ? null : id)
  }
}
</script>

<template>
  <fieldset class="space-y-1.5">
    <legend class="block text-sm font-medium text-default">{{ label }}</legend>

    <p v-if="options.length === 0" class="text-sm text-muted">{{ emptyText }}</p>

    <div v-else class="flex flex-wrap gap-2">
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        :aria-pressed="selectedIds.has(option.id)"
        class="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent"
        :class="
          selectedIds.has(option.id)
            ? 'border-accent bg-accent/15 text-default'
            : 'border-subtle bg-canvas text-muted hover:border-accent hover:text-default'
        "
        @click="toggle(option.id)"
      >
        <Check
          v-if="selectedIds.has(option.id)"
          class="size-3.5 text-accent transition-transform duration-150"
          aria-hidden="true"
        />
        {{ option.name }}
      </button>
    </div>

    <p v-if="error" class="text-sm text-danger">{{ error }}</p>
  </fieldset>
</template>

<style scoped></style>
