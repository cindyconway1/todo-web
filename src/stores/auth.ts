import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { useAntiforgery } from '@/composables/useAntiforgery'

type UserDto = components['schemas']['UserDto']
type ValidationProblemDto = components['schemas']['ValidationProblemDto']

export type AuthErrorKind = 'duplicate-email' | 'invalid-credentials' | 'validation' | 'unknown'

export class AuthError extends Error {
  kind: AuthErrorKind
  fieldErrors?: Record<string, string>

  constructor(kind: AuthErrorKind, message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.kind = kind
    this.fieldErrors = fieldErrors
  }
}

function mapFieldErrors(problem: ValidationProblemDto): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const fieldError of problem.errors ?? []) {
    if (fieldError.property) {
      fieldErrors[fieldError.property] = fieldError.message ?? 'Invalid value.'
    }
  }
  return fieldErrors
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserDto | null>(null)
  const isAuthenticated = computed(() => user.value !== null)
  const { ensureToken, refresh } = useAntiforgery()

  async function fetchMe(): Promise<void> {
    const { data, error } = await api.GET('/api/auth/me')
    user.value = error ? null : (data ?? null)
  }

  async function register(email: string, password: string): Promise<UserDto> {
    await ensureToken()
    const { data, error, response } = await api.POST('/api/auth/register', {
      body: { email, password },
    })

    if (error) {
      if (response.status === 409) {
        throw new AuthError('duplicate-email', 'That email is already in use.')
      }
      // Structural narrowing (not response.status) so TS discriminates the MessageDto |
      // ValidationProblemDto union correctly - status is typed as plain `number`.
      if ('errors' in error) {
        throw new AuthError(
          'validation',
          'Please fix the highlighted fields.',
          mapFieldErrors(error),
        )
      }
      throw new AuthError('unknown', 'Something went wrong. Please try again.')
    }

    return data
  }

  async function login(email: string, password: string): Promise<void> {
    await ensureToken()
    const { error } = await api.POST('/api/auth/login', {
      body: { email, password },
    })

    if (error) {
      if ('errors' in error) {
        throw new AuthError(
          'validation',
          'Please fix the highlighted fields.',
          mapFieldErrors(error),
        )
      }
      // Deliberately generic: never reveal whether the email or the password was wrong.
      throw new AuthError('invalid-credentials', 'Invalid email or password.')
    }

    // A token minted while anonymous is invalid once logged in - re-mint before it's used again.
    await refresh()
    await fetchMe()
  }

  async function logout(): Promise<void> {
    await api.POST('/api/auth/logout')
    user.value = null
    await refresh()
  }

  return { user, isAuthenticated, fetchMe, register, login, logout }
})
