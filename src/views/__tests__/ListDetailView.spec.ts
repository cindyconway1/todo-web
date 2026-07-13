import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/client', () => ({
  api: {
    GET: vi.fn<() => Promise<unknown>>(),
    POST: vi.fn<() => Promise<unknown>>(),
    PUT: vi.fn<() => Promise<unknown>>(),
    PATCH: vi.fn<() => Promise<unknown>>(),
    DELETE: vi.fn<() => Promise<unknown>>(),
  },
}))

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { useAntiforgery } from '@/composables/useAntiforgery'
import ListDetailView from '@/views/ListDetailView.vue'

type TodoListDto = components['schemas']['TodoListDto']
type TodoItemDto = components['schemas']['TodoItemDto']
type PriorityDto = components['schemas']['PriorityDto']

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>
const mockPost = api.POST as unknown as ReturnType<typeof vi.fn>
const mockPut = api.PUT as unknown as ReturnType<typeof vi.fn>
const mockPatch = api.PATCH as unknown as ReturnType<typeof vi.fn>
const mockDelete = api.DELETE as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

const list: TodoListDto = { id: 'list-1', scopeType: 'League', scopeEntityId: 'e1' }

// Mock API priority options, deliberately returned out of order so the dropdown
// order proves the store applied the API's sortOrder.
const priorities: PriorityDto[] = [
  { id: 2, name: 'Medium', sortOrder: 2 },
  { id: 1, name: 'High', sortOrder: 1 },
]

/**
 * Serves the GETs the view makes: the get-or-create list lookup, the priority
 * options, and the items fetch. `items` is read on every call, so tests can mutate
 * it to simulate server-side changes picked up by the store's re-fetches.
 */
function serveGets(items: TodoItemDto[]) {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/lists/{scopeTypeName}/{scopeEntityId}'
        ? { data: list, error: undefined, response: response(200) }
        : path === '/api/priorities'
          ? { data: [...priorities], error: undefined, response: response(200) }
          : { data: [...items], error: undefined, response: response(200) },
    ),
  )
}

async function mountView(items: TodoItemDto[]) {
  serveGets(items)
  const pinia = createPinia()
  setActivePinia(pinia)
  useAntiforgery().token.value = 'primed-token'
  const wrapper = mount(ListDetailView, {
    props: { scopeType: 'league', scopeEntityId: 'e1' },
    global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  })
  await flushPromises()
  return wrapper
}

