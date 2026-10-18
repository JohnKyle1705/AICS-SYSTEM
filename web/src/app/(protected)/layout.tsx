'use client'

import Sidebar from '@/components/layout/Sidebar'
import { useEffect, useState } from 'react'
import { Clock, Calendar } from 'lucide-react'

function LiveClock() {
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
    <div className="hidden lg:flex items-center gap-6 px-6 py-2 rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-white/20 dark:border-slate-800/50 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
        <Calendar size={14} className="text-blue-500" />
        <span className="text-xs font-medium">{dateStr}</span>
      </div>
      <div className="w-px h-4 bg-[var(--color-border)]" />
      <div className="flex items-center gap-2 text-[var(--color-text)]">
        <Clock size={14} className="text-blue-500" />
        <span className="text-sm font-bold tabular-nums">{timeStr}</span>
      </div>
    </div>
  )
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-abstract bg-overlay overflow-x-hidden">
      <Sidebar />
      {/*
        Mobile: no left margin (sidebar slides in as overlay), pt-[90px] clears the fixed mobile header+date bar.
        lg+: left margin equals the sidebar width CSS variable; top padding resets to normal.
      */}
      <main className="flex-1 min-w-0 transition-all duration-300 ease-out lg:ml-[var(--sidebar-width,260px)] px-3 sm:px-5 md:px-7 pt-[90px] pb-6 lg:pt-5 lg:pb-8">
        <div className="flex justify-end mb-4 lg:mb-6">
          <LiveClock />
        </div>
        <div className="page-enter w-full max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
