import { ref } from 'vue'
import { defineStore } from 'pinia'

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { useAntiforgery } from '@/composables/useAntiforgery'
import { toEntityError } from '@/stores/entityError'

type TeamDto = components['schemas']['TeamDto']
type CreateTeamRequest = components['schemas']['CreateTeamRequest']
type UpdateTeamRequest = components['schemas']['UpdateTeamRequest']

const NOT_FOUND = 'That team could not be found. It may have been deleted.'
// The backend answers 404 when a tagged league is missing OR owned by someone else - the
// UI only offers owned options, so this surfaces mostly when data went stale.
const TAG_NOT_FOUND =
  'The selected league could not be found. It may have been deleted - refresh and try again.'

export const useTeamStore = defineStore('team', () => {
  const teams = ref<TeamDto[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const { ensureToken } = useAntiforgery()

  async function fetchTeams(): Promise<void> {
    loading.value = true
    try {
      const { data, error, response } = await api.GET('/api/teams')
      if (error) {
        throw toEntityError(error, response.status)
      }
      teams.value = data
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function getTeam(id: string): Promise<TeamDto> {
    const { data, error, response } = await api.GET('/api/teams/{id}', {
      params: { path: { id } },
    })
    if (error) {
      throw toEntityError(error, response.status, { notFound: NOT_FOUND })
    }
    return data
  }

  async function createTeam(request: CreateTeamRequest): Promise<TeamDto> {
    await ensureToken()
    const { data, error, response } = await api.POST('/api/teams', { body: request })
    if (error) {
      throw toEntityError(error, response.status, { notFound: TAG_NOT_FOUND })
    }
    teams.value = [...teams.value, data]
    return data
  }

  async function updateTeam(id: string, request: UpdateTeamRequest): Promise<TeamDto> {
    await ensureToken()
    const { data, error, response } = await api.PUT('/api/teams/{id}', {
      params: { path: { id } },
      body: request,
    })
    if (error) {
      // 404 here can mean the team itself or the tagged league is gone.
      throw toEntityError(error, response.status, {
        notFound: 'The team or its selected league could not be found. Refresh and try again.',
      })
    }
    teams.value = teams.value.map((team) => (team.id === id ? data : team))
    return data
  }

  async function deleteTeam(id: string): Promise<void> {
    await ensureToken()
    const { error, response } = await api.DELETE('/api/teams/{id}', {
      params: { path: { id } },
    })
    if (error) {
      throw toEntityError(error, response.status, { notFound: NOT_FOUND })
    }
    teams.value = teams.value.filter((team) => team.id !== id)
  }

  return { teams, loading, loaded, fetchTeams, getTeam, createTeam, updateTeam, deleteTeam }
})
