import type { Ref } from 'vue'

import { EntityError } from '@/stores/entityError'

export function requiredName(name: string): string | undefined {
  return name.trim() ? undefined : 'Name is required.'
}

/**
 * Routes a failed store action into form state: validation problems land on their
 * fields, everything else becomes the form-level error message.
 */
export function applyEntityError(
  err: unknown,
  fieldErrors: Record<string, string | undefined>,
  formError: Ref<string>,
): void {
  if (err instanceof EntityError && err.kind === 'validation' && err.fieldErrors) {
    Object.assign(fieldErrors, err.fieldErrors)
    return
  }
  formError.value =
    err instanceof EntityError ? err.message : 'Something went wrong. Please try again.'
}
