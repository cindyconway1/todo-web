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
import { useTeamStore } from '@/stores/team'

type TeamDto = components['schemas']['TeamDto']
type MessageDto = components['schemas']['MessageDto']
type ValidationProblemDto = components['schemas']['ValidationProblemDto']

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>
const mockPost = api.POST as unknown as ReturnType<typeof vi.fn>
const mockPut = api.PUT as unknown as ReturnType<typeof vi.fn>
const mockDelete = api.DELETE as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

// AC 15 - a user can fully manage (CRUD) their teams, tagging each to a league.
describe('useTeamStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockDelete.mockReset()
    useAntiforgery().token.value = 'primed-token'
  })

  it('fetchTeams stores the list and marks it loaded', async () => {
    const teams: TeamDto[] = [{ id: 't1', name: 'Rockets', leagueId: 'l1' }]
    mockGet.mockResolvedValueOnce({ data: teams, error: undefined, response: response(200) })

    const store = useTeamStore()
    await store.fetchTeams()

    expect(mockGet).toHaveBeenCalledWith('/api/teams')
    expect(store.teams).toEqual(teams)
    expect(store.loaded).toBe(true)
  })

  it('getTeam returns a single team by id', async () => {
    const team: TeamDto = { id: 't1', name: 'Rockets', leagueId: 'l1' }
    mockGet.mockResolvedValueOnce({ data: team, error: undefined, response: response(200) })

    const store = useTeamStore()
    const result = await store.getTeam('t1')

    expect(mockGet).toHaveBeenCalledWith('/api/teams/{id}', { params: { path: { id: 't1' } } })
    expect(result).toEqual(team)
  })

  // AC 15 - the league tag serializes into the request body as `leagueId`.
  it('createTeam sends the leagueId tag in the request body', async () => {
    const created: TeamDto = { id: 't2', name: 'Comets', leagueId: 'l1' }
    mockPost.mockResolvedValueOnce({ data: created, error: undefined, response: response(201) })

    const store = useTeamStore()
    const result = await store.createTeam({ name: 'Comets', leagueId: 'l1' })

    expect(mockPost).toHaveBeenCalledWith('/api/teams', {
      body: { name: 'Comets', leagueId: 'l1' },
    })
    expect(result).toEqual(created)
    expect(store.teams).toContainEqual(created)
  })

  it('updateTeam sends the new leagueId tag and replaces the team in the list', async () => {
    const updated: TeamDto = { id: 't1', name: 'Rockets', leagueId: 'l2' }
    mockPut.mockResolvedValueOnce({ data: updated, error: undefined, response: response(200) })

    const store = useTeamStore()
    store.teams = [{ id: 't1', name: 'Rockets', leagueId: 'l1' }]
    await store.updateTeam('t1', { name: 'Rockets', leagueId: 'l2' })

    expect(mockPut).toHaveBeenCalledWith('/api/teams/{id}', {
      params: { path: { id: 't1' } },
      body: { name: 'Rockets', leagueId: 'l2' },
    })
    expect(store.teams).toEqual([updated])
  })

  it('deleteTeam removes the team from the list', async () => {
    mockDelete.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: response(204),
    })

    const store = useTeamStore()
    store.teams = [
      { id: 't1', name: 'Keep', leagueId: null },
      { id: 't2', name: 'Drop', leagueId: 'l1' },
    ]
    await store.deleteTeam('t2')

    expect(mockDelete).toHaveBeenCalledWith('/api/teams/{id}', { params: { path: { id: 't2' } } })
    expect(store.teams).toEqual([{ id: 't1', name: 'Keep', leagueId: null }])
  })

  // AC 18 - tagging an unowned/missing league (backend 404) is surfaced cleanly.
  it('createTeam maps a 404 (unowned league tag) to a not-found error', async () => {
    const message: MessageDto = { message: 'exact server wording should not leak to the UI' }
    mockPost.mockResolvedValueOnce({ data: undefined, error: message, response: response(404) })

    const store = useTeamStore()
    await expect(store.createTeam({ name: 'Comets', leagueId: 'not-mine' })).rejects.toMatchObject({
      kind: 'not-found',
    })
    expect(store.teams).toEqual([])
  })

  // AC 18 - backend validation failures surface as field-level errors.
  it('createTeam maps 422 validation problems to field errors', async () => {
    const problem: ValidationProblemDto = {
      message: 'Validation failed',
      errors: [{ property: 'name', message: 'Name is required.' }],
    }
    mockPost.mockResolvedValueOnce({ data: undefined, error: problem, response: response(422) })

    const store = useTeamStore()
    await expect(store.createTeam({ name: '', leagueId: null })).rejects.toMatchObject({
      kind: 'validation',
      fieldErrors: { name: 'Name is required.' },
    })
  })
})
