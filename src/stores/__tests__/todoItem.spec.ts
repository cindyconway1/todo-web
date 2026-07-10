import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/client', () => ({
  api: {
    GET: vi.fn<() => Promise<unknown>>(),
    POST: vi.fn<() => Promise<unknown>>(),
    PUT: vi.fn<() => Promise<unknown>>(),
    PATCH: vi.fn<() => Promise<unknown>>(),
    DELETE: vi.fn<() => Promise<unknown>>(),
  },
}))

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { useAntiforgery } from '@/composables/useAntiforgery'
import { useTodoItemStore } from '@/stores/todoItem'

type TodoListDto = components['schemas']['TodoListDto']
type TodoItemDto = components['schemas']['TodoItemDto']
type MessageDto = components['schemas']['MessageDto']
type ValidationProblemDto = components['schemas']['ValidationProblemDto']

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>
const mockPost = api.POST as unknown as ReturnType<typeof vi.fn>
const mockPut = api.PUT as unknown as ReturnType<typeof vi.fn>
const mockPatch = api.PATCH as unknown as ReturnType<typeof vi.fn>
const mockDelete = api.DELETE as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

function ok<T>(data: T, status = 200) {
  return { data, error: undefined, response: response(status) }
}

describe('useTodoItemStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockPatch.mockReset()
    mockDelete.mockReset()
    // Antiforgery token already primed so ensureToken() in actions is a no-op.
    useAntiforgery().token.value = 'primed-token'
  })

  it('getListForScope calls the get-or-create endpoint and returns the list', async () => {
    const list: TodoListDto = { id: 'list-1', scopeType: 'League', scopeEntityId: 'e1' }
    mockGet.mockResolvedValueOnce(ok(list))

    const store = useTodoItemStore()
    const result = await store.getListForScope('league', 'e1')

    expect(mockGet).toHaveBeenCalledWith('/api/lists/{scopeTypeName}/{scopeEntityId}', {
      params: { path: { scopeTypeName: 'league', scopeEntityId: 'e1' } },
    })
    expect(result).toEqual(list)
  })

  // AC 20 - unowned/nonexistent scope entities come back 404 and surface cleanly.
  it('getListForScope maps a 404 to a not-found error', async () => {
    const message: MessageDto = { message: 'Scope entity not found.' }
    mockGet.mockResolvedValueOnce({ data: undefined, error: message, response: response(404) })

    const store = useTodoItemStore()
    await expect(store.getListForScope('league', 'someone-elses')).rejects.toMatchObject({
      kind: 'not-found',
    })
  })

  // AC 26/27 - the store keeps the server's pre-sorted order verbatim (no client re-sort).
  it('fetchItems stores the items in the exact order the API returned', async () => {
    const items: TodoItemDto[] = [
      { id: 'i1', listId: 'list-1', title: 'Dated early', dueDate: '2026-07-01' },
      { id: 'i2', listId: 'list-1', title: 'Dated later', dueDate: '2026-07-15' },
      { id: 'i3', listId: 'list-1', title: 'Undated last' },
    ]
    mockGet.mockResolvedValueOnce(ok(items))

    const store = useTodoItemStore()
    await store.fetchItems('list-1')

    expect(mockGet).toHaveBeenCalledWith('/api/lists/{listId}/items', {
      params: { path: { listId: 'list-1' } },
    })
    expect(store.items.map((item) => item.id)).toEqual(['i1', 'i2', 'i3'])
    expect(store.listId).toBe('list-1')
    expect(store.loaded).toBe(true)
  })

  // AC 23 - a title-only item posts a body without dueDate/description.
  it('createItem posts the request body verbatim and re-fetches the server-sorted list', async () => {
    const created: TodoItemDto = { id: 'i1', listId: 'list-1', title: 'Only a title' }
    mockPost.mockResolvedValueOnce(ok(created, 201))
    mockGet.mockResolvedValueOnce(ok([created]))

    const store = useTodoItemStore()
    const result = await store.createItem('list-1', { title: 'Only a title' })

    expect(mockPost).toHaveBeenCalledWith('/api/lists/{listId}/items', {
      params: { path: { listId: 'list-1' } },
      body: { title: 'Only a title' },
    })
    expect(mockPost.mock.calls[0]![1].body).not.toHaveProperty('dueDate')
    expect(mockGet).toHaveBeenCalledWith('/api/lists/{listId}/items', {
      params: { path: { listId: 'list-1' } },
    })
    expect(result).toEqual(created)
    expect(store.items).toEqual([created])
  })

  // AC 21 - backend 422 (e.g. missing title) maps to field-level validation errors.
  it('createItem maps 422 validation problems to field errors', async () => {
    const problem: ValidationProblemDto = {
      message: 'Validation failed',
      errors: [{ property: 'Title', message: 'Title is required.' }],
    }
    mockPost.mockResolvedValueOnce({ data: undefined, error: problem, response: response(422) })

    const store = useTodoItemStore()
    await expect(store.createItem('list-1', { title: '' })).rejects.toMatchObject({
      kind: 'validation',
      fieldErrors: { title: 'Title is required.' },
    })
    expect(mockGet).not.toHaveBeenCalled()
  })

  // AC 24 - a valid YYYY-MM-DD due date is sent through unchanged.
  it('updateItem puts the request body and re-fetches the current list', async () => {
    const updated: TodoItemDto = {
      id: 'i1',
      listId: 'list-1',
      title: 'Renamed',
      dueDate: '2026-08-01',
    }
    mockGet.mockResolvedValue(ok([updated]))
    mockPut.mockResolvedValueOnce(ok(updated))

    const store = useTodoItemStore()
    await store.fetchItems('list-1')
    const result = await store.updateItem('i1', { title: 'Renamed', dueDate: '2026-08-01' })

    expect(mockPut).toHaveBeenCalledWith('/api/items/{id}', {
      params: { path: { id: 'i1' } },
      body: { title: 'Renamed', dueDate: '2026-08-01' },
    })
    expect(result).toEqual(updated)
    // Re-fetched once on load and once after the update.
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it('deleteItem removes the item from local state', async () => {
    mockDelete.mockResolvedValueOnce(ok(undefined, 204))

    const store = useTodoItemStore()
    store.items = [
      { id: 'i1', listId: 'list-1', title: 'Keep me' },
      { id: 'i2', listId: 'list-1', title: 'Delete me' },
    ]
    await store.deleteItem('i2')

    expect(mockDelete).toHaveBeenCalledWith('/api/items/{id}', {
      params: { path: { id: 'i2' } },
    })
    expect(store.items.map((item) => item.id)).toEqual(['i1'])
  })

  // AC 25 - completing calls PATCH /complete and removes the item from local state
  // (completion is one-way; there is no un-complete action on the store at all).
  it('completeItem patches the complete endpoint and removes the item', async () => {
    mockPatch.mockResolvedValueOnce(ok(undefined, 204))

    const store = useTodoItemStore()
    store.items = [
      { id: 'i1', listId: 'list-1', title: 'Done with this' },
      { id: 'i2', listId: 'list-1', title: 'Still open' },
    ]
    await store.completeItem('i1')

    expect(mockPatch).toHaveBeenCalledWith('/api/items/{id}/complete', {
      params: { path: { id: 'i1' } },
    })
    expect(store.items.map((item) => item.id)).toEqual(['i2'])
  })

  it('completeItem maps a 404 to a not-found error and leaves state untouched', async () => {
    const message: MessageDto = { message: 'not found' }
    mockPatch.mockResolvedValueOnce({ data: undefined, error: message, response: response(404) })

    const store = useTodoItemStore()
    store.items = [{ id: 'i1', listId: 'list-1', title: 'Ghost' }]
    await expect(store.completeItem('i1')).rejects.toMatchObject({ kind: 'not-found' })
    expect(store.items).toHaveLength(1)
  })
})
