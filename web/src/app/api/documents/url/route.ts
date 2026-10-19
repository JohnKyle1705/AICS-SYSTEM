import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/treasury'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getAuthUser(request: Request, bodyUserId?: string) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (user) return user
  } catch (err) {
    console.warn('Could not extract user from cookies:', err)
  }

  // Fallback to Bearer token if provided in header
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (user) return user
  }

  // Fallback if userId passed and exists in profiles
  if (bodyUserId) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', bodyUserId)
      .single()
    if (profile) return { id: profile.id }
  }

  return null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { filePath, userId } = body

    if (!filePath) {
      return NextResponse.json({ ok: false, error: 'filePath is required' }, { status: 400 })
    }

    const user = await getAuthUser(request, userId)
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized: User authentication required' }, { status: 401 })
    }

    // Generate signed URL with 1-hour expiration
    const { data, error } = await supabaseAdmin.storage
      .from('documents')
      .createSignedUrl(filePath, 3600)

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { ok: false, error: error?.message || 'File not found in documents storage' },
        { status: 404 }
      )
    }

    return NextResponse.json({ ok: true, signedUrl: data.signedUrl, url: data.signedUrl })
  } catch (err: any) {
    console.error('Document signed URL error:', err)
    return NextResponse.json({ ok: false, error: err.message || 'Server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')
    const userId = searchParams.get('userId')

    if (!filePath) {
      return NextResponse.json({ ok: false, error: 'path query parameter is required' }, { status: 400 })
    }

    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath
    const user = await getAuthUser(request, userId || undefined)
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized: User authentication required' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin.storage
      .from('documents')
      .createSignedUrl(cleanPath, 3600)

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { ok: false, error: error?.message || 'File not found in storage' },
        { status: 404 }
      )
    }

    // If download parameter is requested, redirect directly
    if (searchParams.get('redirect') === '1') {
      return NextResponse.redirect(data.signedUrl)
    }

    return NextResponse.json({ ok: true, signedUrl: data.signedUrl, url: data.signedUrl })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Server error' }, { status: 500 })
  }
}
