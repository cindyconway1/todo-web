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
import VolunteersView from '@/views/VolunteersView.vue'

type LeagueDto = components['schemas']['LeagueDto']
type TeamDto = components['schemas']['TeamDto']
type VolunteerDto = components['schemas']['VolunteerDto']

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>
const mockPost = api.POST as unknown as ReturnType<typeof vi.fn>
const mockPut = api.PUT as unknown as ReturnType<typeof vi.fn>
const mockDelete = api.DELETE as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

async function mountView(volunteers: VolunteerDto[], leagues: LeagueDto[], teams: TeamDto[]) {
  mockGet.mockImplementation(async (path: string) => {
    if (path === '/api/volunteers') {
      return { data: volunteers, error: undefined, response: response(200) }
    }
    if (path === '/api/teams') {
      return { data: teams, error: undefined, response: response(200) }
    }
    // /api/leagues - the TagPicker options, i.e. only entities the user owns.
    return { data: leagues, error: undefined, response: response(200) }
  })
  const pinia = createPinia()
  setActivePinia(pinia)
  useAntiforgery().token.value = 'primed-token'
  const wrapper = mount(VolunteersView, {
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

describe('VolunteersView', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockDelete.mockReset()
  })

  // AC 30 - the list view renders an explicit empty state when there are no volunteers.
  it('renders the empty state when the user has no volunteers', async () => {
    const wrapper = await mountView([], [], [])

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No volunteers yet.')
  })

  // AC 16 + AC 17 - create flow: the single league tag and the FULL multi-team
  // selection serialize into the request body exactly as the schema expects.
  it('creates a volunteer tagged to a league and multiple teams, sending leagueId and the full teamIds array', async () => {
    const wrapper = await mountView(
      [],
      [{ id: 'l1', name: 'Sunday Rec' }],
      [
        { id: 't1', name: 'Comets', leagueId: 'l1' },
        { id: 't2', name: 'Rockets', leagueId: 'l1' },
      ],
    )
    mockPost.mockResolvedValueOnce({
      data: { id: 'v1', name: 'Sam', leagueId: 'l1', teamIds: ['t1', 't2'] },
      error: undefined,
      response: response(201),
    })

    await wrapper.find('#volunteer-name').setValue('Sam')
    await tagButton(wrapper, 'Sunday Rec').trigger('click')
    await tagButton(wrapper, 'Comets').trigger('click')
    await tagButton(wrapper, 'Rockets').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mockPost).toHaveBeenCalledWith('/api/volunteers', {
      body: { name: 'Sam', leagueId: 'l1', teamIds: ['t1', 't2'] },
    })
    expect(wrapper.text()).toContain('Sam')
  })

  // AC 17 - editing keeps the full teamIds array in the request body.
  it('updates a volunteer and sends the modified full teamIds array', async () => {
    const wrapper = await mountView(
      [{ id: 'v1', name: 'Sam', leagueId: 'l1', teamIds: ['t1'] }],
      [{ id: 'l1', name: 'Sunday Rec' }],
      [
        { id: 't1', name: 'Comets', leagueId: 'l1' },
        { id: 't2', name: 'Rockets', leagueId: 'l1' },
      ],
    )
    mockPut.mockResolvedValueOnce({
      data: { id: 'v1', name: 'Sam', leagueId: 'l1', teamIds: ['t1', 't2'] },
      error: undefined,
      response: response(200),
    })

    await wrapper.find('button[aria-label="Edit Sam"]').trigger('click')
    // Second form on the page is the inline edit form; add the second team there.
    const editForm = wrapper.findAll('form')[1]!
    const rockets = editForm
      .findAll('button[aria-pressed]')
      .find((b) => b.text().includes('Rockets'))!
    await rockets.trigger('click')
    await editForm.trigger('submit')
    await flushPromises()

    expect(mockPut).toHaveBeenCalledWith('/api/volunteers/{id}', {
      params: { path: { id: 'v1' } },
      body: { name: 'Sam', leagueId: 'l1', teamIds: ['t1', 't2'] },
    })
  })

  // AC 18 - inline client-side validation blocks an invalid submit.
  it('shows an inline error and does not submit when the name is empty', async () => {
    const wrapper = await mountView([], [], [])

    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Name is required.')
    expect(mockPost).not.toHaveBeenCalled()
  })

  // AC 18 - backend 422 validation problems render inline on the field.
  it('renders backend validation errors inline', async () => {
    const wrapper = await mountView([], [], [])
    mockPost.mockResolvedValueOnce({
      data: undefined,
      error: {
        message: 'Validation failed',
        errors: [{ property: 'name', message: 'Name is too long.' }],
      },
      response: response(422),
    })

    await wrapper.find('#volunteer-name').setValue('x'.repeat(300))
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Name is too long.')
  })

  // AC 18 - the backend's 404 for an unowned/missing tag renders cleanly.
  it('renders a friendly error when a tagged entity is rejected with 404', async () => {
    const wrapper = await mountView([], [{ id: 'l1', name: 'Stale League' }], [])
    mockPost.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'raw server words' },
      response: response(404),
    })

    await wrapper.find('#volunteer-name').setValue('Sam')
    await tagButton(wrapper, 'Stale League').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('could not be found')
    expect(wrapper.text()).not.toContain('raw server words')
  })

  // AC 16 - delete flow.
  it('deletes a volunteer and shows the empty state again', async () => {
    const wrapper = await mountView([{ id: 'v1', name: 'Doomed', teamIds: [] }], [], [])
    mockDelete.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: response(204),
    })

    await wrapper.find('button[aria-label="Delete Doomed"]').trigger('click')
    await flushPromises()

    expect(mockDelete).toHaveBeenCalledWith('/api/volunteers/{id}', {
      params: { path: { id: 'v1' } },
    })
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
  })

  // AC 16/17 - the list shows the volunteer's league and team tags.
  it('shows league and team badges on tagged volunteers', async () => {
    const wrapper = await mountView(
      [{ id: 'v1', name: 'Sam', leagueId: 'l1', teamIds: ['t1', 't2'] }],
      [{ id: 'l1', name: 'Sunday Rec' }],
      [
        { id: 't1', name: 'Comets', leagueId: 'l1' },
        { id: 't2', name: 'Rockets', leagueId: 'l1' },
      ],
    )

    expect(wrapper.text()).toContain('Sam')
    expect(wrapper.text()).toContain('Sunday Rec')
    expect(wrapper.text()).toContain('Comets')
    expect(wrapper.text()).toContain('Rockets')
  })
})
