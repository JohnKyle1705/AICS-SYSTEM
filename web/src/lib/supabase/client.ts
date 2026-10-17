import { createBrowserClient } from '@supabase/ssr'

// Singleton — all components share one client.
// An in-memory queue lock ensures concurrent auth requests (such as simultaneous
// getUser calls or token refreshes during component mounting) run sequentially without
// racing Supabase's Refresh Token Rotation, while avoiding deadlocks in React StrictMode/HMR.
let _client: ReturnType<typeof createBrowserClient> | null = null
let _lockQueue = Promise.resolve()

export const createClient = () => {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          lock: async (_name, _acquireTimeout, fn) => {
            const previous = _lockQueue
            let release: () => void
            _lockQueue = new Promise<void>((resolve) => {
              release = resolve
            })
            await previous
            try {
              return await fn()
            } finally {
              release!()
            }
          },
        },
      }
    )
  }
  return _client
}
