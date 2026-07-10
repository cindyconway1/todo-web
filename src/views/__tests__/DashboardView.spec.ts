import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

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

function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'Login', component: { template: '<div />' } },
      { path: '/', name: 'Dashboard', component: DashboardView },
      {
        path: '/lists/:scopeType/:scopeEntityId',
        name: 'ListDetail',
        component: { template: '<div />' },
      },
      { path: '/all-items', name: 'AllItems', component: { template: '<div />' } },
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

// The server pre-sorts items (due date asc, nulls last) and excludes completed items,
// so this fixture - like a real payload - holds only incomplete items, already ordered.
const dashboard: DashboardDto = {
  leagues: [
    {
      entityId: 'league-1',
      entityName: 'Sunday Rec',
      lists: [
        {
          listId: 'list-1',
          listName: 'Sunday Rec',
          items: [
            { id: 'i1', listId: 'list-1', title: 'Book pitch', dueDate: '2026-07-12' },
            { id: 'i2', listId: 'list-1', title: 'Order bibs', dueDate: null },
          ],
        },
      ],
    },
  ],
  teams: [
    {
      entityId: 'team-1',
      entityName: 'Red Rockets',
      lists: [
        {
          listId: 'list-2',
          listName: 'Red Rockets',
          items: [{ id: 'i3', listId: 'list-2', title: 'Wash kit', dueDate: '2026-07-11' }],
        },
      ],
    },
  ],
  people: [
    {
      entityId: 'vol-1',
      entityName: 'Alex Doe',
      lists: [{ listId: 'list-3', listName: 'Alex Doe', items: [] }],
    },
  ],
}

describe('DashboardView', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
  })

  // AC 28 - lists grouped by League / Team / Person, items pre-sorted, completed hidden.
  it('renders the three groups in order with lists and items exactly as returned', async () => {
    mockGet.mockResolvedValueOnce({ data: dashboard, error: undefined, response: response(200) })

    const { wrapper } = await mountDashboard()

    expect(mockGet).toHaveBeenCalledWith('/api/dashboard')

    const groups = wrapper.findAll('[data-testid^="group-"]')
    expect(groups.map((group) => group.attributes('data-testid'))).toEqual([
      'group-leagues',
      'group-teams',
      'group-people',
    ])

    expect(groups[0]!.text()).toContain('Sunday Rec')
    expect(groups[1]!.text()).toContain('Red Rockets')
    expect(groups[2]!.text()).toContain('Alex Doe')

    // Items appear in the exact order the API returned them - no client re-sort.
    const leagueItems = groups[0]!.findAll('[data-testid="dashboard-item"]')
    expect(leagueItems.map((item) => item.text())).toEqual([
      expect.stringContaining('Book pitch'),
      expect.stringContaining('Order bibs'),
    ])
    expect(leagueItems[0]!.text()).toContain('Due 2026-07-12')

    // An entity whose list has no open items still shows, with a friendly note.
    expect(groups[2]!.text()).toContain('All caught up!')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  // AC 28 - the dashboard is an overview: no complete/edit/delete controls on items.
  it('renders items read-only and links entities to the list-detail route', async () => {
    mockGet.mockResolvedValueOnce({ data: dashboard, error: undefined, response: response(200) })

    const { wrapper } = await mountDashboard()

    const hrefs = wrapper.findAll('a').map((anchor) => anchor.attributes('href'))
    // Lowercase scopeType, matching the links the entity views emit.
    expect(hrefs).toContain('/lists/league/league-1')
    expect(hrefs).toContain('/lists/team/team-1')
    expect(hrefs).toContain('/lists/volunteer/vol-1')
    expect(hrefs).toContain('/all-items')

    const item = wrapper.find('[data-testid="dashboard-item"]')
    expect(item.findAll('button')).toHaveLength(0)
  })

  // AC 30 - a brand-new account sees a friendly empty dashboard.
  it('shows the friendly empty state when the dashboard has no groups', async () => {
    const empty: DashboardDto = { leagues: [], teams: [], people: [] }
    mockGet.mockResolvedValueOnce({ data: empty, error: undefined, response: response(200) })

    const { wrapper } = await mountDashboard()

    const emptyState = wrapper.find('[data-testid="empty-state"]')
    expect(emptyState.exists()).toBe(true)
    expect(emptyState.text()).toContain('Welcome!')
    expect(wrapper.findAll('[data-testid^="group-"]')).toHaveLength(0)
    // The entity-management cards stay available so the user can create their first entity.
    expect(wrapper.find('nav[aria-label="Entity management"]').exists()).toBe(true)
  })

  it('surfaces a friendly error when the dashboard fails to load', async () => {
    mockGet.mockResolvedValueOnce({
      data: undefined,
      error: { title: 'Server error' },
      response: response(500),
    })

    const { wrapper } = await mountDashboard()

    expect(wrapper.find('[role="alert"]').text()).toBe(
      'Something went wrong. Please try again.',
    )
  })

  it('logs out and navigates to /login', async () => {
    mockGet.mockResolvedValue({ data: undefined, error: undefined, response: response(204) })
    mockPost.mockResolvedValueOnce({ data: undefined, error: undefined, response: response(204) })

    const { wrapper, router } = await mountDashboard()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(mockPost).toHaveBeenCalledWith('/api/auth/logout')
    expect(router.currentRoute.value.name).toBe('Login')
  })
})
