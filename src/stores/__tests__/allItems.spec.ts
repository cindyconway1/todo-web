import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/client', () => ({
  api: {
    GET: vi.fn<() => Promise<unknown>>(),
  },
}))

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { useAllItemsStore } from '@/stores/allItems'

type AllItemDto = components['schemas']['AllItemDto']

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

// AC 29 - all incomplete items across all lists are fetched as one flat,
// pre-sorted list (due date asc, undated last) and stored in the API's order.
describe('useAllItemsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGet.mockReset()
  })

  it('fetchAll stores the flattened list in the returned order and marks it loaded', async () => {
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
        listName: 'Admin',
        scopeType: 'League',
        scopeName: 'Sunday Rec',
        title: 'Renew insurance',
        dueDate: null,
      },
    ]
    mockGet.mockResolvedValueOnce({ data: items, error: undefined, response: response(200) })

    const store = useAllItemsStore()
    await store.fetchAll()

    expect(mockGet).toHaveBeenCalledWith('/api/items/all')
    expect(store.items).toEqual(items)
    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('fetchAll maps a failed response to an EntityError and clears the loading flag', async () => {
    mockGet.mockResolvedValueOnce({ data: undefined, error: {}, response: response(401) })

    const store = useAllItemsStore()
    await expect(store.fetchAll()).rejects.toMatchObject({ kind: 'unknown' })
    expect(store.items).toEqual([])
    expect(store.loaded).toBe(false)
    expect(store.loading).toBe(false)
  })
})
