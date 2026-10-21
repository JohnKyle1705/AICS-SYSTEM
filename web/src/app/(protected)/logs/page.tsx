'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import {
  ScrollText, RefreshCw, Search, Filter, ChevronLeft, ChevronRight,
  X, Clock, User, Activity, Info, AlertCircle, ShieldAlert,
  CheckCircle2, XCircle, LogIn, LogOut, Plus, Pencil, Trash2, Eye, ExternalLink, Loader2
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────
interface AuditLog {
  id: string
  created_at: string
  user_id: string | null
  action: string
  table_name: string | null
  record_id: string | null
  details: Record<string, any> | null
  profiles: { full_name: string; role: string } | null
}

// ── Constants ────────────────────────────────────────────────
const PAGE_SIZE = 25

const ACTION_OPTIONS = [
  'ALL',
  'LOGIN', 'LOGOUT',
  'CREATE_REQUEST', 'UPDATE_REQUEST', 'APPROVE_REQUEST', 'DECLINE_REQUEST',
  'RELEASE_REQUEST', 'BLOCKED_DUPLICATE_REQUEST',
  'CREATE_BENEFICIARY', 'UPDATE_BENEFICIARY',
  'ACTIVATE_USER', 'DEACTIVATE_USER', 'DELETE_USER', 'UPDATE_ROLE', 'CREATE_USER',
  'CREATE_PAYOUT', 'UPDATE_PAYOUT', 'UPDATE_FUND',
  'CREATE_ASSESSMENT', 'EXPORT_REPORT', 'UPDATE_SETTINGS', 'MARK_READ', 'VIEW_NOTIFICATION',
]

const ROLE_OPTIONS = ['ALL', 'admin', 'treasurer', 'resident']

const ACTION_META: Record<string, { color: string; icon: React.ComponentType<{ size?: number; className?: string }>; label: string }> = {
  LOGIN:                    { color: 'text-emerald-500', icon: LogIn,        label: 'Login'              },
  LOGOUT:                   { color: 'text-slate-400',   icon: LogOut,       label: 'Logout'             },
  CREATE_REQUEST:           { color: 'text-blue-500',    icon: Plus,         label: 'New Request'        },
  UPDATE_REQUEST:           { color: 'text-amber-500',   icon: Pencil,       label: 'Update Request'     },
  APPROVE_REQUEST:          { color: 'text-emerald-500', icon: CheckCircle2, label: 'Approve Request'    },
  DECLINE_REQUEST:          { color: 'text-red-500',     icon: XCircle,      label: 'Decline Request'    },
  RELEASE_REQUEST:          { color: 'text-cyan-500',    icon: CheckCircle2, label: 'Release'            },
  BLOCKED_DUPLICATE_REQUEST:{ color: 'text-orange-500',  icon: ShieldAlert,  label: 'Blocked Duplicate'  },
  CREATE_BENEFICIARY:       { color: 'text-blue-400',    icon: Plus,         label: 'New Beneficiary'    },
  UPDATE_BENEFICIARY:       { color: 'text-amber-400',   icon: Pencil,       label: 'Update Beneficiary' },
  ACTIVATE_USER:            { color: 'text-emerald-400', icon: CheckCircle2, label: 'Activate User'      },
  DEACTIVATE_USER:          { color: 'text-red-400',     icon: XCircle,      label: 'Deactivate User'    },
  DELETE_USER:              { color: 'text-red-600',     icon: Trash2,       label: 'Delete User'        },
  UPDATE_ROLE:              { color: 'text-violet-400',  icon: Pencil,       label: 'Change Role'        },
  CREATE_USER:              { color: 'text-blue-400',    icon: Plus,         label: 'Create User'        },
  CREATE_PAYOUT:            { color: 'text-emerald-500', icon: Plus,         label: 'Record Payout'      },
  UPDATE_PAYOUT:            { color: 'text-amber-400',   icon: Pencil,       label: 'Update Payout'      },
  UPDATE_FUND:              { color: 'text-cyan-400',    icon: Pencil,       label: 'Update Fund'        },
  CREATE_ASSESSMENT:        { color: 'text-blue-400',    icon: Plus,         label: 'New Assessment'     },
  EXPORT_REPORT:            { color: 'text-violet-500',  icon: Eye,          label: 'Export Report'      },
  UPDATE_SETTINGS:          { color: 'text-amber-500',   icon: Pencil,       label: 'Update Settings'    },
  MARK_READ:                { color: 'text-slate-400',   icon: CheckCircle2, label: 'Mark Read'          },
  VIEW_NOTIFICATION:        { color: 'text-sky-400',     icon: Eye,          label: 'View Notification'  },
}

