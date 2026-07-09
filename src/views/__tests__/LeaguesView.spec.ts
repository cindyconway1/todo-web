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
import LeaguesView from '@/views/LeaguesView.vue'

type LeagueDto = components['schemas']['LeagueDto']

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>
const mockPost = api.POST as unknown as ReturnType<typeof vi.fn>
const mockPut = api.PUT as unknown as ReturnType<typeof vi.fn>
const mockDelete = api.DELETE as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

async function mountView(leagues: LeagueDto[]) {
  mockGet.mockResolvedValue({ data: leagues, error: undefined, response: response(200) })
  const pinia = createPinia()
  setActivePinia(pinia)
  useAntiforgery().token.value = 'primed-token'
  const wrapper = mount(LeaguesView, {
    global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  })
  await flushPromises()
  return wrapper
}

describe('LeaguesView', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockDelete.mockReset()
  })

  // AC 30 - the list view renders an explicit empty state when there are no leagues.
  it('renders the empty state when the user has no leagues', async () => {
    const wrapper = await mountView([])

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No leagues yet.')
  })

  it('lists leagues instead of the empty state when some exist', async () => {
    const wrapper = await mountView([{ id: 'l1', name: 'Sunday Rec' }])

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Sunday Rec')
  })

  // AC 13 - create flow from the view down to the request body.
  it('creates a league and shows it in the list', async () => {
    const wrapper = await mountView([])
    mockPost.mockResolvedValueOnce({
      data: { id: 'l1', name: 'Winter League' },
      error: undefined,
      response: response(201),
    })

    await wrapper.find('#league-name').setValue('Winter League')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mockPost).toHaveBeenCalledWith('/api/leagues', { body: { name: 'Winter League' } })
    expect(wrapper.text()).toContain('Winter League')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  // AC 18 - inline client-side validation blocks an invalid submit.
  it('shows an inline error and does not submit when the name is empty', async () => {
    const wrapper = await mountView([])

    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Name is required.')
    expect(mockPost).not.toHaveBeenCalled()
  })

  // AC 18 - backend 422 validation problems render inline on the field.
  it('renders backend validation errors inline', async () => {
    const wrapper = await mountView([])
    mockPost.mockResolvedValueOnce({
      data: undefined,
      error: {
        message: 'Validation failed',
        errors: [{ property: 'name', message: 'Name is too long.' }],
      },
      response: response(422),
    })

    await wrapper.find('#league-name').setValue('x'.repeat(300))
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Name is too long.')
  })

  // AC 13 - rename (update) flow.
  it('renames a league through the inline edit form', async () => {
    const wrapper = await mountView([{ id: 'l1', name: 'Old name' }])
    mockPut.mockResolvedValueOnce({
      data: { id: 'l1', name: 'New name' },
      error: undefined,
      response: response(200),
    })

    await wrapper.find('button[aria-label="Edit Old name"]').trigger('click')
    await wrapper.find('#edit-league-name-l1').setValue('New name')
    await wrapper.findAll('form')[1]!.trigger('submit')
    await flushPromises()

    expect(mockPut).toHaveBeenCalledWith('/api/leagues/{id}', {
      params: { path: { id: 'l1' } },
      body: { name: 'New name' },
    })
    expect(wrapper.text()).toContain('New name')
    expect(wrapper.text()).not.toContain('Old name')
  })

  // AC 13 - delete flow.
  it('deletes a league and removes it from the list', async () => {
    const wrapper = await mountView([{ id: 'l1', name: 'Doomed' }])
    mockDelete.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: response(204),
    })

    await wrapper.find('button[aria-label="Delete Doomed"]').trigger('click')
    await flushPromises()

    expect(mockDelete).toHaveBeenCalledWith('/api/leagues/{id}', {
      params: { path: { id: 'l1' } },
    })
    expect(wrapper.text()).not.toContain('Doomed')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
  })

  // AC 18 - a 404 (deleted elsewhere / not owned) is surfaced cleanly, not crashed on.
  it('shows a friendly message when deleting a league that no longer exists', async () => {
    const wrapper = await mountView([{ id: 'l1', name: 'Ghost' }])
    mockDelete.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'raw server words' },
      response: response(404),
    })

    await wrapper.find('button[aria-label="Delete Ghost"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('could not be found')
    expect(wrapper.text()).not.toContain('raw server words')
  })
})
