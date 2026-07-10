import { ref } from 'vue'
import { defineStore } from 'pinia'

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { toEntityError } from '@/stores/entityError'

type DashboardDto = components['schemas']['DashboardDto']

export const useDashboardStore = defineStore('dashboard', () => {
  const dashboard = ref<DashboardDto | null>(null)
  const loading = ref(false)
  const loaded = ref(false)

  async function fetchDashboard(): Promise<void> {
    loading.value = true
    try {
      const { data, error, response } = await api.GET('/api/dashboard')
      if (error) {
        throw toEntityError(error, response.status)
      }
      dashboard.value = data
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  return {
    dashboard,
    loading,
    loaded,
    fetchDashboard,
  }
})