describe('ListDetailView', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockPatch.mockReset()
    mockDelete.mockReset()
  })

  it('resolves the implicit list for the scope, then loads its items', async () => {
    await mountView([])

    expect(mockGet).toHaveBeenCalledWith('/api/lists/{scopeTypeName}/{scopeEntityId}', {
      params: { path: { scopeTypeName: 'league', scopeEntityId: 'e1' } },
    })
    expect(mockGet).toHaveBeenCalledWith('/api/lists/{listId}/items', {
      params: { path: { listId: 'list-1' } },
    })
  })

  // AC 31 - a list with no incomplete items shows a friendly empty state.
  it('renders the empty state when the list has no incomplete items', async () => {
    const wrapper = await mountView([])

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('All caught up!')
  })

  // AC 26/27 - items render in the exact order of the mocked pre-sorted response
  // (dated ascending, then undated); the view trusts the server order.
  it('renders items in the exact order the API returned them', async () => {
    const wrapper = await mountView([
      { id: 'i1', listId: 'list-1', title: 'Due first', dueDate: '2026-07-01' },
      { id: 'i2', listId: 'list-1', title: 'Due second', dueDate: '2026-07-15' },
      { id: 'i3', listId: 'list-1', title: 'Undated last' },
    ])

    const titles = wrapper.findAll('[data-testid="item-title"]').map((node) => node.text())
    expect(titles).toEqual(['Due first', 'Due second', 'Undated last'])
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  // AC 21 - create with a valid title posts and the new item appears.
  it('creates an item and shows the server-refreshed list', async () => {
    const items: TodoItemDto[] = []
    const wrapper = await mountView(items)
    const created: TodoItemDto = { id: 'i1', listId: 'list-1', title: 'New to-do' }
    mockPost.mockImplementation(() => {
      items.push(created)
      return Promise.resolve({ data: created, error: undefined, response: response(201) })
    })

    await wrapper.find('#item-title-new').setValue('New to-do')
    await wrapper.findAll('form')[0]!.trigger('submit')
    await flushPromises()

    expect(mockPost).toHaveBeenCalledWith('/api/lists/{listId}/items', {
      params: { path: { listId: 'list-1' } },
      body: { title: 'New to-do' },
    })
    expect(wrapper.text()).toContain('New to-do')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  // AC 21 - an empty title is blocked inline; nothing is posted.
  it('blocks create when the title is empty', async () => {
    const wrapper = await mountView([])

    await wrapper.findAll('form')[0]!.trigger('submit')

    expect(wrapper.text()).toContain('Title is required.')
    expect(mockPost).not.toHaveBeenCalled()
  })

  // AC 25 - checking complete PATCHes /complete, the row disappears, and no
  // un-complete/restore affordance exists anywhere in the view.
  it('completes an item, removes it from the view, and offers no restore', async () => {
    const wrapper = await mountView([
      { id: 'i1', listId: 'list-1', title: 'Finish roster', dueDate: '2026-07-01' },
    ])
    mockPatch.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: response(204),
    })

    await wrapper.find('button[aria-label="Complete Finish roster"]').trigger('click')
    await flushPromises()

    expect(mockPatch).toHaveBeenCalledWith('/api/items/{id}/complete', {
      params: { path: { id: 'i1' } },
    })
    expect(wrapper.text()).not.toContain('Finish roster')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.html()).not.toMatch(/undo|restore|un-?complete/i)
  })

  it('edits an item through the inline editor', async () => {
    const items: TodoItemDto[] = [{ id: 'i1', listId: 'list-1', title: 'Old title' }]
    const wrapper = await mountView(items)
    const updated: TodoItemDto = { id: 'i1', listId: 'list-1', title: 'New title' }
    mockPut.mockImplementation(() => {
      items.splice(0, items.length, updated)
      return Promise.resolve({ data: updated, error: undefined, response: response(200) })
    })

    await wrapper.find('button[aria-label="Edit Old title"]').trigger('click')
    await wrapper.find('#item-title-i1').setValue('New title')
    await wrapper.findAll('form')[1]!.trigger('submit')
    await flushPromises()

    expect(mockPut).toHaveBeenCalledWith('/api/items/{id}', {
      params: { path: { id: 'i1' } },
      body: { title: 'New title' },
    })
    expect(wrapper.text()).toContain('New title')
    expect(wrapper.text()).not.toContain('Old title')
  })

  // Priority options come from the API via the store and render in the contract's
  // sortOrder (High before Medium despite the response order), after a blank default.
  it('loads the priority options and renders them in API sort order', async () => {
    const wrapper = await mountView([])

    expect(mockGet).toHaveBeenCalledWith('/api/priorities')
    const options = wrapper.findAll('#item-priority-new option')
    expect(options.map((option) => option.text())).toEqual(['No priority', 'High', 'Medium'])
  })

  // Create with a priority selected persists the chosen priorityId.
  it('creates an item with the selected priority', async () => {
    const items: TodoItemDto[] = []
    const wrapper = await mountView(items)
    const created: TodoItemDto = {
      id: 'i1',
      listId: 'list-1',
      title: 'Urgent to-do',
      priorityId: 1,
      priorityName: 'High',
    }
    mockPost.mockImplementation(() => {
      items.push(created)
      return Promise.resolve({ data: created, error: undefined, response: response(201) })
    })

    await wrapper.find('#item-title-new').setValue('Urgent to-do')
    await wrapper.find('#item-priority-new').setValue('1')
    await wrapper.findAll('form')[0]!.trigger('submit')
    await flushPromises()

    expect(mockPost).toHaveBeenCalledWith('/api/lists/{listId}/items', {
      params: { path: { listId: 'list-1' } },
      body: { title: 'Urgent to-do', priorityId: 1 },
    })
    expect(wrapper.find('[data-testid="priority-badge"]').text()).toBe('High')
  })

  // Editing preserves the current priority and persists a changed one.
  it('changes an item priority through the inline editor', async () => {
    const items: TodoItemDto[] = [
      { id: 'i1', listId: 'list-1', title: 'Reprioritise me', priorityId: 2, priorityName: 'Medium' },
    ]
    const wrapper = await mountView(items)
    const updated: TodoItemDto = {
      id: 'i1',
      listId: 'list-1',
      title: 'Reprioritise me',
      priorityId: 1,
      priorityName: 'High',
    }
    mockPut.mockImplementation(() => {
      items.splice(0, items.length, updated)
      return Promise.resolve({ data: updated, error: undefined, response: response(200) })
    })

    await wrapper.find('button[aria-label="Edit Reprioritise me"]').trigger('click')
    const select = wrapper.find('#item-priority-i1')
    expect((select.element as HTMLSelectElement).value).toBe('2')
    await select.setValue('1')
    await wrapper.findAll('form')[1]!.trigger('submit')
    await flushPromises()

    expect(mockPut).toHaveBeenCalledWith('/api/items/{id}', {
      params: { path: { id: 'i1' } },
      body: { title: 'Reprioritise me', priorityId: 1 },
    })
    expect(wrapper.find('[data-testid="priority-badge"]').text()).toBe('High')
  })

  // Clearing a previously set priority persists as unset: the full-replace PUT body
  // carries no priorityId, and no badge renders afterwards.
  it('clears an item priority back to blank through the inline editor', async () => {
    const items: TodoItemDto[] = [
      { id: 'i1', listId: 'list-1', title: 'Calm down', priorityId: 1, priorityName: 'High' },
    ]
    const wrapper = await mountView(items)
    const updated: TodoItemDto = { id: 'i1', listId: 'list-1', title: 'Calm down' }
    mockPut.mockImplementation(() => {
      items.splice(0, items.length, updated)
      return Promise.resolve({ data: updated, error: undefined, response: response(200) })
    })

    await wrapper.find('button[aria-label="Edit Calm down"]').trigger('click')
    await wrapper.find('#item-priority-i1').setValue('')
    await wrapper.findAll('form')[1]!.trigger('submit')
    await flushPromises()

    expect(mockPut).toHaveBeenCalledWith('/api/items/{id}', {
      params: { path: { id: 'i1' } },
      body: { title: 'Calm down' },
    })
    expect(mockPut.mock.calls[0]![1].body).not.toHaveProperty('priorityId')
    expect(wrapper.find('[data-testid="priority-badge"]').exists()).toBe(false)
  })

  it('deletes an item and removes it from the view', async () => {
    const wrapper = await mountView([{ id: 'i1', listId: 'list-1', title: 'Doomed' }])
    mockDelete.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: response(204),
    })

    await wrapper.find('button[aria-label="Delete Doomed"]').trigger('click')
    await flushPromises()

    expect(mockDelete).toHaveBeenCalledWith('/api/items/{id}', {
      params: { path: { id: 'i1' } },
    })
    expect(wrapper.text()).not.toContain('Doomed')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
  })

  // AC 20-adjacent - an unowned/nonexistent scope entity 404s and surfaces cleanly.
  it('shows a friendly error when the scope entity cannot be found', async () => {
    mockGet.mockResolvedValue({
      data: undefined,
      error: { message: 'raw server words' },
      response: response(404),
    })
    const pinia = createPinia()
    setActivePinia(pinia)
    useAntiforgery().token.value = 'primed-token'
    const wrapper = mount(ListDetailView, {
      props: { scopeType: 'league', scopeEntityId: 'nope' },
      global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('could not be found')
    expect(wrapper.text()).not.toContain('raw server words')
  })
})
