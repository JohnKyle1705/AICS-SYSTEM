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

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register')
  const isPendingPage = request.nextUrl.pathname.startsWith('/pending')
  const isProtected = !isAuthPage && !isPendingPage && request.nextUrl.pathname !== '/'

  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    const { data: p } = await supabase.from('profiles').select('is_active, role').eq('id', user.id).single()
    const isActive = p?.is_active === true
    const role = p?.role

    if (!isActive && isProtected) {
      return NextResponse.redirect(new URL('/pending', request.url))
    }

    if (isActive && (isPendingPage || isAuthPage)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Role-based Path Protection
    const isAdminPath = request.nextUrl.pathname.startsWith('/admin')
    const isStaffPath = request.nextUrl.pathname.startsWith('/staff')
    const isResidentPath = request.nextUrl.pathname.startsWith('/resident')

    if (isAdminPath && role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (isStaffPath && role !== 'staff' && role !== 'encoder' && role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (isResidentPath && role !== 'resident') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
