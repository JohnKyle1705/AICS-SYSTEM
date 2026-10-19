import { NextResponse } from 'next/server'
import { supabaseAdmin, getTreasuryStats } from '@/lib/treasury'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'summary'

    if (type === 'summary') {
      const stats = await getTreasuryStats()
      return NextResponse.json({ ok: true, stats })
    }

    if (type === 'transactions') {
      const { data, error } = await supabaseAdmin
        .from('fund_transactions')
        .select('*, funds(assistance_type), profiles(full_name), requests(id, assistance_type, amount_approved, beneficiaries(first_name, last_name, barangay))')
        .order('created_at', { ascending: false })

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, transactions: data || [] })
    }

    if (type === 'requests') {
      const statusFilter = searchParams.get('status')
      let query = supabaseAdmin
        .from('requests')
        .select('*, beneficiaries(*), profiles:encoded_by(full_name), approver:approved_by(full_name)')
        .in('status', ['Approved', 'Released'])
        .order('created_at', { ascending: false })

      if (statusFilter && statusFilter !== 'All') {
        if (['Pending Release', 'Ready for Release'].includes(statusFilter)) {
          query = query.eq('status', 'Approved').eq('release_status', statusFilter)
        } else if (statusFilter === 'Released') {
          query = query.eq('status', 'Released')
        }
      }

      const { data, error } = await query
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, requests: data || [] })
    }

    return NextResponse.json({ ok: false, error: 'Unknown query type' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const action = body.action
    const payload = body.payload || body
    let userId = body.userId

    if (!userId) {
      try {
        const { createServerClient } = await import('@supabase/ssr')
        const { cookies } = await import('next/headers')
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
        if (user) userId = user.id
      } catch (authErr) {
        console.warn('Could not extract user from cookies:', authErr)
      }
    }

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized: Missing user identifier' }, { status: 401 })
    }

    // Verify caller role from profiles
    const { data: caller } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('id', userId)
      .single()

    if (!caller || !caller.is_active || !['admin', 'treasurer'].includes(caller.role)) {
      return NextResponse.json({ ok: false, error: 'Forbidden: Treasurer or Admin role required' }, { status: 403 })
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 1. CONFIRM READINESS / PROCESS VOUCHER (Treasurer verifies readiness for release)
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'confirm_readiness' || action === 'mark_ready' || action === 'process_voucher') {
      const { requestId, voucherNo, remarks, notes } = payload
      if (!requestId) return NextResponse.json({ ok: false, error: 'Request ID is required' }, { status: 400 })

      const { data: req, error: reqErr } = await supabaseAdmin
        .from('requests')
        .select('*, beneficiaries(first_name, last_name)')
        .eq('id', requestId)
        .single()

      if (reqErr || !req) {
        return NextResponse.json({ ok: false, error: 'Request not found' }, { status: 404 })
      }

      if (req.status !== 'Approved') {
        return NextResponse.json({ ok: false, error: `Only approved requests can be confirmed for release (current status: ${req.status})` }, { status: 400 })
      }

      if (!req.amount_approved || Number(req.amount_approved) <= 0) {
        return NextResponse.json({ ok: false, error: 'Request approved amount must be greater than ₱0' }, { status: 400 })
      }

      // Check fund liquidity
      const { data: fund } = await supabaseAdmin
        .from('funds')
        .select('*')
        .eq('assistance_type', req.assistance_type)
        .single()

      if (!fund) {
        return NextResponse.json({ ok: false, error: `Fund for ${req.assistance_type} not initialized` }, { status: 400 })
      }

      if (Number(fund.current_balance) < Number(req.amount_approved)) {
        // Log insufficient balance and alert
        await supabaseAdmin.from('notifications').insert({
          user_id: caller.id,
          title: 'Insufficient Funds Warning',
          message: `Cannot confirm readiness for ${req.beneficiaries?.first_name} ${req.beneficiaries?.last_name}: Available balance (₱${Number(fund.current_balance).toLocaleString()}) is less than approved amount (₱${Number(req.amount_approved).toLocaleString()}).`,
          type: 'incomplete',
          request_id: req.id,
        })
        return NextResponse.json({
          ok: false,
          error: `Insufficient funds in ${req.assistance_type} Assistance. Available: ₱${Number(fund.current_balance).toLocaleString()}, Required: ₱${Number(req.amount_approved).toLocaleString()}`,
        }, { status: 400 })
      }

      // Build updated remarks if notes provided
      const customNote = notes?.trim() || remarks?.trim() || ''
      const updatedRemarks = customNote
        ? `${req.remarks ? req.remarks + ' | ' : ''}Treasurer Confirmed: ${customNote}`
        : (voucherNo ? `${req.remarks ? req.remarks + ' | ' : ''}Voucher: ${voucherNo.trim()}` : req.remarks)

      // Update request to Ready for Release
      const { error: updErr } = await supabaseAdmin
        .from('requests')
        .update({
          release_status: 'Ready for Release',
          remarks: updatedRemarks,
          ...(voucherNo ? { voucher_number: voucherNo.trim() } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 })

      // Audit log
      await supabaseAdmin.from('system_logs').insert({
        user_id: caller.id,
        action: action === 'process_voucher' ? 'TREASURY_PROCESS_VOUCHER' : 'TREASURY_CONFIRM_READINESS',
        table_name: 'requests',
        record_id: requestId,
        details: {
          voucher_no: voucherNo?.trim() || null,
          notes: customNote || null,
          amount: Number(req.amount_approved),
          assistance_type: req.assistance_type,
          previous_release_status: req.release_status || 'Pending Release',
          new_release_status: 'Ready for Release',
        },
      })

      // Notify Admins that request is ready for official release
      const { data: admins } = await supabaseAdmin.from('profiles').select('id').eq('role', 'admin')
      if (admins && admins.length > 0) {
        const benName = req.beneficiaries ? `${req.beneficiaries.first_name} ${req.beneficiaries.last_name}` : 'Beneficiary'
        await supabaseAdmin.from('notifications').insert(
          admins.map((a: any) => ({
            user_id: a.id,
            title: 'Ready for Release Confirmation',
            message: `Treasurer ${caller.full_name} confirmed readiness for ${benName} (₱${Number(req.amount_approved).toLocaleString()}). Ready for official release.`,
            type: 'info',
            request_id: requestId,
          }))
        )
      }

      return NextResponse.json({ ok: true, message: 'Request readiness confirmed. Status is now Ready for Release.' })
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. RETURN REQUEST (Treasurer returns request to Admin with correction notes)
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'return_request') {
      const { requestId, reason } = payload
      if (!requestId) return NextResponse.json({ ok: false, error: 'Request ID is required' }, { status: 400 })
      if (!reason || !reason.trim()) {
        return NextResponse.json({ ok: false, error: 'A reason for returning the request is required' }, { status: 400 })
      }

      const { data: req } = await supabaseAdmin
        .from('requests')
        .select('*, beneficiaries(first_name, last_name)')
        .eq('id', requestId)
        .single()

      if (!req) return NextResponse.json({ ok: false, error: 'Request not found' }, { status: 404 })

      await supabaseAdmin
        .from('requests')
        .update({
          release_status: 'Pending Release',
          remarks: `${req.remarks ? req.remarks + ' | ' : ''}Returned by Treasurer: ${reason.trim()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      await supabaseAdmin.from('system_logs').insert({
        user_id: caller.id,
        action: 'TREASURY_RETURN_REQUEST',
        table_name: 'requests',
        record_id: requestId,
        details: { reason: reason.trim() },
      })

      // Notify Admins
      const { data: admins } = await supabaseAdmin.from('profiles').select('id').eq('role', 'admin')
      if (admins && admins.length > 0) {
        const benName = req.beneficiaries ? `${req.beneficiaries.first_name} ${req.beneficiaries.last_name}` : 'Beneficiary'
        await supabaseAdmin.from('notifications').insert(
          admins.map((a: any) => ({
            user_id: a.id,
            title: 'Financial Review / Correction Required',
            message: `Treasurer ${caller.full_name} returned request for ${benName}: "${reason.trim()}".`,
            type: 'incomplete',
            request_id: requestId,
          }))
        )
      }

      return NextResponse.json({ ok: true, message: 'Request returned to Admin with notes.' })
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. CONFIRM OFFICIAL RELEASE (Admin disburses & deducts fund balance)
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'confirm_release') {
      if (caller.role !== 'admin') {
        return NextResponse.json({
          ok: false,
          error: 'Unauthorized: Only an authorized Admin can officially record assistance release to the beneficiary.',
        }, { status: 403 })
      }

      const { requestId, releaseDate, notes } = payload
      if (!requestId) return NextResponse.json({ ok: false, error: 'Request ID is required' }, { status: 400 })

      const { data: req } = await supabaseAdmin
        .from('requests')
        .select('*, beneficiaries(first_name, last_name)')
        .eq('id', requestId)
        .single()

      if (!req) return NextResponse.json({ ok: false, error: 'Request not found' }, { status: 404 })

      if (req.status === 'Released') {
        return NextResponse.json({ ok: false, error: 'This request has already been released' }, { status: 400 })
      }

      if (req.status !== 'Approved') {
        return NextResponse.json({ ok: false, error: 'Only approved requests can be released' }, { status: 400 })
      }

      const releaseAmt = Number(req.amount_approved)
      if (isNaN(releaseAmt) || releaseAmt <= 0) {
        return NextResponse.json({ ok: false, error: 'Approved amount must be greater than ₱0' }, { status: 400 })
      }

      // Check fund balance
      const { data: fund } = await supabaseAdmin
        .from('funds')
        .select('*')
        .eq('assistance_type', req.assistance_type)
        .single()

      if (!fund) {
        return NextResponse.json({ ok: false, error: `Fund record for ${req.assistance_type} not found` }, { status: 404 })
      }

      if (Number(fund.current_balance) < releaseAmt) {
        return NextResponse.json({
          ok: false,
          error: `Insufficient fund balance. Available: ₱${Number(fund.current_balance).toLocaleString()}, Required: ₱${releaseAmt.toLocaleString()}`,
        }, { status: 400 })
      }

      // Check for duplicate completed payout
      const { data: existingPayout } = await supabaseAdmin
        .from('payouts')
        .select('id')
        .eq('request_id', requestId)
        .maybeSingle()

      if (existingPayout) {
        return NextResponse.json({ ok: false, error: 'A payout record already exists for this request' }, { status: 400 })
      }

      const newCurrentBalance = Number(fund.current_balance) - releaseAmt
      const newTotalReleased = Number(fund.total_released) + releaseAmt
      const effectiveDate = releaseDate || new Date().toISOString().split('T')[0]

      // 1. Update fund balances
      await supabaseAdmin
        .from('funds')
        .update({
          current_balance: newCurrentBalance,
          total_released: newTotalReleased,
          updated_at: new Date().toISOString(),
          updated_by: caller.id,
        })
        .eq('id', fund.id)

      // 2. Insert fund_transactions ledger record
      const benName = req.beneficiaries ? `${req.beneficiaries.first_name} ${req.beneficiaries.last_name}` : 'Beneficiary'
      const { data: newTx } = await supabaseAdmin
        .from('fund_transactions')
        .insert({
          fund_id: fund.id,
          transaction_type: 'Release',
          amount: releaseAmt,
          balance_after: newCurrentBalance,
          request_id: requestId,
          remarks: notes || `Assistance release for ${benName} (${req.assistance_type})`,
          processed_by: caller.id,
        })
        .select('id')
        .single()

      // 3. Insert payout record
      await supabaseAdmin.from('payouts').insert({
        request_id: requestId,
        amount_released: releaseAmt,
        release_date: effectiveDate,
        released_by: caller.id,
        acknowledgment_notes: notes || 'Assistance released via Treasury workflow',
      })

      // 4. Update request status to Released
      await supabaseAdmin
        .from('requests')
        .update({
          status: 'Released',
          release_status: 'Released',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      // 5. Audit log
      await supabaseAdmin.from('system_logs').insert({
        user_id: caller.id,
        action: 'RELEASE_FUNDS',
        table_name: 'requests',
        record_id: requestId,
        details: {
          amount: releaseAmt,
          fund: req.assistance_type,
          fund_transaction_id: newTx?.id,
          balance_after: newCurrentBalance,
        },
      })

      // 6. Notify Resident & Treasurers with official confirmation message
      if (req.encoded_by) {
        await supabaseAdmin.from('notifications').insert({
          user_id: req.encoded_by,
          title: 'Assistance Given to Beneficiary',
          message: `This assistance has been given to the beneficiary (${benName} – ₱${releaseAmt.toLocaleString()}).`,
          type: 'info',
          request_id: requestId,
        })
      }

      const { data: treasurers } = await supabaseAdmin.from('profiles').select('id').eq('role', 'treasurer')
      if (treasurers && treasurers.length > 0) {
        await supabaseAdmin.from('notifications').insert(
          treasurers.map((t: any) => ({
            user_id: t.id,
            title: 'Assistance Released',
            message: `This assistance has been given to the beneficiary (${benName} – ₱${releaseAmt.toLocaleString()}).`,
            type: 'info',
            request_id: requestId,
          }))
        )
      }

      // 7. Low balance threshold alert
      if (newCurrentBalance <= Number(fund.low_balance_threshold)) {
        const { data: staff } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .in('role', ['admin', 'treasurer'])
        if (staff) {
          await supabaseAdmin.from('notifications').insert(
            staff.map((s: any) => ({
              user_id: s.id,
              title: `Low Balance Alert: ${req.assistance_type} Fund`,
              message: `Available balance for ${req.assistance_type} assistance is now ₱${newCurrentBalance.toLocaleString()}, which is below the threshold of ₱${Number(fund.low_balance_threshold).toLocaleString()}.`,
              type: 'incomplete',
            }))
          )
        }
      }

      return NextResponse.json({ ok: true, message: 'Assistance officially released and fund deducted.' })
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. RECORD FUND TRANSACTION (Allocation, Funds Received, Adjustment)
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'record_fund_transaction') {
      const { assistanceType, transactionType, amount, remarks } = payload
      const numAmount = parseFloat(amount)
      if (isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json({ ok: false, error: 'Please enter a valid amount greater than ₱0' }, { status: 400 })
      }

      const { data: fund } = await supabaseAdmin
        .from('funds')
        .select('*')
        .eq('assistance_type', assistanceType)
        .single()

      if (!fund) return NextResponse.json({ ok: false, error: 'Fund not found' }, { status: 404 })

      let newBalance = Number(fund.current_balance)
      let newTotalAllocated = Number(fund.total_allocated)

      if (transactionType === 'Allocation' || transactionType === 'Opening Balance') {
        newBalance += numAmount
        newTotalAllocated += numAmount
      } else if (transactionType === 'Adjustment') {
        // Adjustments deduct or correct; check balance
        newBalance -= numAmount
        newTotalAllocated -= numAmount
        if (newBalance < 0) {
          return NextResponse.json({ ok: false, error: 'Adjustment would result in a negative fund balance' }, { status: 400 })
        }
      }

      // Update fund
      await supabaseAdmin
        .from('funds')
        .update({
          current_balance: newBalance,
          total_allocated: newTotalAllocated,
          updated_at: new Date().toISOString(),
          updated_by: caller.id,
        })
        .eq('id', fund.id)

      // Insert transaction ledger entry
      const { data: newTx, error: txErr } = await supabaseAdmin
        .from('fund_transactions')
        .insert({
          fund_id: fund.id,
          transaction_type: transactionType,
          amount: numAmount,
          balance_after: newBalance,
          remarks: remarks || `Manual ${transactionType} by ${caller.full_name}`,
          processed_by: caller.id,
        })
        .select('id')
        .single()

      if (txErr) return NextResponse.json({ ok: false, error: txErr.message }, { status: 400 })

      // Audit log
      await supabaseAdmin.from('system_logs').insert({
        user_id: caller.id,
        action: 'FUND_TRANSACTION_RECORDED',
        table_name: 'fund_transactions',
        record_id: newTx?.id,
        details: {
          type: transactionType,
          amount: numAmount,
          fund: assistanceType,
          balance_after: newBalance,
        },
      })

      return NextResponse.json({ ok: true, message: `${transactionType} recorded successfully.` })
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. REVERSE FUND TRANSACTION (Authorized correction)
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'reverse_transaction') {
      const { transactionId, reason } = payload
      if (!transactionId) return NextResponse.json({ ok: false, error: 'Transaction ID is required' }, { status: 400 })
      if (!reason || !reason.trim()) {
        return NextResponse.json({ ok: false, error: 'Reversal reason is required' }, { status: 400 })
      }

      const { data: tx } = await supabaseAdmin
        .from('fund_transactions')
        .select('*, funds(*)')
        .eq('id', transactionId)
        .single()

      if (!tx) return NextResponse.json({ ok: false, error: 'Transaction not found' }, { status: 404 })

      const fund = tx.funds
      let newBalance = Number(fund.current_balance)
      let newTotalReleased = Number(fund.total_released)
      let newTotalAllocated = Number(fund.total_allocated)

      if (tx.transaction_type === 'Release') {
        // Reversing a release restores the funds
        newBalance += Number(tx.amount)
        newTotalReleased = Math.max(0, newTotalReleased - Number(tx.amount))

        // Update request back to Approved
        if (tx.request_id) {
          await supabaseAdmin
            .from('requests')
            .update({
              status: 'Approved',
              release_status: 'Pending Release',
              updated_at: new Date().toISOString(),
            })
            .eq('id', tx.request_id)

          // Delete payout record so request can be cleanly re-processed
          await supabaseAdmin.from('payouts').delete().eq('request_id', tx.request_id)
        }
      } else if (tx.transaction_type === 'Allocation') {
        newBalance -= Number(tx.amount)
        newTotalAllocated -= Number(tx.amount)
        if (newBalance < 0) {
          return NextResponse.json({ ok: false, error: 'Cannot reverse allocation: funds already disbursed' }, { status: 400 })
        }
      }

      // Update fund
      await supabaseAdmin
        .from('funds')
        .update({
          current_balance: newBalance,
          total_released: newTotalReleased,
          total_allocated: newTotalAllocated,
          updated_at: new Date().toISOString(),
          updated_by: caller.id,
        })
        .eq('id', fund.id)

      // Insert reversing transaction ledger record
      await supabaseAdmin.from('fund_transactions').insert({
        fund_id: fund.id,
        transaction_type: 'Adjustment',
        amount: Number(tx.amount),
        balance_after: newBalance,
        request_id: tx.request_id,
        remarks: `Reversal of ${tx.transaction_type} (ID: ${tx.id.slice(0, 8)}): ${reason.trim()}`,
        processed_by: caller.id,
      })

      // Audit log
      await supabaseAdmin.from('system_logs').insert({
        user_id: caller.id,
        action: 'FUND_TRANSACTION_REVERSED',
        table_name: 'fund_transactions',
        record_id: transactionId,
        details: {
          original_type: tx.transaction_type,
          amount: Number(tx.amount),
          reason: reason.trim(),
          balance_after: newBalance,
        },
      })

      return NextResponse.json({ ok: true, message: 'Transaction reversed and ledger updated.' })
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
