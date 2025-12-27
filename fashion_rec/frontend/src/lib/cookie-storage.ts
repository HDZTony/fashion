/**
 * Cookie utility functions for storing authentication tokens.
 * 
 * Cookies are automatically sent with every HTTP request (including page refresh),
 * making them ideal for authentication tokens that need to be available
 * even when JavaScript hasn't loaded yet.
 */

const COOKIE_NAME = 'auth_token'
const MAX_AGE_DAYS = 7

/**
 * Get authentication token from cookie
 */
export function getTokenFromCookie(): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const nameEQ = COOKIE_NAME + '='
  const ca = document.cookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) === ' ') c = c.substring(1, c.length)
    if (c.indexOf(nameEQ) === 0) {
      try {
        return decodeURIComponent(c.substring(nameEQ.length, c.length))
      } catch {
        return c.substring(nameEQ.length, c.length)
      }
    }
  }
  return null
}

/**
 * Set authentication token in cookie
 */
export function setTokenInCookie(token: string): void {
  if (typeof document === 'undefined') {
    return
  }

  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 // Convert days to seconds
  const expires = new Date(Date.now() + maxAge * 1000).toUTCString()
  
  // Set cookie with SameSite=Lax for CSRF protection
  // Secure flag will be added automatically by browser if on HTTPS
  const cookieValue = `${COOKIE_NAME}=${encodeURIComponent(token)}; expires=${expires}; path=/; SameSite=Lax`
  
  // If on HTTPS, add Secure flag
  if (location.protocol === 'https:') {
    document.cookie = `${cookieValue}; Secure`
  } else {
    document.cookie = cookieValue
  }
}

/**
 * Remove authentication token from cookie
 */
export function removeTokenFromCookie(): void {
  if (typeof document === 'undefined') {
    return
  }

  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
}