function getActionMeta(action: string) {
  return ACTION_META[action] ?? { color: 'text-slate-400', icon: Activity, label: action.replace(/_/g, ' ') }
}

function formatLogDetails(log: AuditLog): string {
  const d = log.details
  const action = log.action

  if (!d || typeof d !== 'object' || Object.keys(d).length === 0) {
    if (log.record_id) {
      return `Record #${log.record_id.slice(0, 8).toUpperCase()}`
    }
    return '—'
  }

  // 1. Explicit human-readable event or reason fields
  if (typeof d.event === 'string' && d.event.trim()) return d.event
  if (typeof d.message === 'string' && d.message.trim()) return d.message
  if (typeof d.reason === 'string' && d.reason.trim()) return d.reason
  if (typeof d.description === 'string' && d.description.trim()) return d.description

  // 2. Action-specific formats
  switch (action) {
    case 'VIEW_NOTIFICATION':
      return d.request_id 
        ? `Viewed notification for Request #${d.request_id.slice(0, 8).toUpperCase()}`
        : 'Viewed general notification'

    case 'CREATE_REQUEST':
      if (d.type) return `Submitted ${d.type} Assistance Request`
      return 'Submitted assistance application'

    case 'UPDATE_REQUEST':
      if (d.new_status) return `Request marked as ${d.new_status}`
      return 'Updated request details'

    case 'APPROVE_REQUEST':
      return d.new_status ? `Approved request (${d.new_status})` : 'Approved assistance request'

    case 'DECLINE_REQUEST':
      return d.reason ? `Declined request: ${d.reason}` : 'Declined assistance request'

    case 'RELEASE_REQUEST':
      return d.amount ? `Released payout of ₱${Number(d.amount).toLocaleString()}` : 'Released assistance funds'

    case 'BLOCKED_DUPLICATE_REQUEST':
      return d.reason ? `Blocked duplicate: ${d.reason}` : 'Blocked duplicate claim'

    case 'CREATE_PAYOUT':
      return d.amount 
        ? `Disbursed ₱${Number(d.amount).toLocaleString()}${d.request_id ? ` for Request #${d.request_id.slice(0, 8).toUpperCase()}` : ''}`
        : 'Disbursed assistance payout'

    case 'UPDATE_PAYOUT':
      return 'Updated disbursement record'

    case 'UPDATE_ROLE':
      return d.new_role ? `Changed role to ${d.new_role.toUpperCase()}` : 'Updated user role'

    case 'ACTIVATE_USER':
      return 'Activated user account'

    case 'DEACTIVATE_USER':
      return 'Deactivated user account'

    case 'DELETE_USER':
      return 'Deleted user account'

    case 'CREATE_USER':
      return d.email ? `Created user account (${d.email})` : 'Created new user account'

    case 'CREATE_BENEFICIARY':
      return 'Registered new beneficiary profile'

    case 'UPDATE_BENEFICIARY':
      return 'Updated beneficiary profile'

    case 'CREATE_ASSESSMENT':
      return 'Conducted eligibility assessment'

    case 'EXPORT_REPORT':
      return d.format ? `Exported report (${d.format.toUpperCase()})` : 'Exported summary report'

    case 'UPDATE_SETTINGS':
      return d.setting_key ? `Updated ${d.setting_key.replace(/_/g, ' ')}` : 'Updated system settings'

    case 'MARK_READ':
      return 'Marked notification as read'

    case 'LOGIN':
      return 'Successful login'

    case 'LOGOUT':
      return 'User signed out'
  }

  // 3. Smart fallback: format keys cleanly instead of raw JSON string
  const entries = Object.entries(d).filter(([_, v]) => v !== null && v !== undefined && v !== '')
  if (entries.length === 0) {
    if (log.record_id) return `Record #${log.record_id.slice(0, 8).toUpperCase()}`
    return '—'
  }

  return entries
    .map(([k, v]) => {
      const cleanKey = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      if (typeof v === 'string' && v.length > 20 && (k.endsWith('_id') || k === 'id')) {
        return `${cleanKey}: #${v.slice(0, 8).toUpperCase()}`
      }
      if (typeof v === 'number' && (k.includes('amount') || k.includes('cost') || k.includes('funds'))) {
        return `${cleanKey}: ₱${v.toLocaleString()}`
      }
      if (typeof v === 'object') {
        return `${cleanKey}: Details`
      }
      return `${cleanKey}: ${v}`
    })
    .join(' · ')
}

