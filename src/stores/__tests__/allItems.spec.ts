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

// AC 29 - one flattened list of every incomplete item across all of the user's lists.
describe('useAllItemsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGet.mockReset()
  })

  it('fetchAll stores the flattened items in the returned order and marks it loaded', async () => {
    // Backend order: due date ascending, undated last - the store must not re-sort.
    const items: AllItemDto[] = [
      {
        id: 'i1',
        listId: 'list-1',
        listName: 'Match day',
        scopeType: 'Team',
        scopeName: 'Wildcats',
        title: 'Pump the balls',
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
    mockGet.mockResolvedValueOnce({ data: items, error: undefined, response: response(200) })

    const store = useAllItemsStore()
    await store.fetchAll()

    expect(mockGet).toHaveBeenCalledWith('/api/items/all')
    expect(store.items).toEqual(items)
    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('fetchAll surfaces failures as an EntityError and leaves state untouched', async () => {
    mockGet.mockResolvedValueOnce({
      data: undefined,
      error: { title: 'Unauthorized' },
      response: response(401),
    })

    const store = useAllItemsStore()
    await expect(store.fetchAll()).rejects.toMatchObject({ kind: 'unknown' })
    expect(store.items).toEqual([])
    expect(store.loaded).toBe(false)
    expect(store.loading).toBe(false)
  })
})
