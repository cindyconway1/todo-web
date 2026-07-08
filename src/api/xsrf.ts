const XSRF_COOKIE_NAME = 'XSRF-TOKEN'

export const XSRF_HEADER_NAME = 'X-XSRF-TOKEN'

export function readXsrfCookie(): string | null {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${XSRF_COOKIE_NAME}=`))
  if (!match) {
    return null
  }
  return decodeURIComponent(match.slice(XSRF_COOKIE_NAME.length + 1))
}
