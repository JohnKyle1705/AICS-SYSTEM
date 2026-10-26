'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import Link from 'next/link'
import { ClipboardList } from 'lucide-react'

type AssessmentRecord = {
  id: string; request_id: string; interview_date: string; recommendation: string; home_visit: boolean;
  requests?: { assistance_type?: string; status?: string; beneficiaries?: { first_name?: string; last_name?: string } }
}

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('assessments')
      .select('*, requests(assistance_type, status, beneficiaries(first_name, last_name))')
      .order('created_at', { ascending: false })
      .then(({ data }: { data: AssessmentRecord[] | null }) => { setAssessments((data ?? []) as AssessmentRecord[]); setLoading(false) })
  }, [])

  return (
    <div className="space-y-5" id="assessments-page">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Assessments</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">{assessments.length} assessment records</p>
      </div>

      {/* Desktop Table */}
      <div className="card overflow-hidden hidden md:block">
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
                  <td><span className="badge bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">{a.requests?.assistance_type}</span></td>
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

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-2">
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-4 w-1/3" />
            </div>
          ))
        ) : assessments.length === 0 ? (
          <div className="card p-8 text-center">
            <ClipboardList size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-slate-400 text-sm">No assessments found</p>
          </div>
        ) : (
          assessments.map(a => (
            <div key={a.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm text-[var(--color-text)]">
                    {a.requests?.beneficiaries?.last_name}, {a.requests?.beneficiaries?.first_name}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    Interview: {format(new Date(a.interview_date), 'MMM d, yyyy')}
                  </p>
                </div>
                <span className="badge bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {a.requests?.assistance_type}
                </span>
              </div>

              <div className="bg-[var(--color-background)] p-3 rounded-xl border border-[var(--color-border)] text-xs">
                <span className="font-semibold text-[var(--color-text-secondary)] block mb-1">Recommendation:</span>
                <p className="text-[var(--color-text)] leading-relaxed">{a.recommendation}</p>
                <div className="mt-2 pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px]">
                  <span>Home Visit: {a.home_visit ? <strong className="text-emerald-600">Yes</strong> : <span className="text-slate-400">No</span>}</span>
                </div>
              </div>

              <div className="pt-1">
                <Link
                  href={`/requests/${a.request_id}`}
                  className="btn btn-secondary w-full text-center text-xs py-2 block font-semibold"
                >
                  View Request Details
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
