'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Heart, Star, Search, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

type TabType = 'feedbacks' | 'tickets'

export default function FeedbacksPage() {
  const [activeTab, setActiveTab] = useState<TabType>('feedbacks')
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const supabase = createClient()

  const loadData = async () => {
    setRefreshing(true)
    
    // Load Feedbacks
    const { data: fData } = await supabase
      .from('feedbacks')
      .select('*, profiles(full_name, role)')
      .order('created_at', { ascending: false })
    
    if (fData) setFeedbacks(fData)

    // Load Tickets
    const { data: tData } = await supabase
      .from('support_tickets')
      .select('*, profiles(full_name, role)')
      .order('created_at', { ascending: false })
    
    if (tData) setTickets(tData)

    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const updateTicketStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('support_tickets').update({ status: newStatus }).eq('id', id)
    if (!error) {
      setTickets(tickets.map(t => t.id === id ? { ...t, status: newStatus } : t))
    }
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star key={star} size={14} className={star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 dark:text-slate-600'} />
        ))}
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700/30'
      case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700/30'
      case 'Resolved': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700/30'
      case 'Closed': return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
      default: return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
    }
  }

  if (loading) return <div className="skeleton h-64 rounded-2xl" />

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">System Feedback</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">Review user feedback and support tickets</p>
        </div>
        <button onClick={loadData} disabled={refreshing} className="btn btn-secondary flex items-center gap-2">
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="flex border-b border-[var(--color-border)] mb-6">
        {[
          { id: 'feedbacks', icon: Heart, label: 'User Feedback', count: feedbacks.length },
          { id: 'tickets', icon: MessageSquare, label: 'Support Tickets', count: tickets.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors relative ${
              activeTab === tab.id 
                ? 'text-blue-600 dark:text-blue-400' 
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            <span className={`ml-1.5 py-0.5 px-2 rounded-full text-[10px] ${
              activeTab === tab.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}>
              {tab.count}
            </span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {activeTab === 'feedbacks' && (
          feedbacks.length === 0 ? (
            <div className="card p-12 flex flex-col items-center justify-center text-center">
              <Heart size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-bold text-[var(--color-text)]">No Feedbacks Yet</h3>
              <p className="text-[var(--color-text-secondary)] text-sm mt-1">When users submit feedback, they will appear here.</p>
            </div>
          ) : (
            feedbacks.map(f => (
              <div key={f.id} className="card p-5 hover:border-blue-200 dark:hover:border-blue-900/50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-[var(--color-text)]">{f.profiles?.full_name || 'Unknown User'}</h4>
                    <p className="text-xs text-[var(--color-text-secondary)] capitalize">{f.profiles?.role || 'Resident'}</p>
                  </div>
                  <div className="text-right">
                    {renderStars(f.rating)}
                    <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 flex items-center justify-end gap-1">
                      <Clock size={10} /> {format(new Date(f.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                </div>
                {f.comments ? (
                  <p className="text-sm text-[var(--color-text)] bg-[var(--color-background)] p-4 rounded-xl border border-[var(--color-border)]">
                    "{f.comments}"
                  </p>
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)] italic">No comments provided.</p>
                )}
              </div>
            ))
          )
        )}

        {activeTab === 'tickets' && (
          tickets.length === 0 ? (
            <div className="card p-12 flex flex-col items-center justify-center text-center">
              <MessageSquare size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-bold text-[var(--color-text)]">No Support Tickets</h3>
              <p className="text-[var(--color-text-secondary)] text-sm mt-1">When users submit support requests, they will appear here.</p>
            </div>
          ) : (
            tickets.map(t => (
              <div key={t.id} className="card p-5 hover:border-blue-200 dark:hover:border-blue-900/50 transition-colors">
                <div className="flex justify-between items-start mb-4 pb-4 border-b border-[var(--color-border)]">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-[var(--color-text)]">{t.profiles?.full_name || 'Unknown User'}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusColor(t.status)}`}>
                        {t.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] capitalize">{t.profiles?.role || 'Resident'} • {t.concern_type}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-[var(--color-text-secondary)] flex items-center justify-end gap-1">
                      <Clock size={10} /> {format(new Date(t.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
                
                <p className="text-sm text-[var(--color-text)] mb-4 whitespace-pre-wrap">{t.message}</p>
                
                <div className="flex items-center justify-between mt-2 pt-4 border-t border-[var(--color-border)]">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">Update Status:</span>
                  <div className="flex gap-2">
                    {['Open', 'In Progress', 'Resolved', 'Closed'].map(status => (
                      <button
                        key={status}
                        onClick={() => updateTicketStatus(t.id, status)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          t.status === status 
                            ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}
