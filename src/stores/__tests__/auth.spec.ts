import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/client', () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
}))

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { useAntiforgery } from '@/composables/useAntiforgery'
import { useAuthStore } from '@/stores/auth'

type UserDto = components['schemas']['UserDto']
type MessageDto = components['schemas']['MessageDto']
type ValidationProblemDto = components['schemas']['ValidationProblemDto']

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>
const mockPost = api.POST as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

describe('useAuthStore', () => {
  let meResult: { data?: UserDto; error?: unknown; status: number }

  beforeEach(() => {
    setActivePinia(createPinia())
    mockGet.mockReset()
    mockPost.mockReset()

    meResult = { status: 401, error: { title: 'Unauthorized' } }
    mockGet.mockImplementation(async (path: string) => {
      if (path === '/api/auth/me') {
        return { data: meResult.data, error: meResult.error, response: response(meResult.status) }
      }
      // /api/auth/antiforgery
      return { data: undefined, error: undefined, response: response(204) }
    })

    // Antiforgery token already primed, so `ensureToken()` in store actions is a no-op and
    // doesn't interfere with call-count assertions on `api.GET`.
    useAntiforgery().token.value = 'primed-token'
  })

  it('fetchMe sets the user on a 200 response', async () => {
    meResult = { status: 200, data: { id: 'u1', email: 'a@example.com' } }

    const store = useAuthStore()
    await store.fetchMe()

    expect(store.user).toEqual({ id: 'u1', email: 'a@example.com' })
    expect(store.isAuthenticated).toBe(true)
  })

  it('fetchMe silently clears the user on a 401 response', async () => {
    const store = useAuthStore()
    store.user = { id: 'u1', email: 'a@example.com' }

    await store.fetchMe()

    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })

  it('login stores the user and re-mints the antiforgery token on success', async () => {
    mockPost.mockResolvedValueOnce({ data: undefined, error: undefined, response: response(204) })
    meResult = { status: 200, data: { id: 'u1', email: 'a@example.com' } }

    const store = useAuthStore()
    await store.login('a@example.com', 'password123')

    expect(mockPost).toHaveBeenCalledWith('/api/auth/login', {
      body: { email: 'a@example.com', password: 'password123' },
    })
    expect(store.user).toEqual({ id: 'u1', email: 'a@example.com' })
    expect(mockGet).toHaveBeenCalledWith('/api/auth/antiforgery')
    expect(mockGet).toHaveBeenCalledWith('/api/auth/me')
  })

  it('login throws a generic invalid-credentials error and leaves the user unset', async () => {
    const message: MessageDto = { message: 'exact server wording should not leak to the UI' }
    mockPost.mockResolvedValueOnce({ data: undefined, error: message, response: response(401) })

    const store = useAuthStore()
    await expect(store.login('a@example.com', 'wrong')).rejects.toMatchObject({
      kind: 'invalid-credentials',
      message: 'Invalid email or password.',
    })
    expect(store.user).toBeNull()
  })

  it('logout clears the user and re-mints the antiforgery token', async () => {
    mockPost.mockResolvedValueOnce({ data: undefined, error: undefined, response: response(204) })

    const store = useAuthStore()
    store.user = { id: 'u1', email: 'a@example.com' }
    await store.logout()

    expect(mockPost).toHaveBeenCalledWith('/api/auth/logout')
    expect(store.user).toBeNull()
    expect(mockGet).toHaveBeenCalledWith('/api/auth/antiforgery')
  })

  it('register returns the created user on success', async () => {
    const user: UserDto = { id: 'u2', email: 'new@example.com' }
    mockPost.mockResolvedValueOnce({ data: user, error: undefined, response: response(201) })

    const store = useAuthStore()
    const created = await store.register('new@example.com', 'password123')

    expect(created).toEqual(user)
    expect(mockPost).toHaveBeenCalledWith('/api/auth/register', {
      body: { email: 'new@example.com', password: 'password123' },
    })
  })

  it('register throws a duplicate-email error on 409', async () => {
    const message: MessageDto = { message: 'exact server wording should not leak to the UI' }
    mockPost.mockResolvedValueOnce({ data: undefined, error: message, response: response(409) })

    const store = useAuthStore()
    await expect(store.register('dup@example.com', 'password123')).rejects.toMatchObject({
      kind: 'duplicate-email',
      message: 'That email is already in use.',
    })
  })

  it('register maps 422 validation errors to field-level messages', async () => {
    const problem: ValidationProblemDto = {
      message: 'Validation failed',
      errors: [{ property: 'email', message: 'Email is required.' }],
    }
    mockPost.mockResolvedValueOnce({ data: undefined, error: problem, response: response(422) })

    const store = useAuthStore()
    await expect(store.register('', 'password123')).rejects.toMatchObject({
      kind: 'validation',
      fieldErrors: { email: 'Email is required.' },
    })
  })
})
