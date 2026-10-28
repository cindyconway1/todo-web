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
// becomes invalid once logged in (and vice versa). A 400 on a mutation can signal that mismatch
// - re-fetch the token and retry the same request exactly once.
const pendingRequestClones = new WeakMap<Request, Request>()

// ...but only a *bodiless* 400 signals it. Every 400 the API itself returns carries a
// ProblemDetails payload (see the 400 responses in schema.d.ts), because it comes from the
// controller. An antiforgery rejection never reaches the controller - the middleware
// short-circuits the pipeline and returns an empty 400. Replaying a ProblemDetails 400 would
// re-send a request the server already rejected on its merits, which double-submits the
// mutation: a second POST /api/todoitems creates a second item.
async function hasEmptyBody(response: Response): Promise<boolean> {
  try {
    return (await response.clone().text()).length === 0
  } catch {
    // An unreadable body is not a confirmed antiforgery rejection; don't replay.
    return false
  }
}

// Same-origin baseUrl so requests resolve through the Vite dev proxy (see vite.config.ts)
// instead of cross-origin to VITE_API_URL - cross-origin calls make the browser drop the auth
// cookie silently. VITE_API_URL is only used as the proxy target now. window.location.origin
// (not '') because the Request constructor needs an absolute URL outside real browsers (jsdom).
// fetch is resolved at call time (not captured at createClient) so tests can stub the global.
export const api = createClient<paths>({
  baseUrl: window.location.origin,
  credentials: 'include',
  fetch: (request) => globalThis.fetch(request),
})

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
      if (clone && (await hasEmptyBody(response))) {
        pendingRequestClones.delete(request)
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
