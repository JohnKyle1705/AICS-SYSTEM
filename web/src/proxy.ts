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

// Safely extract JWT sub (user ID) from request cookies without full DB roundtrip
function getUserIdFromRequestCookies(request: NextRequest): string | null {
  const allCookies = request.cookies.getAll()
  const authChunks = allCookies
    .filter((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
    .sort((a, b) => a.name.localeCompare(b.name))

  if (authChunks.length === 0) return null

  try {
    let raw = authChunks.map((c) => c.value).join('')
    if (raw.startsWith('base64-')) {
      raw = atob(raw.slice(7))
    }
    const parsed = JSON.parse(raw)
    const token = Array.isArray(parsed) ? parsed[0] : (parsed.access_token || parsed)
    if (typeof token === 'string' && token.includes('.')) {
      const payloadBase64 = token.split('.')[1]
      const decoded = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'))
      const payload = JSON.parse(decoded)
      return payload.sub || null
    }
  } catch {
    return null
  }
  return null
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const pathname = request.nextUrl.pathname

  // Pass API routes directly through without auth redirection
  if (pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/forgot-password')
  const isResetPasswordPage = pathname.startsWith('/auth/reset-password')
  const isPendingPage = pathname.startsWith('/pending')
  const isAuthCallback = pathname.startsWith('/auth/callback')
  const isPublicPage = isAuthPage || isResetPasswordPage || isPendingPage || isAuthCallback || pathname === '/'
  const isProtected = !isPublicPage

  const allCookies = request.cookies.getAll()
  const hostname = request.nextUrl.hostname

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
          httpOnly: true,
          sameSite: 'lax',
        })
        res.cookies.delete(cookie.name)

        if (hostname && hostname !== 'localhost') {
          res.cookies.set({
            name: cookie.name,
            value: '',
            path: '/',
            domain: hostname,
            expires: new Date(0),
            maxAge: 0,
            httpOnly: true,
            sameSite: 'lax',
          })
          res.cookies.set({
            name: cookie.name,
            value: '',
            path: '/',
            domain: `.${hostname}`,
            expires: new Date(0),
            maxAge: 0,
            httpOnly: true,
            sameSite: 'lax',
          })
        }
      }
    })
  }

  // Explicit logout flag in URL: immediately purge cookies and ensure landing on /login
  if (request.nextUrl.searchParams.has('logout')) {
    if (pathname !== '/login') {
      const redirectResponse = NextResponse.redirect(new URL('/login?logout=true', request.url))
      clearAuthCookies(redirectResponse)
      return redirectResponse
    }
    clearAuthCookies(supabaseResponse)
    return supabaseResponse
  }

  // Check if any genuine Supabase auth token cookies exist
  const hasAuthTokenCookie = allCookies.some((c) =>
    c.name.startsWith('sb-') &&
    c.name.includes('-auth-token') &&
    c.value &&
    c.value !== '""' &&
    c.value !== '[]' &&
    c.value !== 'base64-W10=' &&
    c.value.trim() !== ''
  )

  // Fast-path: If user has no auth cookie at all
  if (!hasAuthTokenCookie) {
    clearAuthCookies(supabaseResponse)
    if (isProtected) {
      // Use ?logout=true so the proxy clears the cache cookie on the /login page too
      const redirectResponse = NextResponse.redirect(new URL('/login?logout=true', request.url))
      clearAuthCookies(redirectResponse)
      return redirectResponse
    }
    return supabaseResponse
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
  const currentTokenUserId = getUserIdFromRequestCookies(request)
  const cached = await verifyCacheCookie(request.cookies.get(CACHE_COOKIE_NAME)?.value)

  // Only use fast-path if cached profile strictly matches the active token user ID
  if (cached && currentTokenUserId && cached.userId === currentTokenUserId) {
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
      return redirect('/login?logout=true', true)
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
