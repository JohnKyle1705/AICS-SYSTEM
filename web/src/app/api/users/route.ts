import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const group = searchParams.get('group') // 'staff' | 'residents' | null (all)

  // Fetch all auth users to get emails
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers()
  const emailMap: Record<string, string> = {}
  if (authData?.users) {
    authData.users.forEach(u => { emailMap[u.id] = u.email ?? '' })
  }

  if (group === 'staff') {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .in('role', ['admin', 'treasurer'])
      .order('full_name')

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const enriched = (data ?? []).map(p => ({ ...p, email: emailMap[p.id] ?? '' }))
    return NextResponse.json({ staff: enriched })
  }

  if (group === 'residents') {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('role', 'resident')
      .order('full_name')

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Fetch beneficiary contact numbers (keyed by created_by user id)
    const { data: bens } = await supabaseAdmin
      .from('beneficiaries')
      .select('created_by, contact_number, address, barangay, birthdate, civil_status, sex, first_name, last_name')

    const benMap: Record<string, any> = {}
    if (bens) {
      bens.forEach(b => {
        if (b.created_by) benMap[b.created_by] = b
      })
    }

    const enriched = (data ?? []).map(p => ({
      ...p,
      email: emailMap[p.id] ?? '',
      contact_number: benMap[p.id]?.contact_number ?? '',
      beneficiary: benMap[p.id] ?? null,
    }))
    return NextResponse.json({ residents: enriched })
  }

  // Default: return both groups
  const { data: allProfiles, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const staff = (allProfiles ?? [])
    .filter(p => ['admin', 'treasurer'].includes(p.role))
    .map(p => ({ ...p, email: emailMap[p.id] ?? '' }))

  const residents = (allProfiles ?? [])
    .filter(p => p.role === 'resident')
    .map(p => ({ ...p, email: emailMap[p.id] ?? '' }))

  return NextResponse.json({ staff, residents })
}

export async function POST(request: Request) {
  const { email, password, full_name, role } = await request.json()

  if (!email || !password || !full_name || !role) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  // Staff creation only — residents must sign up through the registration flow
  if (!['admin', 'treasurer'].includes(role)) {
    return NextResponse.json(
      { error: 'Only Administrator and Treasurer accounts can be created manually. Residents must register through the sign-up system.' },
      { status: 403 }
    )
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
    is_active: true,
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

  // Hard delete from Supabase Auth (cascades to profiles if FK is configured,
  // but we delete from profiles explicitly just in case).
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Explicitly delete from profiles if no cascade
  await supabaseAdmin.from('profiles').delete().eq('id', id)

  return NextResponse.json({ success: true })
}

export async function PATCH(request: Request) {
  const { id, role, is_active } = await request.json()

  if (!id) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
  }

  // If changing role, only allow staff roles (admin <-> treasurer).
  // Residents cannot be promoted to staff, and staff cannot be demoted to resident here.
  if (role !== undefined && !['admin', 'treasurer'].includes(role)) {
    return NextResponse.json(
      { error: 'Role can only be changed between Administrator and Treasurer.' },
      { status: 403 }
    )
  }

  const updates: any = {}
  if (role !== undefined) updates.role = role
  if (is_active !== undefined) updates.is_active = is_active

  const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
