'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient, clearAllSupabaseAuth } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Profile } from '@/types'
import { useTheme } from 'next-themes'
import { useLanguage } from '@/lib/LanguageContext'
import { Language } from '@/lib/i18n/translations'
import {
  LayoutDashboard, Users, FileText, ClipboardList, Wallet,
  Banknote, BarChart2, Bell, UserCog, LogOut, Menu, X,
  ChevronRight, Sun, Moon, Settings, ScrollText, Pin, PinOff, Info, MessageSquare,
  Clock, CalendarDays, Megaphone
} from 'lucide-react'
import Image from 'next/image'

function MobileClockStrip() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return null

  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

  return (
    <div className="flex items-center justify-center gap-4 px-4 pb-2">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
        <CalendarDays size={11} className="opacity-70" />
        {dateStr}
      </span>
      <span className="w-px h-3 bg-[var(--color-border)]" />
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)] tabular-nums">
        <Clock size={11} className="opacity-70" />
        {timeStr}
      </span>
    </div>
  )
}

function SidebarBrandClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return null

  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

  return (
    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
      <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)] tabular-nums">
        <CalendarDays size={9} className="opacity-60" />
        {dateStr}
      </span>
      <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-text-secondary)] tabular-nums">
        <Clock size={9} className="opacity-60" />
        {timeStr}
      </span>
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const { theme, setTheme } = useTheme()
  const { t, language, setLanguage } = useLanguage()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [unread, setUnread] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
    const pinned = localStorage.getItem('sidebar-pinned') === 'true'
    setIsPinned(pinned)
  }, [])

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (isPinned) {
      document.documentElement.classList.remove('sidebar-collapsed')
    } else {
      document.documentElement.classList.add('sidebar-collapsed')
    }
  }, [isPinned])

  const togglePin = () => {
    const newPinned = !isPinned
    setIsPinned(newPinned)
    localStorage.setItem('sidebar-pinned', String(newPinned))
  }

  useEffect(() => {
    let channel: any

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const user = session.user
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
      const { count } = await supabase.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_read', false)
      setUnread(count ?? 0)

      // Purge any lingering channels for this user to avoid subscribing to an already-active channel
      const existing = supabase.getChannels().filter((c: any) => c.topic.includes(`sidebar-notifications-${user.id}`))
      existing.forEach((c: any) => supabase.removeChannel(c))

      channel = supabase.channel(`sidebar-notifications-${user.id}-${Date.now()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
          setUnread(prev => prev + 1)
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload: RealtimePostgresChangesPayload<{ is_read: boolean }>) => {
          if ((payload.new as { is_read: boolean }).is_read && !(payload.old as { is_read: boolean }).is_read) {
            setUnread(prev => Math.max(0, prev - 1))
          }
        })
        .subscribe()
    }
    load()
    
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [])

  const handleLogout = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('system_logs').insert({
          user_id: user.id,
          action: 'LOGOUT',
          table_name: 'auth',
          details: { event: 'User signed out' },
        })
      }
    } catch { /* don't block logout if logging fails */ }
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // ignore
    }
    clearAllSupabaseAuth()
    window.location.href = '/login'
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }



  // Role-based Menu Items
  const menuItems = {
    admin: [
      { href: '/admin/dashboard', label: t('nav_adminDashboard'), icon: LayoutDashboard },
      { href: '/users', label: t('nav_userManagement'), icon: UserCog },
      { href: '/beneficiaries', label: t('nav_beneficiaries'), icon: Users },
      { href: '/requests', label: t('nav_allRequests'), icon: FileText },
      { href: '/assessments', label: t('nav_assessments'), icon: ClipboardList },
      { href: '/payouts', label: t('nav_payouts'), icon: Banknote },
      { href: '/admin/funds', label: 'Fund Tracking', icon: Wallet },
      { href: '/reports', label: t('nav_systemReports'), icon: BarChart2 },
      { href: '/logs', label: t('nav_auditLogs'), icon: ScrollText },
      { href: '/settings/requirements', label: t('nav_requirementsSetup'), icon: ClipboardList },
      { href: '/notifications', label: t('nav_notifications'), icon: Bell },
      { href: '/about', label: t('nav_aboutAICS'), icon: Info },
      { href: '/admin/announcements', label: t('nav_announcements'), icon: Megaphone },
      { href: '/feedbacks', label: t('nav_systemFeedback'), icon: MessageSquare },
      { href: '/settings', label: t('nav_settings'), icon: Settings },
    ],
    resident: [
      { href: '/resident/dashboard', label: t('nav_myDashboard'), icon: LayoutDashboard },
      { href: '/requests', label: t('nav_myRequests'), icon: FileText },
      { href: '/notifications', label: t('nav_notifications'), icon: Bell },
      { href: '/about', label: t('nav_aboutAICS'), icon: Info },
      { href: '/settings', label: t('nav_accountSettings'), icon: Settings },
    ],
    treasurer: [
      { href: '/treasurer', label: t('nav_treasurerDashboard'), icon: LayoutDashboard },
      { href: '/treasurer/requests', label: 'Approved Requests', icon: FileText },
      { href: '/treasurer/funds', label: 'Fund Tracking', icon: Wallet },
      { href: '/treasurer/transactions', label: 'Financial Ledger', icon: ScrollText },
      { href: '/payouts', label: t('nav_payouts'), icon: Banknote },
      { href: '/treasurer/reports', label: 'Financial Reports', icon: BarChart2 },
      { href: '/notifications', label: t('nav_notifications'), icon: Bell },
      { href: '/about', label: t('nav_aboutAICS'), icon: Info },
      { href: '/settings', label: t('nav_settings'), icon: Settings },
    ]
  }

  const filtered = profile ? (menuItems[profile.role as keyof typeof menuItems] || []) : []

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-[var(--sidebar-bg)] backdrop-blur-xl border-b border-[var(--color-border)] z-50">
        <div className="flex items-center h-14 px-4">
          <button
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text)]"
            onClick={() => setOpen(!open)}
            id="sidebar-toggle"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="flex items-center gap-2 ml-3 flex-1">
            <Image src="/aics_logo.png" alt="AICS" width={24} height={24} className="object-contain" />
            <span className="font-semibold text-[var(--color-text)] text-sm">AICS System</span>
          </div>
          {mounted && (
            <div className="flex items-center gap-1.5 mr-2">
              <Link
                href="/notifications"
                className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text)] hover:text-blue-500 transition-colors"
                title="Notifications"
              >
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[var(--sidebar-bg)] animate-pulse" />
                )}
              </Link>
              <button
                onClick={toggleTheme}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text)] hover:text-blue-500 transition-colors"
                title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          )}
        </div>
        {/* Date & Time strip — mobile */}
        <MobileClockStrip />
      </div>

      {/* Overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`sidebar fixed top-0 left-0 h-full h-[100dvh] flex flex-col z-40 transition-all duration-300 ease-out overflow-hidden
          ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} lg:translate-x-0 bg-[var(--sidebar-bg)] border-r border-[var(--color-border)] backdrop-blur-xl
          w-[280px] sm:w-[260px] lg:w-[80px] ${isPinned || isHovered ? 'lg:w-[260px] lg:shadow-2xl' : ''}`}
        id="main-sidebar"
      >
        <div className="w-[260px] flex flex-col h-full">
          {/* Brand */}
          <div className="p-5 pb-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 dark:bg-white/5 rounded-xl border border-blue-400/20 flex flex-shrink-0 items-center justify-center p-1.5">
                <Image src="/aics_logo.png" alt="AICS" width={32} height={32} className="object-contain" priority />
              </div>
              <div className={`flex-1 transition-opacity duration-200 lg:opacity-0 ${isPinned || isHovered ? 'lg:opacity-100' : ''}`}>
                <h1 className="font-bold text-[15px] leading-tight text-[var(--color-text)] whitespace-nowrap">AICS System</h1>
                <p className="text-[var(--color-text-secondary)] text-[11px] mt-0.5 whitespace-nowrap">Daanbantayan MSWD</p>
                <SidebarBrandClock />
              </div>
            </div>

            {mounted && (isPinned || isHovered) && (
              <div className="flex items-center gap-1">
                <button
                  onClick={togglePin}
                  className="hidden lg:flex w-8 h-8 items-center justify-center rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] transition-colors"
                  title={isPinned ? t('unpinSidebar') : t('pinSidebar')}
                >
                  {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                </button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-1">
            {filtered.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  title={(!isPinned && !isHovered) ? label : undefined}
                  className={`sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200
                  ${active
                      ? 'active bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
                    } ${!isPinned && !isHovered ? 'justify-center lg:justify-start' : ''}`}
                  id={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex-shrink-0 flex items-center justify-center w-[18px]">
                    <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                  </div>
                  <span className={`flex-1 whitespace-nowrap transition-opacity duration-200 lg:opacity-0 ${isPinned || isHovered ? 'lg:opacity-100' : ''}`}>{label}</span>
                  {(label === t('nav_notifications') || label === 'Notifications') && unread > 0 && (
                    <span className={`bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 transition-all duration-200
                    ${isPinned || isHovered ? 'w-5 h-5 opacity-100 lg:opacity-100' : 'absolute right-2 top-2 w-2 h-2 opacity-100 lg:w-2 lg:h-2'}`}>
                      <span className={`transition-opacity duration-200 lg:opacity-0 ${isPinned || isHovered ? 'lg:opacity-100' : ''}`}>
                        {unread > 9 ? '9+' : unread}
                      </span>
                    </span>
                  )}
                  {active && <ChevronRight size={14} className={`text-blue-400 transition-opacity duration-200 lg:opacity-0 ${isPinned || isHovered ? 'lg:opacity-100' : ''}`} />}
                </Link>
              )
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex flex-shrink-0 items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm border border-blue-400/10 overflow-hidden relative shadow-inner">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name || 'Profile'} className="w-full h-full object-cover" />
                ) : (
                  profile?.full_name?.charAt(0)?.toUpperCase() || '?'
                )}
              </div>
              <div className={`flex-1 min-w-0 transition-opacity duration-200 lg:opacity-0 ${isPinned || isHovered ? 'lg:opacity-100' : ''}`}>
                <p className="text-sm font-medium truncate text-[var(--color-text)]">{profile?.full_name || 'Loading...'}</p>
                <p className="text-[11px] text-[var(--color-text-secondary)] capitalize">{profile?.role}</p>
              </div>
            </div>
            <div className={`flex items-center ${isPinned || isHovered ? 'justify-between' : 'justify-center'}`}>
              <button
                onClick={handleLogout}
                title={(!isPinned && !isHovered) ? "Sign Out" : undefined}
                className={`flex items-center gap-3 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 text-[13px] px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors`}
                id="logout-button"
              >
                <LogOut size={16} className="flex-shrink-0" />
                <span className={`whitespace-nowrap transition-opacity duration-200 lg:opacity-0 ${isPinned || isHovered ? 'lg:opacity-100' : 'hidden'}`}>{t('signOut')}</span>
              </button>

              {mounted && (isPinned || isHovered) && (
                <div className="flex items-center gap-1">

                  <button
                    onClick={toggleTheme}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] transition-colors"
                    title={t('toggleTheme')}
                  >
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
