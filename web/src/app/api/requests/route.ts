import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/treasury'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Helper: get the calling user from the session cookie */
async function getCallerProfile() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', user.id)
      .single()
    return profile
  } catch {
    return null
  }
}

/** Shared audit-log helper */
async function auditLog(
  userId: string,
  action: string,
  recordId: string,
  details: Record<string, unknown>
) {
  await supabaseAdmin.from('system_logs').insert({
    user_id: userId,
    action,
    table_name: 'requests',
    record_id: recordId,
    details,
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, requestId } = body

    if (!requestId) {
      return NextResponse.json({ ok: false, error: 'Request ID is required' }, { status: 400 })
    }

    const caller = await getCallerProfile()
    if (!caller) {
      return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })
    }

    // ─────────────────────────────────────────────────────────────────────
    // APPROVE REQUEST
    // ─────────────────────────────────────────────────────────────────────
    if (action === 'approve') {
      if (caller.role !== 'admin') {
        return NextResponse.json({ ok: false, error: 'Only Admin can approve requests' }, { status: 403 })
      }

      const { amountApproved, remarks } = body
      const numAmt = parseFloat(amountApproved)
      if (isNaN(numAmt) || numAmt <= 0) {
        return NextResponse.json({ ok: false, error: 'A valid approved amount greater than ₱0 is required' }, { status: 400 })
      }

      // Fetch request & verify state
      const { data: req } = await supabaseAdmin
        .from('requests')
        .select('*, beneficiaries(first_name, last_name)')
        .eq('id', requestId)
        .single()

      if (!req) {
        return NextResponse.json({ ok: false, error: 'Request not found' }, { status: 404 })
      }
      if (req.status !== 'Pending') {
        return NextResponse.json({ ok: false, error: `Request is already ${req.status}. Only Pending requests can be approved.` }, { status: 409 })
      }

      // ── ASSESSMENT GATE (backend enforcement) ──────────────────────────
      const { data: assessment } = await supabaseAdmin
        .from('assessments')
        .select('id, assessed_by, assessment_status')
        .eq('request_id', requestId)
        .eq('assessment_status', 'submitted')
        .maybeSingle()

      if (!assessment) {
        // Audit the blocked attempt
        await auditLog(caller.id, 'APPROVE_BLOCKED_NO_ASSESSMENT', requestId, {
          reason: 'Assessment missing',
          attempted_by: caller.full_name,
          role: caller.role,
        })
        return NextResponse.json(
          { ok: false, error: 'Action blocked — Assessment is required per AICS policy. Complete the assessment before approving.' },
          { status: 422 }
        )
      }

      // Perform the approval
      const { error: updErr } = await supabaseAdmin
        .from('requests')
        .update({
          status: 'Approved',
          release_status: 'Pending Release',
          amount_approved: numAmt,
          approved_by: caller.id,
          remarks: remarks?.trim() || req.remarks || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      if (updErr) throw updErr

      // Audit log — approval
      await auditLog(caller.id, 'APPROVE_REQUEST', requestId, {
        amount_approved: numAmt,
        release_status: 'Pending Release',
        assessment_id: assessment.id,
        approved_by: caller.full_name,
      })

      // Notify Treasurers
      const { data: treasurers } = await supabaseAdmin.from('profiles').select('id').eq('role', 'treasurer')
      const benName = req.beneficiaries
        ? `${req.beneficiaries.first_name} ${req.beneficiaries.last_name}`
        : 'Beneficiary'
      if (treasurers && treasurers.length > 0) {
        await supabaseAdmin.from('notifications').insert(
          treasurers.map((t: { id: string }) => ({
            user_id: t.id,
            title: 'Request Approved — Pending Release',
            message: `Approved request for ${benName} (${req.assistance_type} – ₱${numAmt.toLocaleString()}). Reference: #${requestId.slice(0, 8).toUpperCase()}.`,
            type: 'info',
            request_id: requestId,
          }))
        )
      }

      // Notify Resident
      if (req.encoded_by) {
        await supabaseAdmin.from('notifications').insert({
          user_id: req.encoded_by,
          title: 'Assistance Request Approved',
          message: `Your ${req.assistance_type} assistance request has been approved for ₱${numAmt.toLocaleString()}. Awaiting Treasury release clearance.`,
          type: 'info',
          request_id: requestId,
        })
      }

      return NextResponse.json({ ok: true, message: 'Request approved successfully.' })
    }

    // ─────────────────────────────────────────────────────────────────────
    // DECLINE REQUEST
    // ─────────────────────────────────────────────────────────────────────
    if (action === 'decline') {
      if (caller.role !== 'admin') {
        return NextResponse.json({ ok: false, error: 'Only Admin can decline requests' }, { status: 403 })
      }

      const { reason } = body
      if (!reason || !reason.trim()) {
        return NextResponse.json({ ok: false, error: 'A reason for declining is required' }, { status: 400 })
      }

      const { data: req } = await supabaseAdmin
        .from('requests')
        .select('*, beneficiaries(first_name, last_name)')
        .eq('id', requestId)
        .single()

      if (!req) {
        return NextResponse.json({ ok: false, error: 'Request not found' }, { status: 404 })
      }
      if (req.status !== 'Pending') {
        return NextResponse.json({ ok: false, error: `Request is already ${req.status}. Only Pending requests can be declined.` }, { status: 409 })
      }

      // ── ASSESSMENT GATE (backend enforcement) ──────────────────────────
      const { data: assessment } = await supabaseAdmin
        .from('assessments')
        .select('id, assessed_by, assessment_status')
        .eq('request_id', requestId)
        .eq('assessment_status', 'submitted')
        .maybeSingle()

      if (!assessment) {
        await auditLog(caller.id, 'DECLINE_BLOCKED_NO_ASSESSMENT', requestId, {
          reason: 'Assessment missing',
          attempted_by: caller.full_name,
          role: caller.role,
        })
        return NextResponse.json(
          { ok: false, error: 'Action blocked — Assessment is required per AICS policy. Complete the assessment before declining.' },
          { status: 422 }
        )
      }

      const { error: updErr } = await supabaseAdmin
        .from('requests')
        .update({
          status: 'Declined',
          remarks: `${req.remarks ? req.remarks + ' | ' : ''}Declined: ${reason.trim()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      if (updErr) throw updErr

      await auditLog(caller.id, 'DECLINE_REQUEST', requestId, {
        reason: reason.trim(),
        assessment_id: assessment.id,
        declined_by: caller.full_name,
      })

      // Notify Resident
      if (req.encoded_by) {
        await supabaseAdmin.from('notifications').insert({
          user_id: req.encoded_by,
          title: 'Request Declined',
          message: `Your ${req.assistance_type} assistance request has been declined. Reason: ${reason.trim()}`,
          type: 'pending',
          request_id: requestId,
        })
      }

      return NextResponse.json({ ok: true, message: 'Request declined.' })
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