function RoleBadge({ role }: { role?: string }) {
  const map: Record<string, string> = {
    admin:     'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
    treasurer: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    resident:  'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  }
  return (
    <span className={`badge border text-[10px] font-black uppercase ${map[role ?? ''] ?? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>
      {role ?? 'System'}
    </span>
  )
}

// ── Details Modal ────────────────────────────────────────────
function DetailsModal({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const meta = getActionMeta(log.action)
  const Icon = meta.icon
  const supabase = createClient()
  const SENSITIVE = ['password', 'token', 'secret', 'verification_code', 'otp', 'pin']

  const safeDetails = log.details
    ? Object.fromEntries(
        Object.entries(log.details).filter(
          ([k]) => !SENSITIVE.some(s => k.toLowerCase().includes(s))
        )
      )
    : null

  const [loadingContext, setLoadingContext] = useState(false)
  const [contextData, setContextData] = useState<{
    request?: any
    notification?: any
    beneficiary?: any
    profile?: any
  } | null>(null)

  useEffect(() => {
    let isMounted = true
    const fetchContext = async () => {
      const requestId = safeDetails?.request_id || (log.table_name === 'requests' ? log.record_id : null)
      const notifId = log.table_name === 'notifications' ? log.record_id : null
      const benId = safeDetails?.beneficiary_id || (log.table_name === 'beneficiaries' ? log.record_id : null)
      const profileId = (log.table_name === 'profiles' ? log.record_id : null)

      if (!requestId && !notifId && !benId && !profileId) return

      setLoadingContext(true)
      const res: any = {}

      try {
        if (requestId) {
          const { data } = await supabase
            .from('requests')
            .select('id, assistance_type, status, amount_approved, amount_requested, beneficiaries(first_name, last_name, barangay)')
            .eq('id', requestId)
            .maybeSingle()
          if (data) res.request = data
        }

        if (notifId) {
          const { data } = await supabase
            .from('notifications')
            .select('id, title, message, type, created_at')
            .eq('id', notifId)
            .maybeSingle()
          if (data) res.notification = data
        }

        if (benId && !res.request?.beneficiaries) {
          const { data } = await supabase
            .from('beneficiaries')
            .select('id, first_name, last_name, barangay, contact_number')
            .eq('id', benId)
            .maybeSingle()
          if (data) res.beneficiary = data
        }

        if (profileId) {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, role, email')
            .eq('id', profileId)
            .maybeSingle()
          if (data) res.profile = data
        }

        if (isMounted) setContextData(res)
      } catch (err) {
        console.error('Failed to load event context', err)
      } finally {
        if (isMounted) setLoadingContext(false)
      }
    }

    fetchContext()
    return () => { isMounted = false }
  }, [log, safeDetails, supabase])

  // Custom formatted payload attributes (excluding already resolved ones)
  const payloadItems = safeDetails
    ? Object.entries(safeDetails)
        .filter(([key, val]) => {
          if (val === null || val === undefined || val === '') return false
          if (key === 'event' || key === 'message' || key === 'request_id') return false
          if (key === 'beneficiary_id' && contextData?.request?.beneficiaries) return false
          return true
        })
        .map(([key, val]) => {
          const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          let displayVal = String(val)
          let isMono = false

          if (key.endsWith('_id') || key === 'id') {
            isMono = true
          } else if (typeof val === 'number' && (key.includes('amount') || key.includes('cost') || key.includes('funds'))) {
            displayVal = `₱${val.toLocaleString()}`
          } else if (typeof val === 'boolean') {
            displayVal = val ? 'Yes' : 'No'
          } else if (typeof val === 'object') {
            displayVal = JSON.stringify(val)
          }

          return { label: formattedKey, value: displayVal, isMono }
        })
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-[var(--color-surface)] rounded-2xl shadow-2xl border border-[var(--color-border)] p-6 animate-in fade-in slide-in-from-bottom-4 duration-300 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center">
              <Icon size={20} className={meta.color} />
            </div>
            <div>
              <p className="font-bold text-[var(--color-text)]">{meta.label}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Audit Event Details</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Base Audit Information */}
        <dl className="space-y-3 text-sm">
          <DetailRow label="Timestamp" value={format(new Date(log.created_at), 'MMMM d, yyyy — hh:mm:ss a')} />
          <DetailRow label="User" value={log.profiles?.full_name ?? 'System / Unknown'} />
          <DetailRow label="Role"><RoleBadge role={log.profiles?.role} /></DetailRow>
          <DetailRow label="Action">
            <span className={`font-bold uppercase tracking-wider text-xs ${meta.color}`}>{meta.label}</span>
          </DetailRow>
          <DetailRow label="Module" value={log.table_name ?? '—'} />
          {log.record_id && (
            <DetailRow label="Record ID" mono>
              <span className="flex items-center gap-2 flex-wrap">
                <span>{log.record_id}</span>
                {log.table_name === 'requests' && (
                  <Link 
                    href={`/requests/${log.record_id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-500 hover:text-blue-400 underline"
                  >
                    View Request <ExternalLink size={11} />
                  </Link>
                )}
              </span>
            </DetailRow>
          )}
          <DetailRow label="Details" value={formatLogDetails(log)} />
        </dl>

        {/* Event Payload & Output Card */}
        <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Event Payload Output
            </h3>
            {loadingContext && (
              <span className="flex items-center gap-1 text-[10px] text-blue-500 font-semibold">
                <Loader2 size={12} className="animate-spin" /> Loading record...
              </span>
            )}
          </div>

          <div className="bg-[var(--color-background)] rounded-xl p-4 border border-[var(--color-border)] space-y-3">
            {/* Notification Event Output */}
            {contextData?.notification && (
              <div className="pb-3 border-b border-[var(--color-border)]">
                <span className="text-[10px] uppercase font-bold text-sky-500 block mb-1">Notification Content</span>
                <p className="text-sm font-bold text-[var(--color-text)]">{contextData.notification.title}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">{contextData.notification.message}</p>
              </div>
            )}

            {/* Target Request Event Output */}
            {contextData?.request && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-blue-500">Target Request Record</span>
                  <Link
                    href={`/requests/${contextData.request.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Open Request <ExternalLink size={12} />
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--color-text-secondary)] block text-[10px]">Beneficiary</span>
                    <span className="font-semibold text-[var(--color-text)]">
                      {contextData.request.beneficiaries?.last_name}, {contextData.request.beneficiaries?.first_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-secondary)] block text-[10px]">Barangay</span>
                    <span className="text-[var(--color-text)]">
                      {contextData.request.beneficiaries?.barangay ? `Brgy. ${contextData.request.beneficiaries.barangay}` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-secondary)] block text-[10px]">Assistance Type</span>
                    <span className="font-semibold text-[var(--color-text)]">{contextData.request.assistance_type}</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-secondary)] block text-[10px]">Status</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{contextData.request.status}</span>
                  </div>
                  {contextData.request.amount_approved && (
                    <div className="col-span-2">
                      <span className="text-[var(--color-text-secondary)] block text-[10px]">Approved Amount</span>
                      <span className="font-black text-emerald-600 text-sm">₱{Number(contextData.request.amount_approved).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Beneficiary Event Output */}
            {contextData?.beneficiary && !contextData?.request && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-blue-500 block">Beneficiary Record</span>
                <p className="font-bold text-sm text-[var(--color-text)]">
                  {contextData.beneficiary.last_name}, {contextData.beneficiary.first_name}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {contextData.beneficiary.barangay ? `Brgy. ${contextData.beneficiary.barangay}` : ''}
                  {contextData.beneficiary.contact_number ? ` • ${contextData.beneficiary.contact_number}` : ''}
                </p>
              </div>
            )}

            {/* Profile Event Output */}
            {contextData?.profile && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-violet-500 block">Target Account</span>
                <p className="font-bold text-sm text-[var(--color-text)]">{contextData.profile.full_name}</p>
                <p className="text-xs text-[var(--color-text-secondary)] capitalize">Role: {contextData.profile.role}</p>
              </div>
            )}

            {/* Additional Structured Key-Value Payload Rows */}
            {payloadItems.length > 0 && (
              <div className="pt-2 border-t border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {payloadItems.map(({ label, value, isMono }) => (
                  <div key={label} className="bg-[var(--color-surface)] p-2 rounded-lg border border-[var(--color-border)]">
                    <span className="text-[10px] uppercase font-bold text-[var(--color-text-secondary)] block mb-0.5">{label}</span>
                    <span className={`text-[var(--color-text)] font-medium ${isMono ? 'font-mono text-[11px] break-all' : ''}`}>{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Fallback if event is self-contained */}
            {!contextData?.request && !contextData?.notification && !contextData?.beneficiary && !contextData?.profile && payloadItems.length === 0 && (
              <div className="text-xs text-[var(--color-text)] py-1">
                <span className="text-[10px] uppercase font-bold text-[var(--color-text-secondary)] block mb-1">Event Result</span>
                <p className="font-medium text-[var(--color-text)]">{formatLogDetails(log)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, mono, children }: { label: string; value?: string; mono?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-28 shrink-0 text-[var(--color-text-secondary)] text-xs font-semibold uppercase tracking-wider pt-0.5">{label}</dt>
      <dd className={`text-[var(--color-text)] flex-1 ${mono ? 'font-mono text-xs break-all' : ''}`}>
        {children ?? value}
      </dd>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function LogsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [logs, setLogs]         = useState<AuditLog[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [selected, setSelected] = useState<AuditLog | null>(null)
  const [page, setPage]         = useState(0)
  const supabaseRef = useRef(createClient())

  // Filters
  const [search, setSearch]     = useState('')
  const [actionFilter, setAction] = useState('ALL')
  const [roleFilter, setRole]   = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  // Admin guard
  useEffect(() => {
    const supabase = supabaseRef.current
    supabase.auth.getUser().then(async (res: { data: { user: { id: string } | null } }) => {
      const user = res.data?.user
      if (!user) { router.replace('/login'); return }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (p?.role !== 'admin') router.replace('/dashboard')
    })
  }, [router])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const supabase = supabaseRef.current
    try {
      let q = supabase
        .from('system_logs')
        .select('*, profiles(full_name, role)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (actionFilter !== 'ALL') q = q.eq('action', actionFilter)
      if (dateFrom)               q = q.gte('created_at', dateFrom)
      if (dateTo)                 q = q.lte('created_at', dateTo + 'T23:59:59')

      const { data, count, error: qErr } = await q
      if (qErr) throw qErr

      let rows = (data ?? []) as AuditLog[]

      // Client-side: search by user name, action, table, record_id, or formatted details
      if (search.trim()) {
        const s = search.toLowerCase()
        rows = rows.filter(l =>
          (l.profiles?.full_name ?? '').toLowerCase().includes(s) ||
          l.action.toLowerCase().includes(s) ||
          (l.table_name ?? '').toLowerCase().includes(s) ||
          (l.record_id ?? '').toLowerCase().includes(s) ||
          formatLogDetails(l).toLowerCase().includes(s)
        )
      }
      // Client-side role filter
      if (roleFilter !== 'ALL') {
        rows = rows.filter(l => l.profiles?.role === roleFilter)
      }

      setLogs(rows)
      setTotal(count ?? 0)
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : String(e)) || 'Failed to load audit logs.')
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter, roleFilter, dateFrom, dateTo, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search, actionFilter, roleFilter, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6" id="logs-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">System Audit Logs</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">
            Track administrative actions and system updates
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="btn btn-secondary flex items-center gap-2 self-start sm:self-auto"
          id="logs-refresh"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by user, action, table, or record ID…"
            className="form-input pl-9 py-2 text-sm"
            id="logs-search"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-1">
              <Filter size={10} /> Action
            </label>
            <select value={actionFilter} onChange={e => setAction(e.target.value)}
              className="form-input py-1.5 text-xs" id="logs-action-filter">
              {ACTION_OPTIONS.map(a => (
                <option key={a} value={a}>{a === 'ALL' ? 'All Actions' : a.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-1">
              <User size={10} /> Role
            </label>
            <select value={roleFilter} onChange={e => setRole(e.target.value)}
              className="form-input py-1.5 text-xs" id="logs-role-filter">
              {ROLE_OPTIONS.map(r => (
                <option key={r} value={r}>{r === 'ALL' ? 'All Roles' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="form-input py-1.5 text-xs" id="logs-date-from" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="form-input py-1.5 text-xs" id="logs-date-to" />
          </div>
        </div>

        {(search || actionFilter !== 'ALL' || roleFilter !== 'ALL' || dateFrom || dateTo) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {search && <Chip label={`"${search}"`} onRemove={() => setSearch('')} />}
            {actionFilter !== 'ALL' && <Chip label={actionFilter.replace(/_/g, ' ')} onRemove={() => setAction('ALL')} />}
            {roleFilter !== 'ALL' && <Chip label={roleFilter} onRemove={() => setRole('ALL')} />}
            {dateFrom && <Chip label={`From: ${dateFrom}`} onRemove={() => setDateFrom('')} />}
            {dateTo && <Chip label={`To: ${dateTo}`} onRemove={() => setDateTo('')} />}
            <button
              onClick={() => { setSearch(''); setAction('ALL'); setRole('ALL'); setDateFrom(''); setDateTo('') }}
              className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] underline">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Table (Desktop) */}
      <div className="card overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {['Timestamp', 'User', 'Action', 'Table', 'Details', ''].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j}><div className="skeleton h-4 w-full rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <ScrollText size={36} className="mx-auto mb-3 text-slate-500" />
                    <p className="text-[var(--color-text-secondary)] text-sm font-medium">
                      {error ? 'Failed to load logs' : 'No logs found'}
                    </p>
                    {!error && (search || actionFilter !== 'ALL') && (
                      <p className="text-xs text-slate-500 mt-1">Try adjusting your filters</p>
                    )}
                  </td>
                </tr>
              ) : logs.map(log => {
                const meta = getActionMeta(log.action)
                const Icon = meta.icon
                return (
                  <tr key={log.id}
                    className="text-[13px] hover:bg-slate-100/70 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                    onClick={() => setSelected(log)}>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-[var(--color-text)]">
                            {format(new Date(log.created_at), 'MMM d, yyyy')}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {format(new Date(log.created_at), 'hh:mm:ss a')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <User size={13} className="text-blue-600 dark:text-blue-500 shrink-0" />
                        <div>
                          <p className="font-semibold text-[var(--color-text)] leading-tight">
                            {log.profiles?.full_name ?? 'System'}
                          </p>
                          <RoleBadge role={log.profiles?.role} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={`flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] ${meta.color}`}>
                        <Icon size={12} className="shrink-0" />
                        {meta.label}
                      </div>
                    </td>
                    <td className="font-mono text-[11px] text-slate-600 dark:text-slate-400">{log.table_name ?? '—'}</td>
                    <td className="max-w-[320px]">
                      <p className="truncate text-[var(--color-text-secondary)] text-xs font-medium" title={formatLogDetails(log)}>
                        {formatLogDetails(log)}
                      </p>
                    </td>
                    <td>
                      <button
                        onClick={e => { e.stopPropagation(); setSelected(log) }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="View details">
                        <Info size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-2">
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ))
        ) : logs.length === 0 ? (
          <div className="card p-8 text-center">
            <ScrollText size={32} className="mx-auto mb-2 text-slate-500" />
            <p className="text-[var(--color-text-secondary)] text-sm font-medium">
              {error ? 'Failed to load logs' : 'No logs found'}
            </p>
          </div>
        ) : (
          logs.map(log => {
            const meta = getActionMeta(log.action)
            const Icon = meta.icon
            return (
              <div
                key={log.id}
                onClick={() => setSelected(log)}
                className="card p-4 space-y-3 active:scale-[0.99] transition-transform cursor-pointer hover:border-blue-500/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-blue-500 shrink-0" />
                    <div>
                      <span className="font-bold text-sm text-[var(--color-text)] block">
                        {log.profiles?.full_name ?? 'System'}
                      </span>
                      <RoleBadge role={log.profiles?.role} />
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {format(new Date(log.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--color-border)]">
                  <div className={`flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] ${meta.color}`}>
                    <Icon size={12} className="shrink-0" />
                    {meta.label}
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">{log.table_name ?? '—'}</span>
                </div>

                <p className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-background)] p-2.5 rounded-lg border border-[var(--color-border)] leading-relaxed">
                  {formatLogDetails(log)}
                </p>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="card px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <p className="text-[var(--color-text-secondary)] text-xs text-center sm:text-left">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} records
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              id="logs-prev-page">
              <ChevronLeft size={16} />
            </button>
            <span className="text-[var(--color-text-secondary)] text-xs px-2">
              Page {page + 1} of {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              id="logs-next-page">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selected && <DetailsModal log={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 rounded-full px-2.5 py-0.5 text-xs font-semibold">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900 dark:hover:text-blue-200 transition-colors"><X size={11} /></button>
    </span>
  )
}
