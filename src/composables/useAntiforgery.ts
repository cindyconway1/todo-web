import { ref } from 'vue'

import { api } from '@/api/client'
import { readXsrfCookie } from '@/api/xsrf'

// Module-level (not per-call) state: one antiforgery token for the whole app, shared by every
// caller of the composable.
const token = ref<string | null>(readXsrfCookie())

async function refresh(): Promise<string | null> {
  await api.GET('/api/auth/antiforgery')
  token.value = readXsrfCookie()
  return token.value
}

async function ensureToken(): Promise<string | null> {
  if (token.value) {
    return token.value
  }
  return refresh()
}

export function useAntiforgery() {
  return { token, ensureToken, refresh }
}
