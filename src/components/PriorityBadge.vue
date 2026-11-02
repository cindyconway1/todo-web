<script lang="ts">
import { defineComponent } from 'vue'
import { Flag } from '@lucide/vue'

export default defineComponent({
  name: 'PriorityBadge',
  components: { Flag },
  props: {
    name: { type: String, required: true },
  },
})
</script>

<template>
  <span
    data-testid="priority-badge"
    class="inline-flex shrink-0 items-center gap-1 rounded-full border border-subtle px-2 py-0.5 text-xs text-muted"
  >
    <Flag class="size-3 text-accent" aria-hidden="true" />
    <span v-html="name"></span>
  </span>
</template>

<style scoped></style>
