'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Loader2, AlertCircle, ArrowLeft, ExternalLink } from 'lucide-react'

const schema = z.object({
  request_id: z.string().min(1, 'Please select a request'),
  amount_released: z.string().min(1, 'Amount released is required'),
  release_date: z.string().min(1, 'Release date is required'),
  acknowledgment_notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

function PayoutForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedId = searchParams.get('request_id')
  const supabase = createClient()

  const [requests, setRequests] = useState<any[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      request_id: preselectedId ?? '',
      amount_released: '',
      release_date: todayStr,
      acknowledgment_notes: '',
    },
  })

  const selectedRequestId = watch('request_id')
  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === selectedRequestId),
    [requests, selectedRequestId]
  )

  useEffect(() => {
    const fetchRequests = async () => {
      setLoadingRequests(true)
      const { data, error: qErr } = await supabase
        .from('requests')
        .select('id, assistance_type, encoded_by, amount_approved, amount_requested, purpose, status, created_at, beneficiaries(first_name, last_name, barangay)')
        .in('status', ['Approved', 'Pending'])
        .order('created_at', { ascending: false })

      if (qErr) {
        console.error('Error fetching requests for payout:', qErr)
      } else if (data) {
        setRequests(data)

        // If preselectedId is in URL, auto-fill form
        if (preselectedId) {
          const matched = data.find((r: any) => r.id === preselectedId)
          if (matched) {
            setValue('request_id', matched.id, { shouldValidate: true })
            if (matched.amount_approved) {
              setValue('amount_released', String(matched.amount_approved), { shouldValidate: true })
            } else if (matched.amount_requested) {
              setValue('amount_released', String(matched.amount_requested), { shouldValidate: true })
            }
          }
        }
      }
      setLoadingRequests(false)
    }

    fetchRequests()
  }, [preselectedId, setValue])

  const handleRequestChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    setValue('request_id', id, { shouldValidate: true })

    const matched = requests.find((r) => r.id === id)
    if (matched) {
      if (matched.amount_approved) {
        setValue('amount_released', String(matched.amount_approved), { shouldValidate: true })
      } else if (matched.amount_requested) {
        setValue('amount_released', String(matched.amount_requested), { shouldValidate: true })
      }
    }
  }

  const approvedList = useMemo(() => requests.filter((r) => r.status === 'Approved'), [requests])
  const pendingList = useMemo(() => requests.filter((r) => r.status === 'Pending'), [requests])

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const amountNum = parseFloat(data.amount_released)

    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid release amount greater than 0.')
      setSaving(false)
      return
    }

    // 1. Insert payout record
    const { error: err, data: newPay } = await supabase.from('payouts').insert({
      request_id: data.request_id,
      amount_released: amountNum,
      release_date: data.release_date,
      acknowledgment_notes: data.acknowledgment_notes || null,
      released_by: user?.id ?? null,
    }).select().single()

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    // 2. Update request status to Released (and auto-approve if was Pending)
    const req = requests.find((r) => r.id === data.request_id)
    const updatePayload: any = {
      status: 'Released',
      release_status: 'Released',
    }
    if (!req?.amount_approved) {
      updatePayload.amount_approved = amountNum
    }
    if (!req?.approved_by && user) {
      updatePayload.approved_by = user.id
    }

    await supabase.from('requests').update(updatePayload).eq('id', data.request_id)

    // 3. System Audit Log
    if (user) {
      await supabase.from('system_logs').insert({
        user_id: user.id,
        action: 'CREATE_PAYOUT',
        table_name: 'payouts',
        record_id: newPay?.id,
        details: {
          request_id: data.request_id,
          amount: amountNum,
          previous_status: req?.status || 'Unknown',
        },
      })
    }

    // 4. Notify Resident
    if (req?.encoded_by) {
      await supabase.from('notifications').insert({
        user_id: req.encoded_by,
        title: 'Assistance Released',
        message: `Your ${req.assistance_type} assistance has been released. Amount: ₱${amountNum.toLocaleString()}`,
        type: 'info',
        request_id: data.request_id,
      })
    }

    router.push('/payouts')
  }

  return (
    <div className="space-y-5 max-w-2xl" id="new-payout-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Record Payout</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">Log assistance release details</p>
        </div>
        <Link href="/payouts" className="btn btn-secondary text-xs flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back to Payouts
        </Link>
      </div>

      {/* Informative Guidance Banner when no approved requests exist */}
      {!loadingRequests && approvedList.length === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-amber-600 dark:text-amber-400">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <div className="text-sm space-y-1">
            <p className="font-semibold">No requests currently marked as &quot;Approved&quot;</p>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Assistance requests are typically assessed and marked as <strong>Approved</strong> before disbursement.
              You can select a <strong>Pending Request</strong> from the dropdown below to approve and release it in one step, or view{' '}
              <Link href="/requests?status=Pending" className="text-blue-600 dark:text-blue-400 font-semibold underline underline-offset-2">
                All Pending Requests
              </Link>{' '}
              to evaluate them first.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="form-label mb-0">Select Assistance Request *</label>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {loadingRequests ? 'Loading requests...' : `${requests.length} eligible request(s)`}
            </span>
          </div>

          <select
            {...register('request_id')}
            onChange={handleRequestChange}
            className="form-input"
            disabled={loadingRequests}
          >
            <option value="">
              {loadingRequests
                ? 'Loading eligible requests...'
                : requests.length === 0
                ? 'No requests available for payout'
                : 'Select a request to disburse funds'}
            </option>

            {approvedList.length > 0 && (
              <optgroup label="✅ Approved Requests (Ready for Release)">
                {approvedList.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.beneficiaries?.last_name}, {r.beneficiaries?.first_name} — {r.assistance_type}
                    {r.amount_approved ? ` (₱${Number(r.amount_approved).toLocaleString()})` : ''}
                    {r.beneficiaries?.barangay ? ` · Brgy. ${r.beneficiaries.barangay}` : ''}
                  </option>
                ))}
              </optgroup>
            )}

            {pendingList.length > 0 && (
              <optgroup label="⏳ Pending Requests (Approve & Disburse)">
                {pendingList.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.beneficiaries?.last_name}, {r.beneficiaries?.first_name} — {r.assistance_type} [Pending]
                    {r.amount_requested ? ` (Req: ₱${Number(r.amount_requested).toLocaleString()})` : ''}
                    {r.beneficiaries?.barangay ? ` · Brgy. ${r.beneficiaries.barangay}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {errors.request_id && <p className="text-red-500 text-xs mt-1">{errors.request_id.message}</p>}
        </div>

        {/* Selected Request Detail Card */}
        {selectedRequest && (
          <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[var(--color-border)]">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Selected Application Details
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  selectedRequest.status === 'Approved'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                }`}
              >
                {selectedRequest.status === 'Approved' ? 'Ready for Release' : 'Pending — Will Auto-Approve'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[var(--color-text-secondary)] block">Beneficiary</span>
                <span className="font-semibold text-[var(--color-text)] text-sm">
                  {selectedRequest.beneficiaries?.first_name} {selectedRequest.beneficiaries?.last_name}
                </span>
                {selectedRequest.beneficiaries?.barangay && (
                  <span className="text-[var(--color-text-secondary)] block text-[11px]">
                    Brgy. {selectedRequest.beneficiaries.barangay}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[var(--color-text-secondary)] block">Assistance Type</span>
                <span className="font-semibold text-[var(--color-text)] text-sm">
                  {selectedRequest.assistance_type} Assistance
                </span>
                <span className="text-blue-500 block text-[11px] font-mono">
                  #{selectedRequest.id.slice(0, 8).toUpperCase()}
                </span>
              </div>

              {selectedRequest.amount_approved && (
                <div>
                  <span className="text-[var(--color-text-secondary)] block">Approved Amount</span>
                  <span className="font-black text-emerald-600 text-sm">
                    ₱{Number(selectedRequest.amount_approved).toLocaleString()}
                  </span>
                </div>
              )}

              {selectedRequest.amount_requested && !selectedRequest.amount_approved && (
                <div>
                  <span className="text-[var(--color-text-secondary)] block">Requested Amount</span>
                  <span className="font-semibold text-slate-500 text-sm">
                    ₱{Number(selectedRequest.amount_requested).toLocaleString()}
                  </span>
                </div>
              )}

              {selectedRequest.purpose && (
                <div className="sm:col-span-2">
                  <span className="text-[var(--color-text-secondary)] block">Purpose / Medical Notes</span>
                  <p className="text-[var(--color-text)] mt-0.5 italic line-clamp-2">
                    &quot;{selectedRequest.purpose}&quot;
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Amount Released (₱) *</label>
            <input
              type="number"
              step="0.01"
              {...register('amount_released')}
              className="form-input"
              placeholder="0.00"
            />
            {errors.amount_released && (
              <p className="text-red-500 text-xs mt-1">{errors.amount_released.message}</p>
            )}
          </div>
          <div>
            <label className="form-label">Release Date *</label>
            <input
              type="date"
              {...register('release_date')}
              className="form-input"
            />
            {errors.release_date && (
              <p className="text-red-500 text-xs mt-1">{errors.release_date.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="form-label">Acknowledgment Notes</label>
          <textarea
            {...register('acknowledgment_notes')}
            rows={3}
            className="form-input"
            placeholder="Beneficiary acknowledgment, signature reference, voucher number, etc."
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving || loadingRequests} className="btn btn-primary px-6">
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Recording Payout...
              </>
            ) : (
              'Record Payout'
            )}
          </button>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default function NewPayoutPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[var(--color-text-secondary)] flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading payout form...
        </div>
      }
    >
      <PayoutForm />
    </Suspense>
  )
}
