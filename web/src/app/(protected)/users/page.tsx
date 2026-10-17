'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import {
  UserPlus, ToggleLeft, ToggleRight, Loader2, Users, Trash2,
  ShieldCheck, User, Search, ChevronLeft, ChevronRight,
  X, Eye, Info, Shield
} from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffUser {
  id: string
  full_name: string
  role: 'admin' | 'treasurer'
  is_active: boolean
  created_at: string
  avatar_url?: string
  email: string
}

interface ResidentUser {
  id: string
  full_name: string
  role: 'resident'
  is_active: boolean
  created_at: string
  avatar_url?: string
  email: string
  contact_number: string
  beneficiary?: {
    address?: string
    barangay?: string
    birthdate?: string
    civil_status?: string
    sex?: string
    contact_number?: string
    first_name?: string
    last_name?: string
  } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RESIDENTS_PER_PAGE = 10

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
  treasurer: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  resident: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  treasurer: 'Treasurer',
  resident: 'Resident',
}

// ─── Avatar Helper ────────────────────────────────────────────────────────────

function Avatar({ user, size = 8 }: { user: { full_name: string; avatar_url?: string }; size?: number }) {
  const cls = `w-${size} h-${size}`
  return user.avatar_url ? (
    <img
      src={user.avatar_url}
      alt={user.full_name}
      className={`${cls} rounded-lg object-cover border border-slate-700 shadow-sm`}
    />
  ) : (
    <div className={`${cls} bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
      {user.full_name?.charAt(0)?.toUpperCase()}
    </div>
  )
}

// ─── Resident Profile Modal ───────────────────────────────────────────────────

function ResidentProfileModal({ resident, onClose }: { resident: ResidentUser; onClose: () => void }) {
  const ben = resident.beneficiary
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-700/50 bg-[#0f1624] shadow-2xl p-6 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar user={resident} size={12} />
          <div>
            <h3 className="text-lg font-bold text-white">{resident.full_name}</h3>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${ROLE_COLORS.resident}`}>
              Resident
            </span>
          </div>
        </div>

        {/* Info rows */}
        <div className="space-y-3 text-sm">
          <InfoRow label="Email" value={resident.email || '—'} />
          <InfoRow label="Contact Number" value={resident.contact_number || '—'} />
          <InfoRow
            label="Status"
            value={resident.is_active ? 'Active' : 'Inactive'}
            valueClass={resident.is_active ? 'text-emerald-400' : 'text-red-400'}
          />
          <InfoRow label="Registered On" value={format(new Date(resident.created_at), 'MMMM d, yyyy')} />

          {ben && (
            <>
              <div className="border-t border-slate-700/50 pt-3 mt-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Beneficiary Details</p>
              </div>
              <InfoRow label="Address" value={ben.address || '—'} />
              <InfoRow label="Barangay" value={ben.barangay || '—'} />
              <InfoRow label="Date of Birth" value={ben.birthdate ? format(new Date(ben.birthdate), 'MMMM d, yyyy') : '—'} />
              <InfoRow label="Civil Status" value={ben.civil_status || '—'} />
              <InfoRow label="Sex" value={ben.sex || '—'} />
            </>
          )}

          {!ben && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
              <Info size={14} />
              <span>No beneficiary profile linked to this account yet.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, valueClass = 'text-slate-200' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-400 shrink-0 w-36">{label}</span>
      <span className={`font-medium text-right ${valueClass}`}>{value}</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const supabase = createClient()
  const { t } = useLanguage()

  // ── State: Data ──────────────────────────────────────────────────────────
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [residents, setResidents] = useState<ResidentUser[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // ── State: Staff Section ─────────────────────────────────────────────────
  const [staffSearch, setStaffSearch] = useState('')
  const [staffStatusFilter, setStaffStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showStaffForm, setShowStaffForm] = useState(false)
  const [staffForm, setStaffForm] = useState({ email: '', full_name: '', password: '', role: 'admin' })
  const [savingStaff, setSavingStaff] = useState(false)
  const [staffError, setStaffError] = useState('')

  // ── State: Resident Section ──────────────────────────────────────────────
  const [residentSearch, setResidentSearch] = useState('')
  const [residentStatusFilter, setResidentStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [residentPage, setResidentPage] = useState(1)
  const [viewingResident, setViewingResident] = useState<ResidentUser | null>(null)

  // ── Load Data ────────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    const res = await fetch('/api/users')
    if (res.ok) {
      const json = await res.json()
      setStaff(json.staff ?? [])
      setResidents(json.residents ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // ── Filtered Staff ───────────────────────────────────────────────────────
  const filteredStaff = useMemo(() => {
    return staff.filter(u => {
      const matchesSearch = !staffSearch ||
        u.full_name.toLowerCase().includes(staffSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(staffSearch.toLowerCase())
      const matchesStatus =
        staffStatusFilter === 'all' ||
        (staffStatusFilter === 'active' && u.is_active) ||
        (staffStatusFilter === 'inactive' && !u.is_active)
      return matchesSearch && matchesStatus
    })
  }, [staff, staffSearch, staffStatusFilter])

  // ── Filtered & Paginated Residents ───────────────────────────────────────
  const filteredResidents = useMemo(() => {
    return residents.filter(u => {
      const matchesSearch = !residentSearch ||
        u.full_name.toLowerCase().includes(residentSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(residentSearch.toLowerCase()) ||
        (u.contact_number || '').includes(residentSearch)
      const matchesStatus =
        residentStatusFilter === 'all' ||
        (residentStatusFilter === 'active' && u.is_active) ||
        (residentStatusFilter === 'inactive' && !u.is_active)
      return matchesSearch && matchesStatus
    })
  }, [residents, residentSearch, residentStatusFilter])

  const totalResidentPages = Math.max(1, Math.ceil(filteredResidents.length / RESIDENTS_PER_PAGE))
  const pagedResidents = filteredResidents.slice(
    (residentPage - 1) * RESIDENTS_PER_PAGE,
    residentPage * RESIDENTS_PER_PAGE
  )

  // Reset page on filter change
  useEffect(() => { setResidentPage(1) }, [residentSearch, residentStatusFilter])

  // ── Actions ──────────────────────────────────────────────────────────────
  const toggleActive = async (id: string, current: boolean, isResident: boolean) => {
    const newState = !current
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: newState }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(`Failed to update status: ${err.error}`)
      return
    }
    if (isResident) {
      setResidents(prev => prev.map(u => u.id === id ? { ...u, is_active: newState } : u))
    } else {
      setStaff(prev => prev.map(u => u.id === id ? { ...u, is_active: newState } : u))
    }

    // Audit log
    const { data: { user: admin } } = await supabase.auth.getUser()
    if (admin) {
      await supabase.from('system_logs').insert({
        user_id: admin.id,
        action: newState ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        table_name: 'profiles',
        record_id: id,
      })

      // Notify admin on resident activation
      if (isResident && newState) {
        await supabase.from('notifications').insert({
          user_id: admin.id,
          title: 'Activate Resident',
          message: 'You have successfully approved and activated a resident account.',
          type: 'info',
        })
      }
    }
  }

  const updateStaffRole = async (id: string, role: string) => {
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(`Failed to update role: ${err.error}`)
      return
    }
    setStaff(prev => prev.map(u => u.id === id ? { ...u, role: role as any } : u))

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('system_logs').insert({
        user_id: user.id,
        action: 'UPDATE_ROLE',
        table_name: 'profiles',
        record_id: id,
        details: { new_role: role },
      })
    }
  }

  const createStaffUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingStaff(true)
    setStaffError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(staffForm),
    })
    const json = await res.json()
    if (!res.ok) {
      setStaffError(json.error)
      setSavingStaff(false)
      return
    }
    setShowStaffForm(false)
    setStaffForm({ email: '', full_name: '', password: '', role: 'admin' })
    await loadData()
    setSavingStaff(false)
  }

  const deleteUser = async (id: string, name: string, isResident: boolean) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}"? This action cannot be undone.`)) return
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        alert(`Failed to delete user: ${err.error}`)
        return
      }
      if (isResident) {
        setResidents(prev => prev.filter(u => u.id !== id))
      } else {
        setStaff(prev => prev.filter(u => u.id !== id))
      }
      if (currentUser) {
        await supabase.from('system_logs').insert({
          user_id: currentUser.id,
          action: 'DELETE_USER',
          table_name: 'profiles',
          record_id: id,
        })
      }
    } catch {
      alert('An unexpected error occurred while deleting the user.')
    }
  }

  // ── Derived Summary Stats ────────────────────────────────────────────────
  const activeStaff = staff.filter(u => u.is_active).length
  const activeResidents = residents.filter(u => u.is_active).length
  const inactiveResidents = residents.filter(u => !u.is_active).length

  // ── Skeleton Rows ────────────────────────────────────────────────────────
  const SkeletonRow = ({ cols }: { cols: number }) => (
    <tr>
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j}><div className="skeleton h-5 w-full" /></td>
      ))}
    </tr>
  )

  // ── Status Filter Buttons ─────────────────────────────────────────────────
  const StatusFilter = ({
    value, onChange
  }: {
    value: 'all' | 'active' | 'inactive'
    onChange: (v: 'all' | 'active' | 'inactive') => void
  }) => (
    <div className="flex p-1 bg-slate-800/60 rounded-lg border border-slate-700/40 gap-0.5">
      {(['all', 'active', 'inactive'] as const).map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
            value === opt
              ? opt === 'active'
                ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
                : opt === 'inactive'
                ? 'bg-red-500/20 text-red-300 shadow-sm'
                : 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {opt === 'all' ? 'All' : opt === 'active' ? 'Active' : 'Inactive'}
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-8" id="users-page">
      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">User Management</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">
          Manage system staff and resident accounts
        </p>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 1 — ADMIN & TREASURER ACCOUNTS
          ════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        {/* Section Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <ShieldCheck size={18} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--color-text)]">Admin & Treasurer Accounts</h2>
              {!loading && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {staff.length} Staff Account{staff.length !== 1 ? 's' : ''} &bull; {activeStaff} Active
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Staff Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
                placeholder="Search staff..."
                className="form-input pl-9 py-2 text-sm h-9 w-52"
                id="staff-search"
              />
            </div>

            {/* Staff Status Filter */}
            <StatusFilter value={staffStatusFilter} onChange={setStaffStatusFilter} />

            {/* Add Staff Button */}
            <button
              onClick={() => setShowStaffForm(!showStaffForm)}
              className="btn btn-primary h-9 text-sm gap-1.5"
              id="add-staff-btn"
            >
              <UserPlus size={15} />
              Add Staff Account
            </button>
          </div>
        </div>

        {/* Add Staff Form */}
        {showStaffForm && (
          <form onSubmit={createStaffUser} className="card p-6 animate-fade-in border border-violet-500/20" id="create-staff-form">
            <div className="flex items-center gap-2 mb-5">
              <Shield size={16} className="text-violet-400" />
              <h3 className="font-semibold text-[var(--color-text)] text-[15px]">Add Staff Account</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 -mt-2">
              Creates an Administrator or Treasurer account with immediate system access.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  value={staffForm.full_name}
                  onChange={e => setStaffForm(f => ({ ...f, full_name: e.target.value }))}
                  required
                  className="form-input"
                  placeholder="e.g. Juan dela Cruz"
                />
              </div>
              <div>
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  value={staffForm.email}
                  onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))}
                  required
                  className="form-input"
                  placeholder="staff@aics.gov.ph"
                />
              </div>
              <div>
                <label className="form-label">Password *</label>
                <input
                  type="password"
                  value={staffForm.password}
                  onChange={e => setStaffForm(f => ({ ...f, password: e.target.value }))}
                  required
                  className="form-input"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="form-label">Role *</label>
                <select
                  value={staffForm.role}
                  onChange={e => setStaffForm(f => ({ ...f, role: e.target.value }))}
                  className="form-input"
                >
                  <option value="admin">Administrator</option>
                  <option value="treasurer">Treasurer</option>
                </select>
              </div>
            </div>
            {staffError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mt-4">
                {staffError}
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <button type="submit" disabled={savingStaff} className="btn btn-primary">
                {savingStaff ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : 'Create Staff Account'}
              </button>
              <button type="button" onClick={() => { setShowStaffForm(false); setStaffError('') }} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Staff Table */}
        <div className="card overflow-hidden">
          <table className="data-table" id="staff-table">
            <thead>
              <tr>
                {['Full Name', 'Role', 'Status', 'Added On', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <ShieldCheck size={36} className="mx-auto mb-3 text-slate-600" />
                    <p className="text-slate-400 text-sm">No staff accounts found</p>
                  </td>
                </tr>
              ) : filteredStaff.map(u => (
                <tr key={u.id}>
                  {/* Full Name */}
                  <td className="font-medium text-[var(--color-text)]">
                    <div className="flex items-center gap-3">
                      <Avatar user={u} />
                      <div>
                        <p className="font-semibold">{u.full_name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td>
                    <select
                      value={u.role}
                      onChange={e => updateStaffRole(u.id, e.target.value)}
                      disabled={currentUser?.id === u.id}
                      className={`border-0 rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer ${ROLE_COLORS[u.role] ?? 'bg-slate-700'} disabled:opacity-70 disabled:cursor-not-allowed`}
                    >
                      <option value="admin">Administrator</option>
                      <option value="treasurer">Treasurer</option>
                    </select>
                  </td>

                  {/* Status */}
                  <td>
                    <span className={`badge ${u.is_active ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Added On */}
                  <td className="text-slate-400 text-xs">{format(new Date(u.created_at), 'MMM d, yyyy')}</td>

                  {/* Actions */}
                  <td>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleActive(u.id, u.is_active, false)}
                        className={`transition-colors ${u.is_active ? 'text-emerald-500 hover:text-emerald-300' : 'text-red-500 hover:text-red-300'}`}
                        title={u.is_active ? 'Deactivate' : 'Activate'}
                        disabled={currentUser?.id === u.id}
                      >
                        {u.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                      {currentUser?.id !== u.id && (
                        <button
                          onClick={() => deleteUser(u.id, u.full_name, false)}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                          title="Delete Staff Account"
                        >
                          <Trash2 size={17} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 2 — RESIDENT ACCOUNTS
          ════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        {/* Section Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Users size={18} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--color-text)]">Resident Accounts</h2>
              {!loading && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {residents.length} Resident Account{residents.length !== 1 ? 's' : ''} &bull;{' '}
                  <span className="text-emerald-400">{activeResidents} Active</span>
                  {inactiveResidents > 0 && (
                    <> &bull; <span className="text-red-400">{inactiveResidents} Inactive</span></>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Resident Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={residentSearch}
                onChange={e => setResidentSearch(e.target.value)}
                placeholder="Search residents..."
                className="form-input pl-9 py-2 text-sm h-9 w-52"
                id="resident-search"
              />
            </div>

            {/* Resident Status Filter */}
            <StatusFilter value={residentStatusFilter} onChange={setResidentStatusFilter} />
          </div>
        </div>

        {/* Info Notice */}
        <div className="flex items-start gap-3 bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-3 text-xs text-slate-400">
          <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />
          <span>
            Resident accounts are created through the{' '}
            <strong className="text-slate-300">Resident Registration / Sign-Up system</strong>,
            not manually through the Staff Account form. Manage existing resident accounts below.
          </span>
        </div>

        {/* Resident Table */}
        <div className="card overflow-hidden">
          <table className="data-table" id="residents-table">
            <thead>
              <tr>
                {['Full Name', 'Contact Number', 'Email', 'Status', 'Registered On', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
              ) : pagedResidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <User size={36} className="mx-auto mb-3 text-slate-600" />
                    <p className="text-slate-400 text-sm">
                      {residentSearch || residentStatusFilter !== 'all'
                        ? 'No residents match your filters'
                        : 'No resident accounts found'}
                    </p>
                  </td>
                </tr>
              ) : pagedResidents.map(u => (
                <tr key={u.id}>
                  {/* Full Name */}
                  <td className="font-medium text-[var(--color-text)]">
                    <div className="flex items-center gap-3">
                      <Avatar user={u} />
                      <span className="font-semibold">{u.full_name}</span>
                    </div>
                  </td>

                  {/* Contact Number */}
                  <td className="text-slate-300 text-sm">
                    {u.contact_number || <span className="text-slate-500">—</span>}
                  </td>

                  {/* Email */}
                  <td className="text-slate-300 text-sm">
                    {u.email || <span className="text-slate-500">—</span>}
                  </td>

                  {/* Status */}
                  <td>
                    <span className={`badge ${u.is_active ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Registered On */}
                  <td className="text-slate-400 text-xs">{format(new Date(u.created_at), 'MMM d, yyyy')}</td>

                  {/* Actions */}
                  <td>
                    <div className="flex items-center gap-3">
                      {/* View Profile */}
                      <button
                        onClick={() => setViewingResident(u)}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                        title="View Profile"
                      >
                        <Eye size={17} />
                      </button>

                      {/* Toggle Active */}
                      <button
                        onClick={() => toggleActive(u.id, u.is_active, true)}
                        className={`transition-colors ${u.is_active ? 'text-emerald-500 hover:text-emerald-300' : 'text-red-500 hover:text-red-300'}`}
                        title={u.is_active ? 'Deactivate Resident' : 'Activate Resident'}
                      >
                        {u.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteUser(u.id, u.full_name, true)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                        title="Delete Resident Account"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filteredResidents.length > RESIDENTS_PER_PAGE && (
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing {((residentPage - 1) * RESIDENTS_PER_PAGE) + 1}–{Math.min(residentPage * RESIDENTS_PER_PAGE, filteredResidents.length)} of {filteredResidents.length} residents
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setResidentPage(p => Math.max(1, p - 1))}
                disabled={residentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700/50 disabled:opacity-40 hover:bg-slate-700 transition-colors"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              {Array.from({ length: totalResidentPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setResidentPage(p)}
                  className={`w-8 h-8 rounded-lg border text-xs font-medium transition-colors ${
                    p === residentPage
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-700/50 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setResidentPage(p => Math.min(totalResidentPages, p + 1))}
                disabled={residentPage === totalResidentPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700/50 disabled:opacity-40 hover:bg-slate-700 transition-colors"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Resident Profile Modal ─────────────────────────────────────────── */}
      {viewingResident && (
        <ResidentProfileModal
          resident={viewingResident}
          onClose={() => setViewingResident(null)}
        />
      )}
    </div>
  )
}
