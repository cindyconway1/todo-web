import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, setUnauthorizedHandler } from '@/api/client'

function setXsrfCookie(value: string | null): void {
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  if (value !== null) {
    document.cookie = `XSRF-TOKEN=${value}; path=/`
  }
}

describe('api client', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setXsrfCookie(null)
    setUnauthorizedHandler(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sets X-XSRF-TOKEN on a mutating request from the XSRF-TOKEN cookie', async () => {
    setXsrfCookie('mutation-token')
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await api.POST('/api/auth/logout')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const sentRequest = fetchMock.mock.calls[0]?.[0] as Request
    expect(sentRequest.headers.get('X-XSRF-TOKEN')).toBe('mutation-token')
  })

  it('does not set X-XSRF-TOKEN on a GET request', async () => {
    setXsrfCookie('should-not-be-sent')
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))

    await api.GET('/api/auth/me')

    const sentRequest = fetchMock.mock.calls[0]?.[0] as Request
    expect(sentRequest.headers.get('X-XSRF-TOKEN')).toBeNull()
  })

  it('re-fetches the antiforgery token and retries exactly once on a 400', async () => {
    setXsrfCookie('stale-token')
    let nonAntiforgeryCalls = 0

    fetchMock.mockImplementation(async (request: Request) => {
      if (new URL(request.url).pathname === '/api/auth/antiforgery') {
        setXsrfCookie('fresh-token')
        return new Response(null, { status: 204 })
      }
      nonAntiforgeryCalls += 1
      if (nonAntiforgeryCalls === 1) {
        return new Response(null, { status: 400 })
      }
      return new Response(null, { status: 204 })
    })

    const result = await api.POST('/api/auth/logout')

    // original request (400) + antiforgery re-fetch + retried request
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result.response.status).toBe(204)
    const retryRequest = fetchMock.mock.calls[2]?.[0] as Request
    expect(retryRequest.headers.get('X-XSRF-TOKEN')).toBe('fresh-token')
  })

  it('triggers the unauthorized handler on a 401 from a protected endpoint', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))

    await api.POST('/api/auth/logout')

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('does not trigger the unauthorized handler on a 401 from the startup me check', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))

    await api.GET('/api/auth/me')

    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})
