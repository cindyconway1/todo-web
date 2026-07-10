import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/client', () => ({
  api: {
    GET: vi.fn<() => Promise<unknown>>(),
  },
}))

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { useDashboardStore } from '@/stores/dashboard'

type DashboardDto = components['schemas']['DashboardDto']

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

// AC 28 (data layer) - the dashboard groups lists by League / Team / Person.
describe('useDashboardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGet.mockReset()
  })

  it('fetchDashboard stores the grouped payload verbatim and marks it loaded', async () => {
    const dashboard: DashboardDto = {
      leagues: [
        {
          entityId: 'e1',
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
      teams: [],
      people: [],
    }
    mockGet.mockResolvedValueOnce({ data: dashboard, error: undefined, response: response(200) })

    const store = useDashboardStore()
    await store.fetchDashboard()

    expect(mockGet).toHaveBeenCalledWith('/api/dashboard')
    // Stored verbatim - the server owns sorting and completed-item exclusion.
    expect(store.dashboard).toEqual(dashboard)
    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('fetchDashboard throws a mapped EntityError on failure and stays not loaded', async () => {
    mockGet.mockResolvedValueOnce({
      data: undefined,
      error: { title: 'Server error' },
      response: response(500),
    })

    const store = useDashboardStore()

    await expect(store.fetchDashboard()).rejects.toThrow(
      'Something went wrong. Please try again.',
    )
    expect(store.dashboard).toBeNull()
    expect(store.loaded).toBe(false)
    expect(store.loading).toBe(false)
  })
})
