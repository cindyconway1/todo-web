<script setup lang="ts">
import { Calendar, Circle, CircleCheck, Pencil, Trash2 } from '@lucide/vue'

import type { components } from '@/api/schema'

type TodoItemDto = components['schemas']['TodoItemDto']

defineProps<{ item: TodoItemDto }>()

const emit = defineEmits<{ complete: []; edit: []; delete: [] }>()
</script>

<template>
  <div
    data-testid="item-row"
    class="flex items-start gap-3 rounded-md border border-subtle bg-card p-4"
  >
    <button
      type="button"
      :aria-label="`Complete ${item.title}`"
      class="group/check mt-0.5 shrink-0 rounded-full text-muted transition-colors duration-150 hover:text-success focus:outline-none focus:ring-2 focus:ring-accent"
      @click="emit('complete')"
    >
      <Circle class="size-5 group-hover/check:hidden" aria-hidden="true" />
      <CircleCheck
        class="hidden size-5 transition-transform duration-150 group-hover/check:block group-hover/check:scale-110"
        aria-hidden="true"
      />
    </button>

    <div class="min-w-0 flex-1 space-y-0.5">
      <p data-testid="item-title" class="font-medium text-default">{{ item.title }}</p>
      <p v-if="item.description" class="text-sm text-muted">{{ item.description }}</p>
      <p v-if="item.dueDate" class="flex items-center gap-1.5 text-xs text-muted">
        <Calendar class="size-3.5" aria-hidden="true" />
        <!-- dueDate is the contract's date-only YYYY-MM-DD string; shown as-is (no Date round-trip). -->
        <span>Due {{ item.dueDate }}</span>
      </p>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <button
        type="button"
        :aria-label="`Edit ${item.title}`"
        class="rounded-md p-1.5 text-muted transition-colors duration-150 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
        @click="emit('edit')"
      >
        <Pencil class="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        :aria-label="`Delete ${item.title}`"
        class="rounded-md p-1.5 text-muted transition-colors duration-150 hover:text-danger focus:outline-none focus:ring-2 focus:ring-accent"
        @click="emit('delete')"
      >
        <Trash2 class="size-4" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped></style>
