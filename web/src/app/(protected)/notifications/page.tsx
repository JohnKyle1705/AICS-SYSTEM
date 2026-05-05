'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/types'
import { format } from 'date-fns'
import { Bell, CheckCheck, AlertTriangle, Clock, Info, MessageSquare } from 'lucide-react'

const TYPE_STYLES: Record<string, string> = {
  pending: 'bg-amber-50/50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  incomplete: 'bg-red-50/50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  followup: 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  info: 'bg-transparent border-slate-200 dark:border-slate-700',
}

const TYPE_ICONS: Record<string, any> = {
  pending: Clock,
  incomplete: AlertTriangle,
  followup: MessageSquare,
  info: Info,
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('notifications')
      .select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setNotifications(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const unread = notifications.filter(n => !n.is_read).length

  return (
    <div className="space-y-5 max-w-3xl" id="notifications-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Notifications</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">{unread} unread</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">
            <CheckCheck size={16} /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-slate-400 text-sm">No notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const IconComp = TYPE_ICONS[n.type] || Info
            return (
              <div key={n.id}
                className={`border rounded-xl p-4 flex items-start gap-3 transition-all duration-200 ${TYPE_STYLES[n.type]} ${!n.is_read ? 'shadow-sm' : 'opacity-60'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${!n.is_read ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  <IconComp size={14} className={!n.is_read ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--color-text)] text-sm">{n.title}</p>
                  <p className="text-[var(--color-text)] text-sm mt-0.5">{n.message}</p>
                  <p className="text-[var(--color-text-secondary)] text-xs mt-1.5">{format(new Date(n.created_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 flex-shrink-0 font-medium">
                    Mark read
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
