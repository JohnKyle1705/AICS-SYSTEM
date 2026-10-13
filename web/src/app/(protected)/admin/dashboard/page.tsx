'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ASSISTANCE_COLORS } from '@/lib/constants'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { Users, FileText, CheckCircle, Clock, TrendingUp, AlertCircle, ShieldCheck, UserCheck, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'
import { useLanguage } from '@/lib/LanguageContext'


export default function AdminDashboard() {
  const { t } = useLanguage()
  const [stats, setStats] = useState<any>(null)
  const [pendingUsers, setPendingUsers] = useState<any[]>([])
  const [duplicateSuspects, setDuplicateSuspects] = useState<any[]>([])
  const [releaseNotifications, setReleaseNotifications] = useState<any[]>([])
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()


  const loadPendingUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('is_active', false).order('created_at', { ascending: false })
    setPendingUsers(data ?? [])
  }

  const activateUser = async (userId: string) => {
    setActivatingId(userId)
    await supabase.from('profiles').update({ is_active: true }).eq('id', userId)

    // Log the activation
    const { data: { user: adminUser } } = await supabase.auth.getUser()
    if (adminUser) {
      await supabase.from('system_logs').insert({
        user_id: adminUser.id,
        action: 'ACTIVATE_USER',
        table_name: 'profiles',
        record_id: userId
      })
    }

    // Notify the user
    await supabase.from('notifications').insert({
      user_id: userId,
      title: t('users_activateConfirm'),
      message: t('users_activateMsg'),
      type: 'info'
    })


    setPendingUsers(prev => prev.filter(u => u.id !== userId))
    setActivatingId(null)
  }

  const load = useCallback(async () => {
    const [
      { count: totalBeneficiaries },
      { count: totalRequests },
      { count: pendingRequests },
      { count: releasedRequests },
      { count: approvedRequests },
      { count: declinedRequests },
      { data: requests },
    ] = await Promise.all([
      supabase.from('beneficiaries').select('*', { count: 'exact', head: true }),
      supabase.from('requests').select('*', { count: 'exact', head: true }),
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'Released'),
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'Approved'),
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'Declined'),
      supabase.from('requests').select('assistance_type, status, created_at').in('status', ['Approved', 'Released']),
    ])

    const typeMap: Record<string, number> = {}
    const monthMap: Record<string, number> = {}

    requests?.forEach((r) => {
      typeMap[r.assistance_type] = (typeMap[r.assistance_type] || 0) + 1
      const month = new Date(r.created_at).toLocaleString('default', { month: 'short', year: '2-digit' })
      monthMap[month] = (monthMap[month] || 0) + 1
    })

    // Duplicate Detection Logic
    const { data: allReqs } = await supabase.from('requests').select('*, beneficiaries(first_name, last_name)')
    const suspects: any[] = []
    if (allReqs) {
      const bIdGroups = allReqs.reduce((acc: any, r: any) => {
        acc[r.beneficiary_id] = acc[r.beneficiary_id] || []
        acc[r.beneficiary_id].push(r)
        return acc
      }, {})
      
      Object.entries(bIdGroups).forEach(([bId, reqs]: [string, any]) => {
        if (reqs.length > 1) {
          suspects.push({
            beneficiary_id: bId,
            name: `${reqs[0].beneficiaries?.first_name} ${reqs[0].beneficiaries?.last_name}`,
            count: reqs.length,
            reason: 'Multiple requests from same beneficiary'
          })
        }
      })
    }
    setDuplicateSuspects(suspects)

    // Release Notifications
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: notifs } = await supabase.from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('title', 'Ready for Release')
        .order('created_at', { ascending: false })
      setReleaseNotifications(notifs ?? [])
    }

    setStats({
      totalBeneficiaries: totalBeneficiaries ?? 0,
      totalRequests: totalRequests ?? 0,
      pendingRequests: pendingRequests ?? 0,
      releasedRequests: releasedRequests ?? 0,
      approvedRequests: approvedRequests ?? 0,
      declinedRequests: declinedRequests ?? 0,
      byType: Object.entries(typeMap).map(([name, value]) => ({ name, value })),
      monthly: Object.entries(monthMap).slice(-6).map(([month, count]) => ({ month, count })),
    })

    await loadPendingUsers()
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase.channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadPendingUsers())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const markNotificationRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setReleaseNotifications(prev => prev.filter(n => n.id !== id))
  }

  const cards = [
    { label: t('dashboard_registeredBeneficiaries'), value: stats?.totalBeneficiaries, icon: Users, gradient: 'from-blue-500 to-blue-600', href: '/beneficiaries' },
    { label: t('dashboard_totalRequests'), value: stats?.totalRequests, icon: FileText, gradient: 'from-violet-500 to-purple-600', href: '/requests' },
    { label: t('dashboard_pending'), value: stats?.pendingRequests, icon: Clock, gradient: 'from-amber-500 to-orange-500', href: '/requests?status=Pending' },
    { label: t('dashboard_approved'), value: stats?.approvedRequests, icon: TrendingUp, gradient: 'from-cyan-500 to-blue-500', href: '/requests?status=Approved' },
    { label: t('dashboard_released'), value: stats?.releasedRequests, icon: CheckCircle, gradient: 'from-emerald-500 to-green-600', href: '/requests?status=Released' },
    { label: t('dashboard_declined'), value: stats?.declinedRequests, icon: AlertCircle, gradient: 'from-red-500 to-rose-600', href: '/requests?status=Declined' },
  ]


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/20">
          <ShieldCheck size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t('users_title')}</h1>
          <p className="text-[var(--color-text-secondary)] text-sm">{t('users_tabPending')}</p>
        </div>
      </div>


      {pendingUsers.length > 0 && (
        <div className="card border-amber-200 dark:border-amber-800/50 overflow-hidden" id="pending-approvals-section">
          <div className="bg-amber-50 dark:bg-amber-900/20 px-6 py-4 border-b border-amber-200 dark:border-amber-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-600">
                <UserCheck size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--color-text)]">{pendingUsers.length} {t('users_tabPending')}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{t('users_noPending') === 'No pending user approvals' ? 'New residents awaiting your approval' : t('users_noPending')}</p>
              </div>

            </div>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {pendingUsers.map(u => (
              <div key={u.id} className="px-6 py-4 flex items-center justify-between hover:bg-[var(--color-surface-hover)] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                    {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{u.full_name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] capitalize">{u.role} • Registered {format(new Date(u.created_at), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                </div>
                <button
                  onClick={() => activateUser(u.id)}
                  disabled={activatingId === u.id}
                  className="btn bg-emerald-600 hover:bg-emerald-700 text-white border-none py-2 px-5 text-xs font-bold shadow-lg shadow-emerald-500/20"
                  id={`activate-user-${u.id}`}
                >
                  {activatingId === u.id ? (
                    <><Loader2 size={14} className="animate-spin" /> {t('loading')}</>
                  ) : (
                    <><UserCheck size={14} /> {t('users_approveBtn')}</>
                  )}
                </button>

              </div>
            ))}
          </div>
        </div>
      )}

      {duplicateSuspects.length > 0 && (
        <div className="card border-red-200 dark:border-red-800/50 overflow-hidden" id="duplicate-suspects-section">
          <div className="bg-red-50 dark:bg-red-900/20 px-6 py-4 border-b border-red-200 dark:border-red-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center text-red-600">
                <AlertCircle size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--color-text)]">Duplicate Suspects Detected</p>
                <p className="text-xs text-[var(--color-text-secondary)]">The following beneficiaries have submitted multiple requests.</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-[var(--color-border)] max-h-[250px] overflow-y-auto">
            {duplicateSuspects.map(s => (
              <div key={s.beneficiary_id} className="px-6 py-4 flex items-center justify-between hover:bg-[var(--color-surface-hover)] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-linear-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                    {s.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{s.name}</p>
                    <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                      <AlertCircle size={12} /> {s.count} requests detected
                    </p>
                  </div>
                </div>
                <Link 
                  href={`/requests?search=${encodeURIComponent(s.name.split(' ')[0])}`} 
                  className="btn btn-secondary py-1.5 px-4 text-xs shadow-sm"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {releaseNotifications.length > 0 && (
        <div className="card border-blue-200 dark:border-blue-800/50 overflow-hidden" id="release-notifications-section">
          <div className="bg-blue-50 dark:bg-blue-900/20 px-6 py-4 border-b border-blue-200 dark:border-blue-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-600">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--color-text)]">Treasurer Notifications</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Requests marked as Ready for Release.</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-[var(--color-border)] max-h-[250px] overflow-y-auto">
            {releaseNotifications.map(n => (
              <div key={n.id} className="px-6 py-4 flex items-center justify-between hover:bg-[var(--color-surface-hover)] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                    {n.title?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{n.message}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1 mt-0.5">
                      <Clock size={12} /> {format(new Date(n.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => markNotificationRead(n.id)}
                    className="btn bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] py-1.5 px-3 text-xs shadow-sm"
                  >
                    Mark as Read
                  </button>
                  {n.request_id && (
                    <Link 
                      href={`/requests/${n.request_id}`} 
                      className="btn btn-primary py-1.5 px-4 text-xs shadow-sm"
                    >
                      Open Request
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, gradient, href }) => (
          <Link 
            key={label} 
            href={href}
            className="card p-5 flex items-center gap-4 hover:scale-[1.02] hover:shadow-xl transition-all duration-300 cursor-pointer group border-none ring-1 ring-[var(--color-border)] hover:ring-blue-500/50"
          >
            <div className={`bg-linear-to-br ${gradient} text-white p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform`}>
              <Icon size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--color-text)]">{loading ? '...' : value}</p>
              <p className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-semibold text-[var(--color-text)] mb-6 text-[15px]">{t('dashboard_assistanceBreakdown')}</h2>

          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={stats?.byType ?? []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label>
                {stats?.byType.map((entry: any) => (
                  <Cell key={entry.name} fill={ASSISTANCE_COLORS[entry.name] ?? '#94a3b8'} />
                ))}
              </Pie>
              <Legend verticalAlign="bottom" height={36}/>
              <Tooltip contentStyle={{ borderRadius: 10, border: 'none', backgroundColor: '#18182b', color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-[var(--color-text)] mb-6 text-[15px]">{t('reports_trend')}</h2>

          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats?.monthly ?? []}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ borderRadius: 10, border: 'none', backgroundColor: '#18182b', color: '#fff' }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
