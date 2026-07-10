import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/client', () => ({
  api: { GET: vi.fn<() => Promise<unknown>>() },
}))

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { useDashboardStore } from '@/stores/dashboard'

type DashboardDto = components['schemas']['DashboardDto']
type ProblemDetails = components['schemas']['ProblemDetails']

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

// AC 28 - the dashboard store fetches the grouped read model from GET /api/dashboard.
describe('useDashboardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGet.mockReset()
  })

  it('fetchDashboard stores the grouped dashboard and marks it loaded', async () => {
    const dashboard: DashboardDto = {
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
                  title: 'Book the field',
                  dueDate: '2026-07-12',
                  isCompleted: false,
                },
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
    expect(store.dashboard).toEqual(dashboard)
    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('fetchDashboard throws on failure and leaves state untouched', async () => {
    const problem: ProblemDetails = { title: 'Unauthorized', status: 401 }
    mockGet.mockResolvedValueOnce({ data: undefined, error: problem, response: response(401) })

    const store = useDashboardStore()
    await expect(store.fetchDashboard()).rejects.toMatchObject({ kind: 'unknown' })

    expect(store.dashboard).toBeNull()
    expect(store.loaded).toBe(false)
    expect(store.loading).toBe(false)
  })
})
