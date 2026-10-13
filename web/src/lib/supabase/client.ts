import { createBrowserClient } from '@supabase/ssr'

// Singleton — all components share one client to prevent navigator lock contention
// when multiple concurrent supabase.auth.getUser() calls race each other.
let _client: ReturnType<typeof createBrowserClient> | null = null

export const createClient = () => {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          lock: async (_name, _acquireTimeout, fn) => {
            return await fn()
          },
        },
      }
    )
  }
  return _client
}
