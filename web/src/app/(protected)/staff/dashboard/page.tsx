'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ClipboardList, Clock, CheckCircle, AlertCircle, Search, UserCheck } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/lib/LanguageContext'


export default function StaffDashboard() {
  const { t } = useLanguage()
  const [stats, setStats] = useState<any>(null)
  const [recentRequests, setRecentRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()


  useEffect(() => {
    const load = async () => {
      const [
        { count: pending },
        { count: approved },
        { data: recent }
      ] = await Promise.all([
        supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
        supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'Approved'),
        supabase.from('requests').select('*, beneficiaries(last_name, first_name)').order('created_at', { ascending: false }).limit(5)
      ])

      setStats({ pending: pending ?? 0, approved: approved ?? 0 })
      setRecentRequests(recent ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t('dashboard_title')}</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">{t('dashboard_subtitle')}</p>
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <Link href="/requests?status=Pending" className="card p-6 border-l-4 border-amber-500 hover:scale-[1.02] transition-transform cursor-pointer group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <Clock size={24} />
            </div>
            <span className="text-xs font-bold text-amber-600 uppercase">{t('req_pending')}</span>
          </div>
          <h3 className="text-3xl font-bold text-[var(--color-text)]">{loading ? '...' : stats?.pending}</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t('dashboard_pendingRequests')}</p>
          <div className="text-xs text-blue-600 font-semibold mt-4 inline-block group-hover:underline">
            {t('dashboard_viewQueue')} →
          </div>

        </Link>

        <Link href="/payouts/new" className="card p-6 border-l-4 border-blue-500 hover:scale-[1.02] transition-transform cursor-pointer group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors">
              <UserCheck size={24} />
            </div>
            <span className="text-xs font-bold text-blue-600 uppercase">{t('req_approved')}</span>
          </div>
          <h3 className="text-3xl font-bold text-[var(--color-text)]">{loading ? '...' : stats?.approved}</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t('dashboard_readyPayout')}</p>
          <div className="text-xs text-blue-600 font-semibold mt-4 inline-block group-hover:underline">
            {t('dashboard_processPayouts')} →
          </div>

        </Link>

        <Link href="/reports" className="card p-6 border-l-4 border-emerald-500 hover:scale-[1.02] transition-transform cursor-pointer group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <CheckCircle size={24} />
            </div>
            <span className="text-xs font-bold text-emerald-600 uppercase">{t('reports_total')}</span>
          </div>
          <h3 className="text-3xl font-bold text-[var(--color-text)]">{t('reports_view')}</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t('reports_analytics')}</p>
          <div className="text-xs text-blue-600 font-semibold mt-4 inline-block group-hover:underline">
            {t('dashboard_viewAnalytics')} →
          </div>

        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-[var(--color-text)]">{t('dashboard_recentSubmissions')}</h2>
            <Link href="/requests" className="text-xs text-blue-600 hover:underline">{t('viewAll')}</Link>
          </div>

          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('requests_beneficiary')}</th>
                  <th>{t('requests_type')}</th>
                  <th>{t('requests_status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>

              <tbody>
                {recentRequests.map(r => (
                  <tr key={r.id}>
                    <td className="text-sm font-medium">{r.beneficiaries?.last_name}, {r.beneficiaries?.first_name}</td>
                    <td className="text-xs">{r.assistance_type}</td>
                    <td>
                      <span className={`badge ${r.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'} text-[10px]`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <Link href={`/requests/${r.id}`} className="text-blue-600 hover:text-blue-800">
                        {t('review')}
                      </Link>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-bold text-[var(--color-text)]">{t('dashboard_quickTools')}</h2>
          <div className="card p-4 space-y-2">
            <Link href="/beneficiaries/new" className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--color-surface-hover)] transition-colors text-sm text-[var(--color-text)]">
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-600"><Search size={16}/></div>
              {t('beneficiary_new')}
            </Link>

            <Link href="/reports" className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--color-surface-hover)] transition-colors text-sm text-[var(--color-text)]">
              <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-600"><AlertCircle size={16}/></div>
              {t('dashboard_generateReport')}
            </Link>

          </div>
        </div>
      </div>
    </div>
  )
}
