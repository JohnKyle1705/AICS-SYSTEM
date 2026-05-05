'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import Link from 'next/link'
import { Plus, DollarSign } from 'lucide-react'

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('payouts')
      .select('*, requests(assistance_type, beneficiaries(first_name, last_name, barangay))')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setPayouts(data ?? []); setLoading(false) })
  }, [])

  const total = payouts.reduce((sum, p) => sum + Number(p.amount_released), 0)

  return (
    <div className="space-y-5" id="payouts-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Payout Records</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">
            Total Released: <span className="font-bold text-emerald-600 dark:text-emerald-400">₱{total.toLocaleString()}</span>
          </p>
        </div>
        <Link href="/payouts/new" className="btn btn-primary" id="record-payout-btn">
          <Plus size={16} /> Record Payout
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" id="payouts-table">
            <thead>
              <tr>
                {['Beneficiary', 'Barangay', 'Type', 'Amount Released', 'Release Date', 'Notes', ''].map(h => (
                  <th key={h || 'actions'}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j}><div className="skeleton h-5 w-full" /></td>)}</tr>
                ))
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <DollarSign size={36} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p className="text-slate-400 text-sm">No payout records</p>
                  </td>
                </tr>
              ) : payouts.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium text-[var(--color-text)]">{p.requests?.beneficiaries?.last_name}, {p.requests?.beneficiaries?.first_name}</td>
                  <td>{p.requests?.beneficiaries?.barangay}</td>
                  <td><span className="badge bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{p.requests?.assistance_type}</span></td>
                  <td className="font-bold text-emerald-600 dark:text-emerald-400">₱{Number(p.amount_released).toLocaleString()}</td>
                  <td className="text-[var(--color-text)]">{format(new Date(p.release_date), 'MMM d, yyyy')}</td>
                  <td className="max-w-[150px] truncate text-[var(--color-text-secondary)]">{p.acknowledgment_notes ?? '—'}</td>
                  <td>
                    <Link href={`/requests/${p.request_id}`} className="text-blue-600 hover:text-blue-800 text-xs font-semibold hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
