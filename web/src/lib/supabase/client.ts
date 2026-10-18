import { createBrowserClient } from '@supabase/ssr'

// Singleton — all components share one client.
// In-memory reference is kept so components don't recreate clients.
let _client: ReturnType<typeof createBrowserClient> | null = null

export const createClient = () => {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _client
}

export const resetBrowserClient = () => {
  _client = null
}

/**
 * Actively purges all Supabase auth cookies, localStorage, and sessionStorage keys.
 * Also resets the singleton client instance so no in-memory state or refresh timers linger.
 */
export const clearAllSupabaseAuth = () => {
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';')
    const hostname = window.location.hostname
    const domains = ['', hostname, `.${hostname}`]

    cookies.forEach((cookie) => {
      const name = cookie.split('=')[0].trim()
      if (name.startsWith('sb-')) {
        domains.forEach((domain) => {
          const domainStr = domain ? `; domain=${domain}` : ''
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0${domainStr}`
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax${domainStr}`
        })
      }
    })
  }

  if (typeof window !== 'undefined') {
    try {
      if (window.localStorage) {
        Object.keys(window.localStorage).forEach((key) => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            window.localStorage.removeItem(key)
          }
        })
      }
      if (window.sessionStorage) {
        Object.keys(window.sessionStorage).forEach((key) => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            window.sessionStorage.removeItem(key)
          }
        })
      }
    } catch {
      // ignore storage access errors
    }
  }

  resetBrowserClient()
}
