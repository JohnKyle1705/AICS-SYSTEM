import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null // 'recovery' for password reset, 'signup' for email verify
  const next = searchParams.get('next')
  const error = searchParams.get('error')
  const error_description = searchParams.get('error_description')

  // If Supabase returned an error in the callback URL (e.g. otp_expired, link already used)
  if (error) {
    const errorMsg = error_description || error || 'Authentication link is invalid or expired'
    if (type === 'recovery' || next?.includes('reset-password')) {
      return NextResponse.redirect(
        new URL(`/forgot-password?error=${encodeURIComponent(errorMsg)}`, origin)
      )
    }
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMsg)}`, origin)
    )
  }

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

  let authSuccess = false
  let authUser: any = null

  // 1. If PKCE code is provided in query params
  if (code) {
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError && data.user) {
      authSuccess = true
      authUser = data.user
    }
  }

  // 2. If token_hash is provided in query params (standard Supabase email template link)
  if (!authSuccess && token_hash) {
    const otpType: EmailOtpType = type || (next?.includes('reset-password') ? 'recovery' : 'email')
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash,
      type: otpType,
    })
    if (!verifyError && data.user) {
      authSuccess = true
      authUser = data.user
    }
  }

  if (authSuccess && authUser) {
    // ── Password Reset flow: direct to reset-password page ──
    if (type === 'recovery' || next === '/auth/reset-password' || next?.includes('reset-password')) {
      return NextResponse.redirect(new URL('/auth/reset-password', origin))
    }

    // ── Email Verification / Sign-up flow ────────────────────
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authUser.id)
      .single()

    if (!existingProfile) {
      await supabase.from('profiles').insert({
        id: authUser.id,
        full_name: authUser.user_metadata?.full_name || '',
        role: 'resident',
        is_active: false,
      })
    }

    // Redirect to pending page (account needs admin activation)
    return NextResponse.redirect(new URL('/pending', origin))
  }

  // If recovery flow failed, return to forgot password with an informative message
  if (type === 'recovery' || next?.includes('reset-password')) {
    return NextResponse.redirect(
      new URL('/forgot-password?error=Your+reset+link+has+expired+or+already+been+used.+Please+request+a+new+one.', origin)
    )
  }

  // If code / token_hash is missing or exchange failed, redirect to login with error
  return NextResponse.redirect(
    new URL('/login?error=verification_failed', origin)
  )
}
