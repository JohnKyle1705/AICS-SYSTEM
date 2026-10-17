import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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

  // Attempt to get the user — if the refresh token is invalid/stale,
  // getUser() returns an error and user is null. We catch & handle it
  // so stale cookies get cleared instead of causing client-side crashes.
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  // If there's an auth error (e.g. invalid refresh token), actively clear
  // all Supabase auth cookies so the browser doesn't keep retrying.
  if (authError) {
    request.cookies.getAll().forEach((cookie) => {
      if (cookie.name.startsWith('sb-')) {
        supabaseResponse.cookies.set({
          name: cookie.name,
          value: '',
          path: '/',
          expires: new Date(0),
          maxAge: 0,
        })
      }
    })
  }

  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/forgot-password')
  const isResetPasswordPage = pathname.startsWith('/auth/reset-password')
  const isPendingPage = pathname.startsWith('/pending')
  const isAuthCallback = pathname.startsWith('/auth/callback')
  const isPublicPage = isAuthPage || isResetPasswordPage || isPendingPage || isAuthCallback || pathname === '/'
  const isProtected = !isPublicPage

  // Helper to redirect and preserve Supabase cookies (such as refreshed or deleted session tokens)
  const redirect = (path: string) => {
    const redirectResponse = NextResponse.redirect(new URL(path, request.url))
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })
    return redirectResponse
  }

  if (!user && isProtected) {
    return redirect('/login')
  }

  if (user) {
    // If the user is resetting their password, always allow access to the reset page
    if (isResetPasswordPage) {
      return supabaseResponse
    }

    let { data: p } = await supabase.from('profiles').select('is_active, role').eq('id', user.id).single()
    
    // If profile doesn't exist yet (e.g. email verification callback didn't create it),
    // auto-create a default resident profile so the user isn't stuck in a loop.
    if (!p) {
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || '',
        role: 'resident',
        is_active: false,
      }, { onConflict: 'id', ignoreDuplicates: true })
      // Fetch the newly created profile
      const { data: newP } = await supabase.from('profiles').select('is_active, role').eq('id', user.id).single()
      p = newP
    }

    const isActive = p?.is_active === true
    const role = p?.role

    if (!isActive && isProtected) {
      return redirect('/pending')
    }

    if (isActive && (isPendingPage || isAuthPage)) {
      return redirect('/dashboard')
    }

    // Role-based Path Protection
    const isAdminPath = request.nextUrl.pathname.startsWith('/admin') ||
      request.nextUrl.pathname.startsWith('/users')
    const isResidentPath = request.nextUrl.pathname.startsWith('/resident')
    const isTreasurerPath = request.nextUrl.pathname.startsWith('/treasurer')

    if (isAdminPath && role !== 'admin') {
      return redirect('/dashboard')
    }
    if (isResidentPath && role !== 'resident') {
      return redirect('/dashboard')
    }
    if (isTreasurerPath && role !== 'treasurer') {
      return redirect('/dashboard')
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
