import { ref } from 'vue'
import { defineStore } from 'pinia'

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { useAntiforgery } from '@/composables/useAntiforgery'
import { toEntityError } from '@/stores/entityError'

type TodoListDto = components['schemas']['TodoListDto']
type TodoItemDto = components['schemas']['TodoItemDto']
type CreateTodoItemRequest = components['schemas']['CreateTodoItemRequest']
type UpdateTodoItemRequest = components['schemas']['UpdateTodoItemRequest']

const SCOPE_NOT_FOUND = 'That entity could not be found. It may have been deleted.'
const LIST_NOT_FOUND = 'That list could not be found. It may have been deleted.'
const ITEM_NOT_FOUND = 'That to-do item could not be found. It may have been deleted.'

export const useTodoItemStore = defineStore('todoItem', () => {
  // Items are kept in the exact order the API returns them (due date asc, nulls last,
  // tiebreak CreateDt) - the server owns sorting, so nothing here ever re-sorts.
  const items = ref<TodoItemDto[]>([])
  const listId = ref<string | null>(null)
  const loading = ref(false)
  const loaded = ref(false)
  const { ensureToken } = useAntiforgery()

  /** The backend get-or-creates the entity's implicit list; use the returned id as listId. */
  async function getListForScope(scopeType: string, scopeEntityId: string): Promise<TodoListDto> {
    const { data, error, response } = await api.GET('/api/lists/{scopeTypeName}/{scopeEntityId}', {
      params: { path: { scopeTypeName: scopeType, scopeEntityId } },
    })
    if (error) {
      throw toEntityError(error, response.status, { notFound: SCOPE_NOT_FOUND })
    }
    return data
  }

  async function fetchItems(id: string): Promise<void> {
    loading.value = true
    try {
      const { data, error, response } = await api.GET('/api/lists/{listId}/items', {
        params: { path: { listId: id } },
      })
      if (error) {
        throw toEntityError(error, response.status, { notFound: LIST_NOT_FOUND })
      }
      items.value = data
      listId.value = id
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function createItem(id: string, request: CreateTodoItemRequest): Promise<TodoItemDto> {
    await ensureToken()
    const { data, error, response } = await api.POST('/api/lists/{listId}/items', {
      params: { path: { listId: id } },
      body: request,
    })
    if (error) {
      throw toEntityError(error, response.status, { notFound: LIST_NOT_FOUND })
    }
    // Re-fetch instead of splicing locally: only the server knows where the new item
    // sorts, and the view must render its order verbatim.
    await fetchItems(id)
    return data
  }

  async function updateItem(id: string, request: UpdateTodoItemRequest): Promise<TodoItemDto> {
    await ensureToken()
    const { data, error, response } = await api.PUT('/api/items/{id}', {
      params: { path: { id } },
      body: request,
    })
    if (error) {
      throw toEntityError(error, response.status, { notFound: ITEM_NOT_FOUND })
    }
    // A changed due date can move the item, so re-sync the server-sorted list.
    if (listId.value) {
      await fetchItems(listId.value)
    }
    return data
  }

  async function deleteItem(id: string): Promise<void> {
    await ensureToken()
    const { error, response } = await api.DELETE('/api/items/{id}', {
      params: { path: { id } },
    })
    if (error) {
      throw toEntityError(error, response.status, { notFound: ITEM_NOT_FOUND })
    }
    items.value = items.value.filter((item) => item.id !== id)
  }

  async function completeItem(id: string): Promise<void> {
    await ensureToken()
    const { error, response } = await api.PATCH('/api/items/{id}/complete', {
      params: { path: { id } },
    })
    if (error) {
      throw toEntityError(error, response.status, { notFound: ITEM_NOT_FOUND })
    }
    // Completion is one-way and completed items are hidden everywhere - drop it.
    items.value = items.value.filter((item) => item.id !== id)
  }

  return {
    items,
    listId,
    loading,
    loaded,
    getListForScope,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    completeItem,
  }
})
