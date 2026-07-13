<script setup lang="ts">
import { Flag } from '@lucide/vue'

defineProps<{ name: string }>()
</script>

<template>
  <span
    data-testid="priority-badge"
    class="inline-flex shrink-0 items-center gap-1 rounded-full border border-subtle px-2 py-0.5 text-xs text-muted"
  >
    <Flag class="size-3 text-accent" aria-hidden="true" />
    {{ name }}
  </span>
</template>

<style scoped></style>
