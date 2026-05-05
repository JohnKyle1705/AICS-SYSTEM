'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { format } from 'date-fns'
import { UserPlus, ToggleLeft, ToggleRight, Loader2, Users, Trash2 } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'staff' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'staff'>('all')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const { t } = useLanguage()
  const supabase = createClient()

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setUsers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleActive = async (id: string, current: boolean) => {
    const newState = !current
    await supabase.from('profiles').update({ is_active: newState }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: newState } : u))
    
    // Log action
    const { data: { user: adminUser } } = await supabase.auth.getUser()
    if (adminUser) {
      await supabase.from('system_logs').insert({
        user_id: adminUser.id,
        action: newState ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        table_name: 'profiles',
        record_id: id
      })
    }

    // Notify user if activated
    if (newState) {
      await supabase.from('notifications').insert({
        user_id: id,
        title: t('users_activateConfirm'),
        message: t('users_activateMsg'),
        type: 'info'
      })
    }
  }

  const updateRole = async (id: string, role: string) => {
    await supabase.from('profiles').update({ role }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role: role as any } : u))
    
    // Log action
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('system_logs').insert({
        user_id: user.id,
        action: 'UPDATE_ROLE',
        table_name: 'profiles',
        record_id: id,
        details: { new_role: role }
      })
    }
  }

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShowForm(false)
    setForm({ email: '', full_name: '', password: '', role: 'staff' })
    load()
    setSaving(false)
  }

  const deleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${name}? This action cannot be undone.`)) return

    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const error = await res.json()
        alert(`Failed to delete user: ${error.error}`)
        return
      }

      setUsers(prev => prev.filter(u => u.id !== id))
      
      // Log action
      if (currentUser) {
        await supabase.from('system_logs').insert({
          user_id: currentUser.id,
          action: 'DELETE_USER',
          table_name: 'profiles',
          record_id: id
        })
      }
    } catch (err) {
      alert('An unexpected error occurred while deleting the user.')
    }
  }

  const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-violet-100/50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    staff: 'bg-blue-100/50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    encoder: 'bg-slate-100/50 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
    resident: 'bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  }

  return (
    <div className="space-y-5" id="users-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t('users_title')}</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">{users.length} {t('users_active').toLowerCase()}</p>
        </div>
        <div className="flex gap-2">
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button onClick={() => setFilter('all')} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${filter === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500'}`}>{t('reports_allIncluded')}</button>
            <button onClick={() => setFilter('pending')} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${filter === 'pending' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600' : 'text-slate-500'}`}>{t('users_pending')}</button>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary" id="add-user-btn">
            <UserPlus size={16} /> {t('users_addModalTitle')}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={createUser} className="card p-6 animate-fade-in" id="create-user-form">
          <h2 className="font-semibold text-[var(--color-text)] mb-5 text-[15px]">{t('users_addModalTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">{t('users_fullName')} *</label>
              <input type="text" value={form.full_name}
                onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} required className="form-input" placeholder={t('settings_fullNamePlaceholder')} />
            </div>
            <div>
              <label className="form-label">{t('users_email')} *</label>
              <input type="email" value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required className="form-input" placeholder={t('newRequest_emailPlaceholder')} />
            </div>
            <div>
              <label className="form-label">Password *</label>
              <input type="password" value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} required className="form-input" placeholder="••••••••" />
            </div>
            <div>
              <label className="form-label">Role *</label>
              <select value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))} className="form-input">
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </div>
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mt-4">{error}</div>}
          <div className="flex gap-3 mt-5">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <><Loader2 size={16} className="animate-spin" /> {t('loading')}...</> : t('users_createBtn')}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">{t('cancel_action')}</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="data-table" id="users-table">
          <thead>
            <tr>
              {[t('users_fullName'), t('users_role'), t('requests_status'), t('ben_addedOn'), t('actions')].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j}><div className="skeleton h-5 w-full" /></td>)}</tr>
              ))
            ) : users.filter(u => {
              if (filter === 'pending') return !u.is_active
              return true
            }).length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12">
                  <Users size={36} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-400 text-sm">{t('users_noActive')}</p>
                </td>
              </tr>
            ) : users.filter(u => {
              if (filter === 'pending') return !u.is_active
              return true
            }).map((u) => (
              <tr key={u.id}>
                <td className="font-medium text-[var(--color-text)]">
                  <div className="flex items-center gap-3">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.full_name} className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-sm" />
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm">
                        {u.full_name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    {u.full_name}
                  </div>
                </td>
                <td>
                  <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value)}
                    className={`border-0 rounded-lg px-3 py-1 text-xs font-semibold capitalize cursor-pointer ${ROLE_COLORS[u.role] ?? 'bg-slate-100'}`}>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="resident">Resident</option>
                  </select>
                </td>
                <td>
                  <span className={`badge ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {u.is_active ? t('users_active') : t('users_inactive')}
                  </span>
                </td>
                <td className="text-slate-500 text-xs">{format(new Date(u.created_at), 'MMM d, yyyy')}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleActive(u.id, u.is_active)}
                      className={`transition-colors ${u.is_active ? 'text-emerald-600 hover:text-emerald-800' : 'text-red-500 hover:text-red-700'}`}
                      title={u.is_active ? 'Deactivate User' : 'Activate User'}>
                      {u.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                    {currentUser?.id !== u.id && (
                      <button onClick={() => deleteUser(u.id, u.full_name)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete User">
                        <Trash2 size={18} />
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
  )
}
