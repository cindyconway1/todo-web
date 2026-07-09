import { ref } from 'vue'
import { defineStore } from 'pinia'

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { useAntiforgery } from '@/composables/useAntiforgery'
import { toEntityError } from '@/stores/entityError'

type VolunteerDto = components['schemas']['VolunteerDto']
type CreateVolunteerRequest = components['schemas']['CreateVolunteerRequest']
type UpdateVolunteerRequest = components['schemas']['UpdateVolunteerRequest']

const NOT_FOUND = 'That volunteer could not be found. It may have been deleted.'
// The backend answers 404 when a tagged league/team is missing OR owned by someone else -
// the UI only offers owned options, so this surfaces mostly when data went stale.
const TAG_NOT_FOUND =
  'A selected league or team could not be found. It may have been deleted - refresh and try again.'

export const useVolunteerStore = defineStore('volunteer', () => {
  const volunteers = ref<VolunteerDto[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const { ensureToken } = useAntiforgery()

  async function fetchVolunteers(): Promise<void> {
    loading.value = true
    try {
      const { data, error, response } = await api.GET('/api/volunteers')
      if (error) {
        throw toEntityError(error, response.status)
      }
      volunteers.value = data
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function getVolunteer(id: string): Promise<VolunteerDto> {
    const { data, error, response } = await api.GET('/api/volunteers/{id}', {
      params: { path: { id } },
    })
    if (error) {
      throw toEntityError(error, response.status, { notFound: NOT_FOUND })
    }
    return data
  }

  async function createVolunteer(request: CreateVolunteerRequest): Promise<VolunteerDto> {
    await ensureToken()
    const { data, error, response } = await api.POST('/api/volunteers', { body: request })
    if (error) {
      throw toEntityError(error, response.status, { notFound: TAG_NOT_FOUND })
    }
    volunteers.value = [...volunteers.value, data]
    return data
  }

  async function updateVolunteer(
    id: string,
    request: UpdateVolunteerRequest,
  ): Promise<VolunteerDto> {
    await ensureToken()
    const { data, error, response } = await api.PUT('/api/volunteers/{id}', {
      params: { path: { id } },
      body: request,
    })
    if (error) {
      // 404 here can mean the volunteer itself or a tagged league/team is gone.
      throw toEntityError(error, response.status, {
        notFound:
          'The volunteer or a selected league/team could not be found. Refresh and try again.',
      })
    }
    volunteers.value = volunteers.value.map((volunteer) => (volunteer.id === id ? data : volunteer))
    return data
  }

  async function deleteVolunteer(id: string): Promise<void> {
    await ensureToken()
    const { error, response } = await api.DELETE('/api/volunteers/{id}', {
      params: { path: { id } },
    })
    if (error) {
      throw toEntityError(error, response.status, { notFound: NOT_FOUND })
    }
    volunteers.value = volunteers.value.filter((volunteer) => volunteer.id !== id)
  }

  return {
    volunteers,
    loading,
    loaded,
    fetchVolunteers,
    getVolunteer,
    createVolunteer,
    updateVolunteer,
    deleteVolunteer,
  }
})
