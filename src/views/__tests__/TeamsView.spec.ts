import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
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
import TeamsView from '@/views/TeamsView.vue'

type LeagueDto = components['schemas']['LeagueDto']
type TeamDto = components['schemas']['TeamDto']

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>
const mockPost = api.POST as unknown as ReturnType<typeof vi.fn>
const mockPut = api.PUT as unknown as ReturnType<typeof vi.fn>
const mockDelete = api.DELETE as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

async function mountView(teams: TeamDto[], leagues: LeagueDto[]) {
  mockGet.mockImplementation(async (path: string) => {
    if (path === '/api/teams') {
      return { data: teams, error: undefined, response: response(200) }
    }
    // /api/leagues - the TagPicker options, i.e. only leagues the user owns.
    return { data: leagues, error: undefined, response: response(200) }
  })
  const pinia = createPinia()
  setActivePinia(pinia)
  useAntiforgery().token.value = 'primed-token'
  const wrapper = mount(TeamsView, {
    global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  })
  await flushPromises()
  return wrapper
}

function tagButton(wrapper: Awaited<ReturnType<typeof mountView>>, name: string) {
  const button = wrapper.findAll('button[aria-pressed]').find((b) => b.text().includes(name))
  if (!button) {
    throw new Error(`No tag option named "${name}"`)
  }
  return button
}

describe('TeamsView', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockDelete.mockReset()
  })

  // AC 30 - the list view renders an explicit empty state when there are no teams.
  it('renders the empty state when the user has no teams', async () => {
    const wrapper = await mountView([], [])

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No teams yet.')
  })

  // AC 15 - create flow with a league tag; the tag serializes as `leagueId`.
  it('creates a team tagged to a league and sends leagueId in the request body', async () => {
    const wrapper = await mountView([], [{ id: 'l1', name: 'Sunday Rec' }])
    mockPost.mockResolvedValueOnce({
      data: { id: 't1', name: 'Comets', leagueId: 'l1' },
      error: undefined,
      response: response(201),
    })

    await wrapper.find('#team-name').setValue('Comets')
    await tagButton(wrapper, 'Sunday Rec').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mockPost).toHaveBeenCalledWith('/api/teams', {
      body: { name: 'Comets', leagueId: 'l1' },
    })
    expect(wrapper.text()).toContain('Comets')
  })

  // Only owned leagues are offered: options come straight from GET /api/leagues.
  it('only offers the leagues returned by the API as tag options', async () => {
    const wrapper = await mountView([], [{ id: 'l1', name: 'Mine' }])

    const options = wrapper.findAll('button[aria-pressed]')
    expect(options).toHaveLength(1)
    expect(options[0]!.text()).toContain('Mine')
  })

  // AC 30 (picker flavor) - no leagues yet -> the picker explains where to create one.
  it('shows guidance in the league picker when the user owns no leagues', async () => {
    const wrapper = await mountView([], [])

    expect(wrapper.text()).toContain('No leagues yet — create one on the Leagues page first.')
  })

  // AC 18 - inline client-side validation blocks an invalid submit.
  it('shows an inline error and does not submit when the name is empty', async () => {
    const wrapper = await mountView([], [])

    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Name is required.')
    expect(mockPost).not.toHaveBeenCalled()
  })

  // AC 18 - the backend's 404 for an unowned/missing league tag renders cleanly.
  it('renders a friendly error when the tagged league is rejected with 404', async () => {
    const wrapper = await mountView([], [{ id: 'l1', name: 'Stale League' }])
    mockPost.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'raw server words' },
      response: response(404),
    })

    await wrapper.find('#team-name').setValue('Comets')
    await tagButton(wrapper, 'Stale League').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('The selected league could not be found')
    expect(wrapper.text()).not.toContain('raw server words')
  })

  // AC 15 - the list shows each team's league tag.
  it('shows the league name badge on tagged teams', async () => {
    const wrapper = await mountView(
      [{ id: 't1', name: 'Comets', leagueId: 'l1' }],
      [{ id: 'l1', name: 'Sunday Rec' }],
    )

    expect(wrapper.text()).toContain('Comets')
    expect(wrapper.text()).toContain('Sunday Rec')
  })

  // AC 15 - re-tagging via the edit form sends the new leagueId.
  it('updates a team with a different league tag', async () => {
    const wrapper = await mountView(
      [{ id: 't1', name: 'Comets', leagueId: 'l1' }],
      [
        { id: 'l1', name: 'Old League' },
        { id: 'l2', name: 'New League' },
      ],
    )
    mockPut.mockResolvedValueOnce({
      data: { id: 't1', name: 'Comets', leagueId: 'l2' },
      error: undefined,
      response: response(200),
    })

    await wrapper.find('button[aria-label="Edit Comets"]').trigger('click')
    // Second form on the page is the inline edit form; pick its "New League" option.
    const editForm = wrapper.findAll('form')[1]!
    const newLeague = editForm
      .findAll('button[aria-pressed]')
      .find((b) => b.text().includes('New League'))!
    await newLeague.trigger('click')
    await editForm.trigger('submit')
    await flushPromises()

    expect(mockPut).toHaveBeenCalledWith('/api/teams/{id}', {
      params: { path: { id: 't1' } },
      body: { name: 'Comets', leagueId: 'l2' },
    })
  })

  // AC 15 - delete flow.
  it('deletes a team and shows the empty state again', async () => {
    const wrapper = await mountView([{ id: 't1', name: 'Doomed', leagueId: null }], [])
    mockDelete.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: response(204),
    })

    await wrapper.find('button[aria-label="Delete Doomed"]').trigger('click')
    await flushPromises()

    expect(mockDelete).toHaveBeenCalledWith('/api/teams/{id}', { params: { path: { id: 't1' } } })
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
  })
})
