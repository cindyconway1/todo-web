import { ref } from 'vue'
import { defineStore } from 'pinia'

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { useAntiforgery } from '@/composables/useAntiforgery'
import { toEntityError } from '@/stores/entityError'

type LeagueDto = components['schemas']['LeagueDto']
type CreateLeagueRequest = components['schemas']['CreateLeagueRequest']
type UpdateLeagueRequest = components['schemas']['UpdateLeagueRequest']

const NOT_FOUND = 'That league could not be found. It may have been deleted.'

export const useLeagueStore = defineStore('league', () => {
  const leagues = ref<LeagueDto[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const { ensureToken } = useAntiforgery()

  async function fetchLeagues(): Promise<void> {
    loading.value = true
    try {
      const { data, error, response } = await api.GET('/api/leagues')
      if (error) {
        throw toEntityError(error, response.status)
      }
      leagues.value = data
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function getLeague(id: string): Promise<LeagueDto> {
    const { data, error, response } = await api.GET('/api/leagues/{id}', {
      params: { path: { id } },
    })
    if (error) {
      throw toEntityError(error, response.status, { notFound: NOT_FOUND })
    }
    return data
  }

  async function createLeague(request: CreateLeagueRequest): Promise<LeagueDto> {
    await ensureToken()
    const { data, error, response } = await api.POST('/api/leagues', { body: request })
    if (error) {
      throw toEntityError(error, response.status)
    }
    leagues.value = [...leagues.value, data]
    return data
  }

  async function updateLeague(id: string, request: UpdateLeagueRequest): Promise<LeagueDto> {
    await ensureToken()
    const { data, error, response } = await api.PUT('/api/leagues/{id}', {
      params: { path: { id } },
      body: request,
    })
    if (error) {
      throw toEntityError(error, response.status, { notFound: NOT_FOUND })
    }
    leagues.value = leagues.value.map((league) => (league.id === id ? data : league))
    return data
  }

  async function deleteLeague(id: string): Promise<void> {
    await ensureToken()
    const { error, response } = await api.DELETE('/api/leagues/{id}', {
      params: { path: { id } },
    })
    if (error) {
      throw toEntityError(error, response.status, { notFound: NOT_FOUND })
    }
    leagues.value = leagues.value.filter((league) => league.id !== id)
  }

  return {
    leagues,
    loading,
    loaded,
    fetchLeagues,
    getLeague,
    createLeague,
    updateLeague,
    deleteLeague,
  }
})
