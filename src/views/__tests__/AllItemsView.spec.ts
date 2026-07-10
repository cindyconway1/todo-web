import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/client', () => ({
  api: {
    GET: vi.fn<() => Promise<unknown>>(),
  },
}))

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import AllItemsView from '@/views/AllItemsView.vue'

type AllItemDto = components['schemas']['AllItemDto']

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

async function mountView(items: AllItemDto[]) {
  mockGet.mockResolvedValue({ data: items, error: undefined, response: response(200) })
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(AllItemsView, {
    global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  })
  await flushPromises()
  return wrapper
}

describe('AllItemsView', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  // AC 29 - every incomplete item across all lists renders in one flat list, in the
  // order the API returns (due date asc, undated last), each labeled with its source.
  it('renders every item in the returned order with its source label', async () => {
    const items: AllItemDto[] = [
      {
        id: 'i1',
        listId: 'list-1',
        listName: 'Groceries',
        scopeType: 'Personal',
        scopeName: null,
        title: 'Buy milk',
        dueDate: '2026-07-11',
      },
      {
        id: 'i2',
        listId: 'list-2',
        listName: 'Match day',
        scopeType: 'Team',
        scopeName: 'Wildcats',
        title: 'Wash kits',
        description: 'Home and away sets',
        dueDate: '2026-07-14',
      },
      {
        id: 'i3',
        listId: 'list-3',
        listName: 'Season admin',
        scopeType: 'League',
        scopeName: 'Sunday Rec',
        title: 'Renew insurance',
        dueDate: null,
      },
    ]
    const wrapper = await mountView(items)

    const rows = wrapper.findAll('[data-testid="all-item"]')
    expect(rows).toHaveLength(3)

    // One flat list in the API's order: dated ascending, then undated last.
    expect(rows.map((row) => row.find('[data-testid="item-title"]').text())).toEqual([
      'Buy milk',
      'Wash kits',
      'Renew insurance',
    ])

    // Each row names its source list and scope, since scope is flattened away here.
    expect(rows.map((row) => row.find('[data-testid="source-label"]').text())).toEqual([
      'Personal / Groceries',
      'Team · Wildcats / Match day',
      'League · Sunday Rec / Season admin',
    ])

    // Due dates render for dated items; the undated item has no due-date label.
    expect(rows[0]!.find('[data-testid="due-date"]').text()).toContain('Jul 11, 2026')
    expect(rows[1]!.find('[data-testid="due-date"]').text()).toContain('Jul 14, 2026')
    expect(rows[2]!.find('[data-testid="due-date"]').exists()).toBe(false)

    // Optional description renders when present.
    expect(rows[1]!.text()).toContain('Home and away sets')

    expect(mockGet).toHaveBeenCalledWith('/api/items/all')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  // AC 29 - rows are read-only in this overview: no check-off, edit, or delete
  // controls, and no click-through link (AllItemDto carries no scope entity id).
  it('renders rows as display-only with no actions or links', async () => {
    const wrapper = await mountView([
      {
        id: 'i1',
        listId: 'list-1',
        listName: 'Groceries',
        scopeType: 'Personal',
        scopeName: null,
        title: 'Buy milk',
        dueDate: '2026-07-11',
      },
    ])

    const row = wrapper.find('[data-testid="all-item"]')
    expect(row.find('button').exists()).toBe(false)
    expect(row.find('input').exists()).toBe(false)
    expect(row.find('a').exists()).toBe(false)
  })

  // AC 31 - nothing incomplete anywhere shows a friendly "all clear" empty state.
  it('renders the all-clear empty state when there are no incomplete items', async () => {
    const wrapper = await mountView([])

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('All clear!')
    expect(wrapper.find('[data-testid="all-item"]').exists()).toBe(false)
  })

  it('surfaces a friendly error when the fetch fails', async () => {
    mockGet.mockResolvedValue({ data: undefined, error: {}, response: response(500) })
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(AllItemsView, {
      global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Something went wrong. Please try again.')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })
})
