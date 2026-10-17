import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type') // 'recovery' for password reset, 'signup' for email verify
  const next = searchParams.get('next')
  const error = searchParams.get('error')
  const error_description = searchParams.get('error_description')

  // If Supabase returned an error in the callback URL (e.g. otp_expired, link already used)
  if (error) {
    const errorMsg = error_description || error || 'Authentication failed'
    if (type === 'recovery' || next?.includes('reset-password')) {
      return NextResponse.redirect(
        new URL(`/forgot-password?error=${encodeURIComponent(errorMsg)}`, origin)
      )
    }
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMsg)}`, origin)
    )
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignored in Server Components
            }
          },
        },
      }
    )

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError && data.user) {
      // ── Password Reset flow ──────────────────────────────────
      if (type === 'recovery' || next === '/auth/reset-password' || next?.includes('reset-password')) {
        return NextResponse.redirect(new URL('/auth/reset-password', origin))
      }

      // ── Email Verification / Sign-up flow ────────────────────
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single()

      if (!existingProfile) {
        // Create profile for the newly verified user
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: data.user.user_metadata?.full_name || '',
          role: 'resident',
          is_active: false,
        })
      }

      // Redirect to pending page (account needs admin activation)
      return NextResponse.redirect(new URL('/pending', origin))
    }

    if (exchangeError) {
      if (type === 'recovery' || next?.includes('reset-password')) {
        return NextResponse.redirect(
          new URL(`/forgot-password?error=${encodeURIComponent(exchangeError.message)}`, origin)
        )
      }
    }
  }

  // If code is missing or exchange failed, redirect to login with error
  return NextResponse.redirect(
    new URL('/login?error=verification_failed', origin)
  )
}
