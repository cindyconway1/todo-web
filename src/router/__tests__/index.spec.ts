import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}))

import { useAuthStore } from '@/stores/auth'
import router from '@/router'

function mockAuthStore(isAuthenticated: boolean): void {
  vi.mocked(useAuthStore).mockReturnValue({
    user: null,
    isAuthenticated,
    fetchMe: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  } as unknown as ReturnType<typeof useAuthStore>)
}

describe('router guard', () => {
  beforeEach(() => {
    vi.mocked(useAuthStore).mockReset()
  })

  it('redirects an unauthenticated user to /login', async () => {
    mockAuthStore(false)

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('Login')
  })

  it('lands an authenticated user on the Dashboard', async () => {
    mockAuthStore(true)

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('Dashboard')
  })

  it('redirects an authenticated user away from /login to the Dashboard', async () => {
    mockAuthStore(true)

    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('Dashboard')
  })

  it('lets an unauthenticated user reach /register', async () => {
    mockAuthStore(false)

    await router.push('/register')

    expect(router.currentRoute.value.name).toBe('Register')
  })
})
