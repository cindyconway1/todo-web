import type { components } from '@/api/schema'

type ValidationErrorDto = components['schemas']['ValidationErrorDto']
type ValidationProblemDto = components['schemas']['ValidationProblemDto']

export type EntityErrorKind = 'not-found' | 'conflict' | 'validation' | 'unknown'

/** Typed failure thrown by entity store actions, mirroring AuthError in @/stores/auth. */
export class EntityError extends Error {
  kind: EntityErrorKind
  fieldErrors?: Record<string, string>

  constructor(kind: EntityErrorKind, message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.kind = kind
    this.fieldErrors = fieldErrors
  }
}

export interface EntityErrorMessages {
  notFound?: string
  conflict?: string
}

function mapFieldErrors(errors: ValidationErrorDto[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const fieldError of errors) {
    if (fieldError.property) {
      // Property names may arrive PascalCase ("Name") - lowercase the first letter so they
      // line up with the camelCase form-field keys used in the views.
      const key = fieldError.property.charAt(0).toLowerCase() + fieldError.property.slice(1)
      fieldErrors[key] = fieldError.message ?? 'Invalid value.'
    }
  }
  return fieldErrors
}

/**
 * Maps a failed API result to an EntityError. 404 covers both a missing entity and an
 * ownership failure (the backend answers 404 for entities owned by someone else), so
 * callers pass a message that names what could not be found.
 */
export function toEntityError(
  error: unknown,
  status: number,
  messages: EntityErrorMessages = {},
): EntityError {
  if (status === 404) {
    return new EntityError(
      'not-found',
      messages.notFound ?? 'That item could not be found. It may have been deleted.',
    )
  }
  if (status === 409) {
    return new EntityError(
      'conflict',
      messages.conflict ?? 'That conflicts with something that already exists.',
    )
  }
  // Structural narrowing (not status) so TS discriminates error unions the same way the
  // auth store does.
  if (typeof error === 'object' && error !== null && 'errors' in error) {
    const problem = error as ValidationProblemDto
    return new EntityError(
      'validation',
      'Please fix the highlighted fields.',
      mapFieldErrors(problem.errors ?? []),
    )
  }
  return new EntityError('unknown', 'Something went wrong. Please try again.')
}
