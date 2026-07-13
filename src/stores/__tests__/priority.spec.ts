import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/client', () => ({
  api: {
    GET: vi.fn<() => Promise<unknown>>(),
  },
}))

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { usePriorityStore } from '@/stores/priority'

type PriorityDto = components['schemas']['PriorityDto']

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

describe('usePriorityStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGet.mockReset()
  })

  it('fetchPriorities loads the options from the API', async () => {
    const priorities: PriorityDto[] = [
      { id: 1, name: 'High', sortOrder: 1 },
      { id: 2, name: 'Medium', sortOrder: 2 },
      { id: 3, name: 'Low', sortOrder: 3 },
    ]
    mockGet.mockResolvedValueOnce({ data: priorities, error: undefined, response: response(200) })

    const store = usePriorityStore()
    await store.fetchPriorities()

    expect(mockGet).toHaveBeenCalledWith('/api/priorities')
    expect(store.priorities).toEqual(priorities)
    expect(store.loaded).toBe(true)
  })

  // The dropdown order is the API's sortOrder field - nothing client-side invents
  // an ordering (or a priority list) of its own.
  it('orders the options by the API-provided sortOrder, not by response position', async () => {
    const priorities: PriorityDto[] = [
      { id: 2, name: 'Medium', sortOrder: 2 },
      { id: 3, name: 'Low', sortOrder: 3 },
      { id: 1, name: 'High', sortOrder: 1 },
    ]
    mockGet.mockResolvedValueOnce({ data: priorities, error: undefined, response: response(200) })

    const store = usePriorityStore()
    await store.fetchPriorities()

    expect(store.priorities.map((priority) => priority.name)).toEqual(['High', 'Medium', 'Low'])
  })

  it('maps a failed fetch to an EntityError and stays unloaded', async () => {
    mockGet.mockResolvedValueOnce({
      data: undefined,
      error: { title: 'Server error' },
      response: response(500),
    })

    const store = usePriorityStore()
    await expect(store.fetchPriorities()).rejects.toMatchObject({ kind: 'unknown' })
    expect(store.priorities).toEqual([])
    expect(store.loaded).toBe(false)
    expect(store.loading).toBe(false)
  })
})
