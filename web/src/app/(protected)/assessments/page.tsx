'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import Link from 'next/link'
import { ClipboardList } from 'lucide-react'

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('assessments')
      .select('*, requests(assistance_type, status, beneficiaries(first_name, last_name))')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setAssessments(data ?? []); setLoading(false) })
  }, [])

  return (
    <div className="space-y-5" id="assessments-page">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Assessments</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">{assessments.length} assessment records</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" id="assessments-table">
            <thead>
              <tr>
                {['Beneficiary', 'Type', 'Interview Date', 'Recommendation', 'Home Visit', ''].map(h => (
                  <th key={h || 'actions'}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j}><div className="skeleton h-5 w-full" /></td>)}</tr>
                ))
              ) : assessments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <ClipboardList size={36} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-400 text-sm">No assessments found</p>
                  </td>
                </tr>
              ) : assessments.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium text-[var(--color-text)]">
                    {a.requests?.beneficiaries?.last_name}, {a.requests?.beneficiaries?.first_name}
                  </td>
                  <td><span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>{a.requests?.assistance_type}</span></td>
                  <td>{format(new Date(a.interview_date), 'MMM d, yyyy')}</td>
                  <td className="max-w-[200px] truncate">{a.recommendation}</td>
                  <td>{a.home_visit ? <span className="text-emerald-600 font-medium">Yes</span> : <span className="text-slate-400">No</span>}</td>
                  <td>
                    <Link href={`/requests/${a.request_id}`} className="text-blue-600 hover:text-blue-800 text-xs font-semibold hover:underline">
                      View Request
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
