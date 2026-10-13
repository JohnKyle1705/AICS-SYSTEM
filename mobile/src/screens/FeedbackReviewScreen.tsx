import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { Feather } from '@expo/vector-icons'

type TabType = 'feedbacks' | 'tickets'

export default function FeedbackReviewScreen({ navigation }: any) {
  const { colors, isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<TabType>('feedbacks')
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = async () => {
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

  const onRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  const updateTicketStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('support_tickets').update({ status: newStatus }).eq('id', id)
    if (!error) {
      setTickets(tickets.map(t => t.id === id ? { ...t, status: newStatus } : t))
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return { bg: isDark ? '#3d3014' : '#fef3c7', text: isDark ? '#fbbf24' : '#d97706' }
      case 'In Progress': return { bg: isDark ? '#1e3a8a40' : '#dbeafe', text: isDark ? '#60a5fa' : '#2563eb' }
      case 'Resolved': return { bg: isDark ? '#064e3b40' : '#d1fae5', text: isDark ? '#34d399' : '#059669' }
      case 'Closed': return { bg: isDark ? '#334155' : '#f1f5f9', text: isDark ? '#94a3b8' : '#64748b' }
      default: return { bg: isDark ? '#334155' : '#f1f5f9', text: isDark ? '#94a3b8' : '#64748b' }
    }
  }

  const s = styles(colors)

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={s.container}>
      <View style={s.tabContainer}>
        <TouchableOpacity style={[s.tab, activeTab === 'feedbacks' && s.activeTab]} onPress={() => setActiveTab('feedbacks')}>
          <Feather name="heart" size={16} color={activeTab === 'feedbacks' ? colors.primary : colors.textSecondary} />
          <Text style={[s.tabText, activeTab === 'feedbacks' && s.activeTabText]}>Feedbacks ({feedbacks.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === 'tickets' && s.activeTab]} onPress={() => setActiveTab('tickets')}>
          <Feather name="message-square" size={16} color={activeTab === 'tickets' ? colors.primary : colors.textSecondary} />
          <Text style={[s.tabText, activeTab === 'tickets' && s.activeTabText]}>Tickets ({tickets.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {activeTab === 'feedbacks' && (
          feedbacks.length === 0 ? (
            <Text style={s.emptyText}>No feedbacks yet.</Text>
          ) : (
            feedbacks.map(f => (
              <View key={f.id} style={s.card}>
                <View style={s.cardHeader}>
                  <View>
                    <Text style={s.userName}>{f.profiles?.full_name || 'Unknown'}</Text>
                    <Text style={s.userRole}>{f.profiles?.role || 'Resident'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <Feather key={star} name="star" size={14} color={star <= f.rating ? '#facc15' : colors.border} />
                    ))}
                  </View>
                </View>
                <Text style={s.dateText}>{new Date(f.created_at).toLocaleDateString()}</Text>
                {f.comments ? (
                  <Text style={s.commentText}>"{f.comments}"</Text>
                ) : (
                  <Text style={[s.commentText, { fontStyle: 'italic', color: colors.textSecondary }]}>No comments.</Text>
                )}
              </View>
            ))
          )
        )}

        {activeTab === 'tickets' && (
          tickets.length === 0 ? (
            <Text style={s.emptyText}>No support tickets.</Text>
          ) : (
            tickets.map(t => {
              const statusStyle = getStatusColor(t.status)
              return (
                <View key={t.id} style={s.card}>
                  <View style={s.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.userName}>{t.profiles?.full_name || 'Unknown'}</Text>
                      <Text style={s.userRole}>{t.profiles?.role || 'Resident'} • {t.concern_type}</Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: statusStyle.bg }]}>
                      <Text style={[s.statusText, { color: statusStyle.text }]}>{t.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={s.dateText}>{new Date(t.created_at).toLocaleDateString()}</Text>
                  <Text style={s.commentText}>{t.message}</Text>

                  <View style={s.actions}>
                    {['Open', 'In Progress', 'Resolved', 'Closed'].map(status => (
                      <TouchableOpacity 
                        key={status} 
                        style={[s.actionBtn, t.status === status && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={() => updateTicketStatus(t.id, status)}
                      >
                        <Text style={[s.actionBtnText, t.status === status && { color: '#fff' }]}>{status}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )
            })
          )
        )}
      </ScrollView>
    </View>
  )
}

const styles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  activeTabText: { color: colors.primary },
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  userName: { fontSize: 15, fontWeight: '700', color: colors.text },
  userRole: { fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' },
  dateText: { fontSize: 11, color: colors.textSecondary, marginBottom: 12 },
  commentText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  emptyText: { textAlign: 'center', color: colors.textSecondary, marginTop: 40, fontSize: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  actionBtnText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
})
