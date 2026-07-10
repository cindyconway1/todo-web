import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

vi.mock('@/api/client', () => ({
  api: { GET: vi.fn<() => Promise<unknown>>(), POST: vi.fn<() => Promise<unknown>>() },
}))

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import DashboardView from '@/views/DashboardView.vue'

type DashboardDto = components['schemas']['DashboardDto']

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>
const mockPost = api.POST as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

const emptyDashboard: DashboardDto = { leagues: [], teams: [], people: [] }

// Contract-valid fixture: the server pre-sorts items (due-date asc, nulls last) and
// never returns completed items, so the fixture contains none - the view renders the
// payload as-is without re-sorting or re-filtering.
const groupedDashboard: DashboardDto = {
  leagues: [
    {
      entityId: 'league-1',
      entityName: 'Sunday Rec',
      lists: [
        {
          listId: 'list-1',
          listName: 'Sunday Rec to-dos',
          items: [
            {
              id: 'item-1',
              listId: 'list-1',
              title: 'Book the pitch',
              dueDate: '2026-07-12T00:00:00Z',
              isCompleted: false,
            },
            {
              id: 'item-2',
              listId: 'list-1',
              title: 'Order bibs',
              dueDate: null,
              isCompleted: false,
            },
          ],
        },
      ],
    },
  ],
  teams: [
    {
      entityId: 'team-1',
      entityName: 'Tigers',
      lists: [
        {
          listId: 'list-2',
          listName: 'Tigers to-dos',
          items: [
            {
              id: 'item-3',
              listId: 'list-2',
              title: 'Wash the kit',
              dueDate: '2026-07-14T00:00:00Z',
              isCompleted: false,
            },
          ],
        },
      ],
    },
  ],
  people: [
    {
      entityId: 'volunteer-1',
      entityName: 'Alex Doe',
      lists: [
        {
          listId: 'list-3',
          listName: 'Alex Doe to-dos',
          items: [
            {
              id: 'item-4',
              listId: 'list-3',
              title: 'Renew DBS check',
              dueDate: null,
              isCompleted: false,
            },
          ],
        },
      ],
    },
  ],
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'Login', component: { template: '<div />' } },
      { path: '/', name: 'Dashboard', component: DashboardView },
      { path: '/all-items', name: 'AllItems', component: { template: '<div />' } },
      {
        path: '/lists/:scopeType/:entityId',
        name: 'ListDetail',
        component: { template: '<div />' },
      },
    ],
  })
}

async function mountDashboard() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createTestRouter()
  await router.push('/')
  await router.isReady()
  const wrapper = mount(DashboardView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('DashboardView', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockGet.mockResolvedValue({ data: emptyDashboard, error: undefined, response: response(200) })
  })

  // AC 28 - lists grouped into Leagues / Teams / People, items in server order, completed hidden.
  it('renders the three groups in order with each list under its entity', async () => {
    mockGet.mockResolvedValueOnce({
      data: groupedDashboard,
      error: undefined,
      response: response(200),
    })

    const { wrapper } = await mountDashboard()

    expect(mockGet).toHaveBeenCalledWith('/api/dashboard')

    const headings = wrapper.findAll('h2').map((heading) => heading.text())
    expect(headings).toEqual(['Leagues', 'Teams', 'People'])

    expect(wrapper.find('[data-testid="group-leagues"]').text()).toContain('Sunday Rec')
    expect(wrapper.find('[data-testid="group-teams"]').text()).toContain('Tigers')
    expect(wrapper.find('[data-testid="group-people"]').text()).toContain('Alex Doe')
    expect(wrapper.find('[data-testid="group-leagues"]').text()).toContain('Sunday Rec to-dos')

    // Items appear exactly in the order the API returned them - no client re-sorting.
    const items = wrapper.findAll('[data-testid="todo-item"]').map((item) => item.text())
    expect(items).toHaveLength(4)
    expect(items[0]).toContain('Book the pitch')
    expect(items[1]).toContain('Order bibs')
    expect(items[2]).toContain('Wash the kit')
    expect(items[3]).toContain('Renew DBS check')

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  it('links each entity to its list-detail route and exposes the All Items link', async () => {
    mockGet.mockResolvedValueOnce({
      data: groupedDashboard,
      error: undefined,
      response: response(200),
    })

    const { wrapper } = await mountDashboard()

    expect(wrapper.find('a[href="/lists/league/league-1"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/lists/team/team-1"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/lists/volunteer/volunteer-1"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/all-items"]').exists()).toBe(true)
  })

  // AC 30 - a brand-new account with no entities sees a friendly empty dashboard.
  it('shows the friendly empty state when the dashboard has no groups', async () => {
    const { wrapper } = await mountDashboard()

    const emptyState = wrapper.find('[data-testid="empty-state"]')
    expect(emptyState.exists()).toBe(true)
    expect(emptyState.text()).toContain('No to-do lists yet.')
    expect(wrapper.findAll('h2')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="todo-item"]')).toHaveLength(0)
  })

  it('logs out and navigates to /login', async () => {
    mockPost.mockResolvedValueOnce({ data: undefined, error: undefined, response: response(204) })

    const { wrapper, router } = await mountDashboard()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(mockPost).toHaveBeenCalledWith('/api/auth/logout')
    expect(router.currentRoute.value.name).toBe('Login')
  })
})
