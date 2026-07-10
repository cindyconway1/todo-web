import { ref } from 'vue'
import { defineStore } from 'pinia'

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { toEntityError } from '@/stores/entityError'

type AllItemDto = components['schemas']['AllItemDto']

export const useAllItemsStore = defineStore('allItems', () => {
  const items = ref<AllItemDto[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  // The backend returns the flattened incomplete items pre-sorted (due date asc,
  // undated last) - keep the returned order, never re-sort client-side.
  async function fetchAll(): Promise<void> {
    loading.value = true
    try {
      const { data, error, response } = await api.GET('/api/items/all')
      if (error) {
        throw toEntityError(error, response.status)
      }
      items.value = data
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  return {
    items,
    loading,
    loaded,
    fetchAll,
  }
})
