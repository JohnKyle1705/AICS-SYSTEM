import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  const { email, password, full_name, role } = await request.json()

  if (!email || !password || !full_name || !role) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: data.user.id,
    full_name,
    role,
  })

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
  }

  // Hard delete from Supabase Auth (this automatically cascades to profiles if FK is configured,
  // but we should delete from profiles explicitly just in case).
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Explicitly delete from profiles if no cascade
  await supabaseAdmin.from('profiles').delete().eq('id', id)

  return NextResponse.json({ success: true })
}
