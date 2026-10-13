'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

const schema = z.object({
  request_id: z.string().min(1, 'Select a request'),
  amount_released: z.string().min(1, 'Required'),
  release_date: z.string().min(1, 'Required'),
  acknowledgment_notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

function PayoutForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedId = searchParams.get('request_id')
  const supabase = createClient()
  const [approvedRequests, setApprovedRequests] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { request_id: preselectedId ?? '' },
  })

  useEffect(() => {
    supabase.from('requests')
      .select('id, assistance_type, encoded_by, amount_approved, beneficiaries(first_name, last_name)')
      .eq('status', 'Approved')
      .then(({ data }) => setApprovedRequests(data ?? []))
  }, [])

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err, data: newPay } = await supabase.from('payouts').insert({
      ...data, amount_released: parseFloat(data.amount_released), released_by: user?.id,
    }).select().single()
    
    if (err) { setError(err.message); setSaving(false); return }
    
    await supabase.from('requests').update({ status: 'Released', release_status: 'Released' }).eq('id', data.request_id)

    // Log action
    if (user) {
      await supabase.from('system_logs').insert({
        user_id: user.id,
        action: 'CREATE_PAYOUT',
        table_name: 'payouts',
        record_id: newPay?.id,
        details: { request_id: data.request_id, amount: data.amount_released }
      })
    }

    // Notify Resident
    const req = approvedRequests.find(r => r.id === data.request_id)
    if (req?.encoded_by) {
      await supabase.from('notifications').insert({
        user_id: req.encoded_by,
        title: 'Assistance Released',
        message: `Your ${req.assistance_type} assistance has been released. Amount: ₱${Number(data.amount_released).toLocaleString()}`,
        type: 'info',
        request_id: data.request_id
      })
    }

    router.push('/payouts')
  }

  return (
    <div className="space-y-5 max-w-2xl" id="new-payout-page">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Record Payout</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">Log assistance release details</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-5">
        <div>
          <label className="form-label">Approved Request *</label>
          <select {...register('request_id')} className="form-input">
            <option value="">Select Request</option>
            {approvedRequests.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.beneficiaries?.last_name}, {r.beneficiaries?.first_name} — {r.assistance_type}
                {r.amount_approved ? ` (₱${Number(r.amount_approved).toLocaleString()})` : ''}
              </option>
            ))}
          </select>
          {errors.request_id && <p className="text-red-500 text-xs mt-1">{errors.request_id.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Amount Released (₱) *</label>
            <input type="number" step="0.01" {...register('amount_released')} className="form-input" placeholder="0.00" />
            {errors.amount_released && <p className="text-red-500 text-xs mt-1">Required</p>}
          </div>
          <div>
            <label className="form-label">Release Date *</label>
            <input type="date" {...register('release_date')} className="form-input" />
            {errors.release_date && <p className="text-red-500 text-xs mt-1">Required</p>}
          </div>
        </div>

        <div>
          <label className="form-label">Acknowledgment Notes</label>
          <textarea {...register('acknowledgment_notes')} rows={3} className="form-input"
            placeholder="Beneficiary acknowledgment, signature reference, etc." />
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Record Payout'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  )
}

import { Suspense } from 'react'

export default function NewPayoutPage() {
  return (
    <Suspense fallback={<div>Loading form...</div>}>
      <PayoutForm />
    </Suspense>
  )
}
