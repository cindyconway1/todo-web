import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/client', () => ({
  api: {
    GET: vi.fn<() => Promise<unknown>>(),
    POST: vi.fn<() => Promise<unknown>>(),
    PUT: vi.fn<() => Promise<unknown>>(),
    DELETE: vi.fn<() => Promise<unknown>>(),
  },
}))

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { useAntiforgery } from '@/composables/useAntiforgery'
import { useVolunteerStore } from '@/stores/volunteer'

type VolunteerDto = components['schemas']['VolunteerDto']
type MessageDto = components['schemas']['MessageDto']
type ValidationProblemDto = components['schemas']['ValidationProblemDto']

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>
const mockPost = api.POST as unknown as ReturnType<typeof vi.fn>
const mockPut = api.PUT as unknown as ReturnType<typeof vi.fn>
const mockDelete = api.DELETE as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

// AC 16 - a user can fully manage (CRUD) their volunteers.
describe('useVolunteerStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockDelete.mockReset()
    useAntiforgery().token.value = 'primed-token'
  })

  it('fetchVolunteers stores the list and marks it loaded', async () => {
    const volunteers: VolunteerDto[] = [
      { id: 'v1', name: 'Sam', leagueId: 'l1', teamIds: ['t1', 't2'] },
    ]
    mockGet.mockResolvedValueOnce({ data: volunteers, error: undefined, response: response(200) })

    const store = useVolunteerStore()
    await store.fetchVolunteers()

    expect(mockGet).toHaveBeenCalledWith('/api/volunteers')
    expect(store.volunteers).toEqual(volunteers)
    expect(store.loaded).toBe(true)
  })

  it('getVolunteer returns a single volunteer by id', async () => {
    const volunteer: VolunteerDto = { id: 'v1', name: 'Sam', leagueId: 'l1', teamIds: ['t1'] }
    mockGet.mockResolvedValueOnce({ data: volunteer, error: undefined, response: response(200) })

    const store = useVolunteerStore()
    const result = await store.getVolunteer('v1')

    expect(mockGet).toHaveBeenCalledWith('/api/volunteers/{id}', {
      params: { path: { id: 'v1' } },
    })
    expect(result).toEqual(volunteer)
  })

  // AC 17 - tag selections serialize exactly as the schema expects: a single leagueId
  // plus the full teamIds[] array.
  it('createVolunteer sends leagueId and the full teamIds array in the request body', async () => {
    const created: VolunteerDto = { id: 'v2', name: 'Alex', leagueId: 'l1', teamIds: ['t1', 't2'] }
    mockPost.mockResolvedValueOnce({ data: created, error: undefined, response: response(201) })

    const store = useVolunteerStore()
    const result = await store.createVolunteer({
      name: 'Alex',
      leagueId: 'l1',
      teamIds: ['t1', 't2'],
    })

    expect(mockPost).toHaveBeenCalledWith('/api/volunteers', {
      body: { name: 'Alex', leagueId: 'l1', teamIds: ['t1', 't2'] },
    })
    expect(result).toEqual(created)
    expect(store.volunteers).toContainEqual(created)
  })

  // AC 17 - updates also carry the full teamIds[] array.
  it('updateVolunteer sends the full teamIds array and replaces the volunteer', async () => {
    const updated: VolunteerDto = { id: 'v1', name: 'Sam', leagueId: 'l2', teamIds: ['t3'] }
    mockPut.mockResolvedValueOnce({ data: updated, error: undefined, response: response(200) })

    const store = useVolunteerStore()
    store.volunteers = [{ id: 'v1', name: 'Sam', leagueId: 'l1', teamIds: ['t1', 't2'] }]
    await store.updateVolunteer('v1', { name: 'Sam', leagueId: 'l2', teamIds: ['t3'] })

    expect(mockPut).toHaveBeenCalledWith('/api/volunteers/{id}', {
      params: { path: { id: 'v1' } },
      body: { name: 'Sam', leagueId: 'l2', teamIds: ['t3'] },
    })
    expect(store.volunteers).toEqual([updated])
  })

  it('deleteVolunteer removes the volunteer from the list', async () => {
    mockDelete.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: response(204),
    })

    const store = useVolunteerStore()
    store.volunteers = [
      { id: 'v1', name: 'Keep', teamIds: [] },
      { id: 'v2', name: 'Drop', teamIds: ['t1'] },
    ]
    await store.deleteVolunteer('v2')

    expect(mockDelete).toHaveBeenCalledWith('/api/volunteers/{id}', {
      params: { path: { id: 'v2' } },
    })
    expect(store.volunteers).toEqual([{ id: 'v1', name: 'Keep', teamIds: [] }])
  })

  // AC 18 - tagging an unowned/missing league or team (backend 404) is surfaced cleanly.
  it('createVolunteer maps a 404 (unowned tag) to a not-found error', async () => {
    const message: MessageDto = { message: 'exact server wording should not leak to the UI' }
    mockPost.mockResolvedValueOnce({ data: undefined, error: message, response: response(404) })

    const store = useVolunteerStore()
    await expect(
      store.createVolunteer({ name: 'Alex', leagueId: 'not-mine', teamIds: [] }),
    ).rejects.toMatchObject({ kind: 'not-found' })
    expect(store.volunteers).toEqual([])
  })

  // AC 18 - backend validation failures surface as field-level errors.
  it('createVolunteer maps 422 validation problems to field errors', async () => {
    const problem: ValidationProblemDto = {
      message: 'Validation failed',
      errors: [{ property: 'name', message: 'Name is required.' }],
    }
    mockPost.mockResolvedValueOnce({ data: undefined, error: problem, response: response(422) })

    const store = useVolunteerStore()
    await expect(
      store.createVolunteer({ name: '', leagueId: null, teamIds: [] }),
    ).rejects.toMatchObject({
      kind: 'validation',
      fieldErrors: { name: 'Name is required.' },
    })
  })
})
