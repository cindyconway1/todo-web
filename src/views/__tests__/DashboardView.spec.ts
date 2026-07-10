import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'

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

// Completed items are excluded server-side (the contract returns only incomplete items,
// pre-sorted), so the fixture contains none and the view renders it verbatim.
const groupedDashboard: DashboardDto = {
  leagues: [
    {
      entityId: 'league-1',
      entityName: 'Sunday Rec',
      lists: [
        {
          listId: 'list-l1',
          listName: 'Sunday Rec to-dos',
          items: [
            {
              id: 'item-1',
              listId: 'list-l1',
              title: 'Book the field',
              dueDate: '2026-07-12',
              isCompleted: false,
            },
            { id: 'item-2', listId: 'list-l1', title: 'Order jerseys', isCompleted: false },
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
          listId: 'list-t1',
          listName: 'Tigers to-dos',
          items: [
            {
              id: 'item-3',
              listId: 'list-t1',
              title: 'Schedule practice',
              dueDate: '2026-07-11',
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
          listId: 'list-v1',
          listName: 'Alex Doe to-dos',
          items: [
            { id: 'item-4', listId: 'list-v1', title: 'Collect availability', isCompleted: false },
          ],
        },
      ],
    },
  ],
}

function createTestRouter(): Router {
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

async function mountDashboard(dashboard: DashboardDto) {
  mockGet.mockResolvedValueOnce({ data: dashboard, error: undefined, response: response(200) })
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
  })

  // AC 28 - lists are grouped into Leagues / Teams / People, each list under its entity,
  // items rendered in the pre-sorted order the API returns (completed items never arrive).
  it('renders the three groups in order with lists and items as returned', async () => {
    const { wrapper } = await mountDashboard(groupedDashboard)

    expect(mockGet).toHaveBeenCalledWith('/api/dashboard')

    const sections = wrapper.findAll('main section')
    expect(sections.map((section) => section.find('h2').text())).toEqual([
      'Leagues',
      'Teams',
      'People',
    ])

    const [leagues, teams, people] = sections
    expect(leagues!.text()).toContain('Sunday Rec')
    expect(leagues!.text()).toContain('Sunday Rec to-dos')
    expect(teams!.text()).toContain('Tigers')
    expect(people!.text()).toContain('Alex Doe')

    // Items appear in the order the API returned them (server pre-sorts, nulls last).
    const leagueItems = leagues!.findAll('li').map((item) => item.text())
    expect(leagueItems).toHaveLength(2)
    expect(leagueItems[0]).toContain('Book the field')
    expect(leagueItems[0]).toContain('Due 2026-07-12')
    expect(leagueItems[1]).toContain('Order jerseys')

    expect(wrapper.text()).not.toContain('Nothing to do yet')
  })

  // AC 28 - each entity/list links to its list-detail route; the scopeType token uses the
  // backend ScopeType enum names (League / Team / Volunteer).
  it('links entities to /lists/{scopeType}/{entityId} and exposes the All Items link', async () => {
    const { wrapper } = await mountDashboard(groupedDashboard)

    expect(wrapper.find('a[href="/lists/League/league-1"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/lists/Team/team-1"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/lists/Volunteer/volunteer-1"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/all-items"]').exists()).toBe(true)
  })

  // AC 30 - a brand-new account with no entities sees a friendly empty dashboard.
  it('shows the friendly empty state when the dashboard has no groups', async () => {
    const { wrapper } = await mountDashboard(emptyDashboard)

    expect(wrapper.text()).toContain('Nothing to do yet')
    expect(wrapper.findAll('main section')).toHaveLength(0)
    // The header and entity-management links are still available to get started.
    expect(wrapper.find('a[href="/leagues"]').exists()).toBe(true)
  })

  it('shows an error message when the dashboard fails to load', async () => {
    mockGet.mockResolvedValueOnce({
      data: undefined,
      error: { title: 'Unauthorized', status: 401 },
      response: response(401),
    })
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createTestRouter()
    await router.push('/')
    await router.isReady()
    const wrapper = mount(DashboardView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Your lists could not be loaded.')
  })

  it('logs out and navigates to /login', async () => {
    const { wrapper, router } = await mountDashboard(emptyDashboard)
    mockPost.mockResolvedValueOnce({ data: undefined, error: undefined, response: response(204) })

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(mockPost).toHaveBeenCalledWith('/api/auth/logout')
    expect(router.currentRoute.value.name).toBe('Login')
  })
})
