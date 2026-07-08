const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function validateEmail(email: string): string | null {
  if (!email) {
    return 'Email is required.'
  }
  if (email.length > 256) {
    return 'Email must be 256 characters or fewer.'
  }
  if (!EMAIL_PATTERN.test(email)) {
    return 'Enter a valid email address.'
  }
  return null
}

export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required.'
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters.'
  }
  if (password.length > 128) {
    return 'Password must be 128 characters or fewer.'
  }
  return null
}
