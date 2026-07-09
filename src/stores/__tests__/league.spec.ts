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
import { useLeagueStore } from '@/stores/league'

type LeagueDto = components['schemas']['LeagueDto']
type MessageDto = components['schemas']['MessageDto']
type ValidationProblemDto = components['schemas']['ValidationProblemDto']

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>
const mockPost = api.POST as unknown as ReturnType<typeof vi.fn>
const mockPut = api.PUT as unknown as ReturnType<typeof vi.fn>
const mockDelete = api.DELETE as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

// AC 13 - a user can fully manage (CRUD) their leagues.
describe('useLeagueStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockDelete.mockReset()
    // Antiforgery token already primed so ensureToken() in actions is a no-op.
    useAntiforgery().token.value = 'primed-token'
  })

  it('fetchLeagues stores the list and marks it loaded', async () => {
    const leagues: LeagueDto[] = [{ id: 'l1', name: 'Sunday Rec' }]
    mockGet.mockResolvedValueOnce({ data: leagues, error: undefined, response: response(200) })

    const store = useLeagueStore()
    await store.fetchLeagues()

    expect(mockGet).toHaveBeenCalledWith('/api/leagues')
    expect(store.leagues).toEqual(leagues)
    expect(store.loaded).toBe(true)
  })

  it('getLeague returns a single league by id', async () => {
    const league: LeagueDto = { id: 'l1', name: 'Sunday Rec' }
    mockGet.mockResolvedValueOnce({ data: league, error: undefined, response: response(200) })

    const store = useLeagueStore()
    const result = await store.getLeague('l1')

    expect(mockGet).toHaveBeenCalledWith('/api/leagues/{id}', { params: { path: { id: 'l1' } } })
    expect(result).toEqual(league)
  })

  it('createLeague posts the request body and appends the created league', async () => {
    const created: LeagueDto = { id: 'l2', name: 'Winter League' }
    mockPost.mockResolvedValueOnce({ data: created, error: undefined, response: response(201) })

    const store = useLeagueStore()
    const result = await store.createLeague({ name: 'Winter League' })

    expect(mockPost).toHaveBeenCalledWith('/api/leagues', { body: { name: 'Winter League' } })
    expect(result).toEqual(created)
    expect(store.leagues).toContainEqual(created)
  })

  it('updateLeague puts the request body and replaces the league in the list', async () => {
    const updated: LeagueDto = { id: 'l1', name: 'Renamed' }
    mockPut.mockResolvedValueOnce({ data: updated, error: undefined, response: response(200) })

    const store = useLeagueStore()
    store.leagues = [{ id: 'l1', name: 'Old name' }]
    const result = await store.updateLeague('l1', { name: 'Renamed' })

    expect(mockPut).toHaveBeenCalledWith('/api/leagues/{id}', {
      params: { path: { id: 'l1' } },
      body: { name: 'Renamed' },
    })
    expect(result).toEqual(updated)
    expect(store.leagues).toEqual([updated])
  })

  it('deleteLeague removes the league from the list', async () => {
    mockDelete.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: response(204),
    })

    const store = useLeagueStore()
    store.leagues = [
      { id: 'l1', name: 'Keep me' },
      { id: 'l2', name: 'Delete me' },
    ]
    await store.deleteLeague('l2')

    expect(mockDelete).toHaveBeenCalledWith('/api/leagues/{id}', {
      params: { path: { id: 'l2' } },
    })
    expect(store.leagues).toEqual([{ id: 'l1', name: 'Keep me' }])
  })

  // AC 18 - backend validation failures surface as field-level errors.
  it('createLeague maps 422 validation problems to field errors', async () => {
    const problem: ValidationProblemDto = {
      message: 'Validation failed',
      errors: [{ property: 'name', message: 'Name is required.' }],
    }
    mockPost.mockResolvedValueOnce({ data: undefined, error: problem, response: response(422) })

    const store = useLeagueStore()
    await expect(store.createLeague({ name: '' })).rejects.toMatchObject({
      kind: 'validation',
      fieldErrors: { name: 'Name is required.' },
    })
    expect(store.leagues).toEqual([])
  })

  // AC 18 - ownership/missing entities (backend 404) are handled cleanly.
  it('updateLeague maps a 404 to a not-found error and leaves state untouched', async () => {
    const message: MessageDto = { message: 'exact server wording should not leak to the UI' }
    mockPut.mockResolvedValueOnce({ data: undefined, error: message, response: response(404) })

    const store = useLeagueStore()
    store.leagues = [{ id: 'l1', name: 'Mine' }]
    await expect(store.updateLeague('someone-elses', { name: 'X' })).rejects.toMatchObject({
      kind: 'not-found',
    })
    expect(store.leagues).toEqual([{ id: 'l1', name: 'Mine' }])
  })

  it('deleteLeague maps a 404 to a not-found error', async () => {
    const message: MessageDto = { message: 'not found' }
    mockDelete.mockResolvedValueOnce({ data: undefined, error: message, response: response(404) })

    const store = useLeagueStore()
    await expect(store.deleteLeague('gone')).rejects.toMatchObject({ kind: 'not-found' })
  })
})
