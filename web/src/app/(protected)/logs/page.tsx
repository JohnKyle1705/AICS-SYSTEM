'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ScrollText, User, Activity, Clock } from 'lucide-react'

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('system_logs')
        .select('*, profiles(full_name, role)')
        .order('created_at', { ascending: false })
        .limit(100)
      setLogs(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return 'text-emerald-600 dark:text-emerald-400'
    if (action.includes('UPDATE')) return 'text-blue-600 dark:text-blue-400'
    if (action.includes('DEACTIVATE')) return 'text-red-600 dark:text-red-400'
    return 'text-[var(--color-text-secondary)]'
  }

  return (
    <div className="space-y-6" id="logs-page">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">System Audit Logs</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">Track administrative actions and system updates</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {['Timestamp', 'User', 'Action', 'Table', 'Details'].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j}><div className="skeleton h-5 w-full" /></td>)}</tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <ScrollText size={36} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-400 text-sm">No logs found</p>
                  </td>
                </tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="text-[13px]">
                  <td className="whitespace-nowrap text-slate-500">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-slate-400" />
                      {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                    </div>
                  </td>
                  <td className="font-medium">
                    <div className="flex items-center gap-2 text-[var(--color-text)]">
                      <User size={14} className="text-blue-500" />
                      {log.profiles?.full_name || 'System'}
                    </div>
                  </td>
                  <td className={`font-bold uppercase tracking-wider text-[11px] ${getActionColor(log.action)}`}>
                    <div className="flex items-center gap-1.5">
                      <Activity size={12} />
                      {log.action.replace(/_/g, ' ')}
                    </div>
                  </td>
                  <td className="text-slate-400 font-mono text-[11px]">{log.table_name}</td>
                  <td className="max-w-[300px] truncate text-[var(--color-text-secondary)]">
                    {log.details ? JSON.stringify(log.details) : `Record: ${log.record_id?.slice(0, 8)}...`}
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
