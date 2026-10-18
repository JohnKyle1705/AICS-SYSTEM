import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Helper for generating & verifying HMAC SHA-256 signatures using standard Web Crypto API
const CACHE_SECRET = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'aics-cache-secret'
const CACHE_COOKIE_NAME = 'aics-auth-cache'
const CACHE_TTL_SECONDS = 120 // 2 minutes cache for role/active status

async function createSignature(data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(CACHE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function verifyCacheCookie(value: string | undefined): Promise<{ userId: string; role: string; isActive: boolean } | null> {
  if (!value) return null
  try {
    const parts = value.split(':')
    if (parts.length !== 5) return null
    const [userId, role, activeStr, expStr, sig] = parts
    const exp = parseInt(expStr, 10)
    if (isNaN(exp) || Date.now() > exp) return null
    const expectedSig = await createSignature(`${userId}:${role}:${activeStr}:${expStr}`)
    if (sig !== expectedSig) return null
    return {
      userId,
      role,
      isActive: activeStr === '1',
    }
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/forgot-password')
  const isResetPasswordPage = pathname.startsWith('/auth/reset-password')
  const isPendingPage = pathname.startsWith('/pending')
  const isAuthCallback = pathname.startsWith('/auth/callback')
  const isPublicPage = isAuthPage || isResetPasswordPage || isPendingPage || isAuthCallback || pathname === '/'
  const isProtected = !isPublicPage

  // Check if any Supabase auth cookies exist at all
  const allCookies = request.cookies.getAll()
  const hasAuthTokenCookie = allCookies.some((c) => c.name.startsWith('sb-') && c.value && c.name.includes('-auth-token'))

  // Fast-path: If user has no auth cookie at all
  if (!hasAuthTokenCookie) {
    if (isProtected) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  // Helper to completely purge any Supabase auth cookies + our auth cache cookie
  const clearAuthCookies = (res: NextResponse) => {
    allCookies.forEach((cookie) => {
      if (cookie.name.startsWith('sb-') || cookie.name === CACHE_COOKIE_NAME) {
        res.cookies.set({
          name: cookie.name,
          value: '',
          path: '/',
          expires: new Date(0),
          maxAge: 0,
        })
        res.cookies.delete(cookie.name)
      }
    })
  }

  // Helper to redirect and preserve Supabase cookies
  const redirect = (path: string, authErrorOccurred = false) => {
    const redirectResponse = NextResponse.redirect(new URL(path, request.url))
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    if (authErrorOccurred) {
      clearAuthCookies(redirectResponse)
    }
    return redirectResponse
  }

  // Fast-path: Check cached authenticated session & profile
  const cached = await verifyCacheCookie(request.cookies.get(CACHE_COOKIE_NAME)?.value)
  if (cached) {
    if (isResetPasswordPage) {
      return supabaseResponse
    }

    if (!cached.isActive && isProtected) {
      return redirect('/pending')
    }

    if (cached.isActive && (isPendingPage || isAuthPage)) {
      const dest = cached.role === 'admin' ? '/admin/dashboard' : cached.role === 'treasurer' ? '/treasurer' : '/resident/dashboard'
      return redirect(dest)
    }

    if (pathname === '/dashboard') {
      const dest = cached.role === 'admin' ? '/admin/dashboard' : cached.role === 'treasurer' ? '/treasurer' : '/resident/dashboard'
      return redirect(dest)
    }

    // Role-based Path Protection
    const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/users')
    const isResidentPath = pathname.startsWith('/resident')
    const isTreasurerPath = pathname.startsWith('/treasurer')

    if (isAdminPath && cached.role !== 'admin') {
      return redirect(cached.role === 'treasurer' ? '/treasurer' : '/resident/dashboard')
    }
    if (isResidentPath && cached.role !== 'resident') {
      return redirect(cached.role === 'admin' ? '/admin/dashboard' : '/treasurer')
    }
    if (isTreasurerPath && cached.role !== 'treasurer') {
      return redirect(cached.role === 'admin' ? '/admin/dashboard' : '/resident/dashboard')
    }

    return supabaseResponse
  }

  // Cache miss or expired: Full validation via Supabase SSR client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    clearAuthCookies(supabaseResponse)
    if (isProtected) {
      return redirect('/login', true)
    }
    return supabaseResponse
  }

  if (isResetPasswordPage) {
    return supabaseResponse
  }

  let { data: p } = await supabase.from('profiles').select('is_active, role').eq('id', user.id).single()

  if (!p) {
    await supabase.from('profiles').upsert({
      id: user.id,
      full_name: user.user_metadata?.full_name || '',
      role: 'resident',
      is_active: false,
    }, { onConflict: 'id', ignoreDuplicates: true })
    const { data: newP } = await supabase.from('profiles').select('is_active, role').eq('id', user.id).single()
    p = newP
  }

  const isActive = p?.is_active === true
  const role = p?.role || 'resident'

  // Set the signed auth cache cookie to eliminate future redundant DB queries
  const exp = Date.now() + CACHE_TTL_SECONDS * 1000
  const sig = await createSignature(`${user.id}:${role}:${isActive ? '1' : '0'}:${exp}`)
  const cacheValue = `${user.id}:${role}:${isActive ? '1' : '0'}:${exp}:${sig}`

  supabaseResponse.cookies.set(CACHE_COOKIE_NAME, cacheValue, {
    path: '/',
    maxAge: CACHE_TTL_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
  })

  if (!isActive && isProtected) {
    return redirect('/pending')
  }

  if (isActive && (isPendingPage || isAuthPage)) {
    const dest = role === 'admin' ? '/admin/dashboard' : role === 'treasurer' ? '/treasurer' : '/resident/dashboard'
    return redirect(dest)
  }

  if (pathname === '/dashboard') {
    const dest = role === 'admin' ? '/admin/dashboard' : role === 'treasurer' ? '/treasurer' : '/resident/dashboard'
    return redirect(dest)
  }

  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/users')
  const isResidentPath = pathname.startsWith('/resident')
  const isTreasurerPath = pathname.startsWith('/treasurer')

  if (isAdminPath && role !== 'admin') {
    return redirect(role === 'treasurer' ? '/treasurer' : '/resident/dashboard')
  }
  if (isResidentPath && role !== 'resident') {
    return redirect(role === 'admin' ? '/admin/dashboard' : '/treasurer')
  }
  if (isTreasurerPath && role !== 'treasurer') {
    return redirect(role === 'admin' ? '/admin/dashboard' : '/resident/dashboard')
  }

  return supabaseResponse
}

export const middleware = proxy
export default proxy

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
  ],
}
