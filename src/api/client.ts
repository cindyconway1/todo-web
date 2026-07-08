import createClient from 'openapi-fetch'

import type { paths } from '@/api/schema'
import { readXsrfCookie, XSRF_HEADER_NAME } from '@/api/xsrf'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const ME_PATH = '/api/auth/me'

function isMutating(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase())
}

type UnauthorizedHandler = () => void

let unauthorizedHandler: UnauthorizedHandler | null = null

/** Wired up by main.ts once the router exists, so the client stays decoupled from routing. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

// Antiforgery tokens are bound to the current auth identity: a token minted while anonymous
// becomes invalid once logged in (and vice versa). A 400 on a mutation signals that mismatch,
// not a validation error - re-fetch the token and retry the same request exactly once.
const pendingRequestClones = new WeakMap<Request, Request>()

// Relative baseUrl so requests resolve same-origin through the Vite dev proxy (see vite.config.ts)
// instead of cross-origin to VITE_API_URL - cross-origin calls make the browser drop the auth
// cookie silently. VITE_API_URL is only used as the proxy target now.
export const api = createClient<paths>({ baseUrl: '', credentials: 'include' })

api.use({
  async onRequest({ request }) {
    if (isMutating(request.method)) {
      pendingRequestClones.set(request, request.clone())
      const token = readXsrfCookie()
      if (token) {
        request.headers.set(XSRF_HEADER_NAME, token)
      }
    }
    return request
  },
  async onResponse({ request, response }) {
    if (isMutating(request.method) && response.status === 400) {
      const clone = pendingRequestClones.get(request)
      if (clone) {
        await api.GET('/api/auth/antiforgery')
        const retryHeaders = new Headers(clone.headers)
        const token = readXsrfCookie()
        if (token) {
          retryHeaders.set(XSRF_HEADER_NAME, token)
        }
        return fetch(new Request(clone, { headers: retryHeaders }))
      }
    }

    if (response.status === 401 && new URL(request.url).pathname !== ME_PATH) {
      unauthorizedHandler?.()
    }

    return response
  },
})
