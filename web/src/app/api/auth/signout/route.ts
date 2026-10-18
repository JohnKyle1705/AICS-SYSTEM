import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const CACHE_COOKIE_NAME = 'aics-auth-cache'

function clearAllCookiesOnResponse(request: NextRequest, response: NextResponse) {
  const allCookies = request.cookies.getAll()
  const hostname = request.nextUrl.hostname

  // Also include explicitly known cookie names
  const cookieNamesToPurge = new Set<string>([
    CACHE_COOKIE_NAME,
    'sb-access-token',
    'sb-refresh-token',
  ])

  allCookies.forEach((c) => {
    if (c.name.startsWith('sb-') || c.name === CACHE_COOKIE_NAME) {
      cookieNamesToPurge.add(c.name)
    }
  })

  cookieNamesToPurge.forEach((name) => {
    // Delete without domain
    response.cookies.set({
      name,
      value: '',
      path: '/',
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
    })

    // Delete with domain if applicable
    if (hostname && hostname !== 'localhost') {
      response.cookies.set({
        name,
        value: '',
        path: '/',
        domain: hostname,
        expires: new Date(0),
        maxAge: 0,
        httpOnly: true,
        sameSite: 'lax',
      })
      response.cookies.set({
        name,
        value: '',
        path: '/',
        domain: `.${hostname}`,
        expires: new Date(0),
        maxAge: 0,
        httpOnly: true,
        sameSite: 'lax',
      })
    }
  })
}

export async function POST(request: NextRequest) {
  let response = NextResponse.json({ success: true, redirect: '/login' })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Local signOut with 1.5s timeout so it never hangs
    await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ])
  } catch (err) {
    console.warn('Server signout warning:', err)
  }

  clearAllCookiesOnResponse(request, response)
  return response
}

export async function GET(request: NextRequest) {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('logout', 'true')
  const response = NextResponse.redirect(loginUrl)

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ])
  } catch (err) {
    console.warn('Server signout GET warning:', err)
  }

  clearAllCookiesOnResponse(request, response)
  return response
}
