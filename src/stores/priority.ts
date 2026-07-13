import { ref } from 'vue'
import { defineStore } from 'pinia'

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { toEntityError } from '@/stores/entityError'

type PriorityDto = components['schemas']['PriorityDto']

export const usePriorityStore = defineStore('priority', () => {
  const priorities = ref<PriorityDto[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  // Options come solely from the API - names, ids and ranking. The contract's
  // sortOrder field is the only ordering ever applied; nothing hardcodes priorities.
  async function fetchPriorities(): Promise<void> {
    loading.value = true
    try {
      const { data, error, response } = await api.GET('/api/priorities')
      if (error) {
        throw toEntityError(error, response.status)
      }
      priorities.value = [...data].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  return {
    priorities,
    loading,
    loaded,
    fetchPriorities,
  }
})
