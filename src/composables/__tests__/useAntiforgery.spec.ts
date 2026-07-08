import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', () => ({
  api: { GET: vi.fn<() => Promise<unknown>>() },
}))

import { api } from '@/api/client'
import { useAntiforgery } from '@/composables/useAntiforgery'

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>

function setXsrfCookie(value: string | null): void {
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  if (value !== null) {
    document.cookie = `XSRF-TOKEN=${value}; path=/`
  }
}

describe('useAntiforgery', () => {
  beforeEach(() => {
    mockGet.mockReset()
    setXsrfCookie(null)
    useAntiforgery().token.value = null
  })

  it('refresh() calls GET /api/auth/antiforgery and reads the resulting cookie', async () => {
    mockGet.mockImplementation(async () => {
      setXsrfCookie('fresh-token')
      return { data: undefined, error: undefined, response: new Response(null, { status: 204 }) }
    })

    const { refresh, token } = useAntiforgery()
    const result = await refresh()

    expect(mockGet).toHaveBeenCalledWith('/api/auth/antiforgery')
    expect(result).toBe('fresh-token')
    expect(token.value).toBe('fresh-token')
  })

  it('ensureToken() skips the network call when a token is already cached', async () => {
    const { ensureToken, token } = useAntiforgery()
    token.value = 'cached-token'

    const result = await ensureToken()

    expect(mockGet).not.toHaveBeenCalled()
    expect(result).toBe('cached-token')
  })

  it('ensureToken() fetches a token when none is cached', async () => {
    mockGet.mockImplementation(async () => {
      setXsrfCookie('minted-token')
      return { data: undefined, error: undefined, response: new Response(null, { status: 204 }) }
    })

    const { ensureToken } = useAntiforgery()
    const result = await ensureToken()

    expect(mockGet).toHaveBeenCalledWith('/api/auth/antiforgery')
    expect(result).toBe('minted-token')
  })
})
