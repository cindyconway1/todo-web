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
    global: {
      plugins: [pinia],
      stubs: { RouterLink: { template: '<span><slot /></span>' } },
    },
  })
  await flushPromises()
  return wrapper
}

// Backend order: due date ascending, undated last, spanning multiple lists and scope types.
const items: AllItemDto[] = [
  {
    id: 'i1',
    listId: 'list-1',
    listName: 'Match day',
    scopeType: 'Team',
    scopeName: 'Wildcats',
    title: 'Pump the balls',
    priorityId: 1,
    priorityName: 'High',
    dueDate: '2026-07-11',
  },
  {
    id: 'i2',
    listId: 'list-2',
    listName: 'Season admin',
    scopeType: 'League',
    scopeName: 'Sunday Rec',
    title: 'Book the pitch',
    description: 'Via the council website',
    dueDate: '2026-07-14',
  },
  {
    id: 'i3',
    listId: 'list-3',
    listName: 'Personal',
    scopeType: 'User',
    scopeName: '',
    title: 'Wash the kit',
  },
]

describe('AllItemsView', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  // AC 29 - every incomplete item renders in one flat list in the API's order,
  // each labeled with its source list and scope.
  it('renders every item in the returned order with its source label', async () => {
    const wrapper = await mountView(items)

    const rows = wrapper.findAll('[data-testid="all-item"]')
    expect(rows).toHaveLength(3)

    expect(rows[0]!.text()).toContain('Pump the balls')
    expect(rows[1]!.text()).toContain('Book the pitch')
    expect(rows[2]!.text()).toContain('Wash the kit')

    expect(rows[0]!.find('[data-testid="source-label"]').text()).toBe(
      'Team · Wildcats / Match day',
    )
    expect(rows[1]!.find('[data-testid="source-label"]').text()).toBe(
      'League · Sunday Rec / Season admin',
    )
    expect(rows[2]!.find('[data-testid="source-label"]').text()).toBe('User / Personal')

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  // AC 29 - the due date and optional description render; undated rows omit the date.
  it('shows the due date and description when present', async () => {
    const wrapper = await mountView(items)

    const rows = wrapper.findAll('[data-testid="all-item"]')
    expect(rows[0]!.find('[data-testid="due-date"]').text()).toContain('Due 2026-07-11')
    expect(rows[1]!.text()).toContain('Via the council website')
    expect(rows[2]!.find('[data-testid="due-date"]').exists()).toBe(false)
  })

  // Read-only priority: the API-provided name shows on the row; unset priority
  // consistently shows no badge.
  it('shows the priority badge only on items that have a priority', async () => {
    const wrapper = await mountView(items)

    const rows = wrapper.findAll('[data-testid="all-item"]')
    expect(rows[0]!.find('[data-testid="priority-badge"]').text()).toBe('High')
    expect(rows[1]!.find('[data-testid="priority-badge"]').exists()).toBe(false)
    expect(rows[2]!.find('[data-testid="priority-badge"]').exists()).toBe(false)
  })

  // AC 29 - rows are read-only: no check-off, edit, delete, or click-through link.
  it('renders rows without any action buttons or links', async () => {
    const wrapper = await mountView(items)

    const rows = wrapper.findAll('[data-testid="all-item"]')
    for (const row of rows) {
      expect(row.find('button').exists()).toBe(false)
      expect(row.find('a').exists()).toBe(false)
      expect(row.find('input').exists()).toBe(false)
    }
  })

  // AC 31 - nothing incomplete anywhere shows a friendly "all clear" empty state.
  it('renders the all-clear empty state when there are no incomplete items', async () => {
    const wrapper = await mountView([])

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('All clear!')
    expect(wrapper.findAll('[data-testid="all-item"]')).toHaveLength(0)
  })
})
