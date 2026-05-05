import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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

  const TYPE_BG: Record<string, string> = {
    pending: '#fffbeb', incomplete: '#fef2f2', followup: '#eff6ff', info: '#f8fafc',
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>{unread} unread</Text>
        </View>
        {unread > 0 && (
          <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={load}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: TYPE_BG[item.type] ?? '#f8fafc', opacity: item.is_read ? 0.6 : 1 }]}>
            <View style={styles.cardContent}>
              <View style={[styles.dot, { backgroundColor: item.is_read ? '#d1d5db' : '#3b82f6' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMsg}>{item.message}</Text>
                <Text style={styles.cardDate}>{format(new Date(item.created_at), 'MMM d, yyyy h:mm a')}</Text>
              </View>
              {!item.is_read && (
                <TouchableOpacity onPress={() => markRead(item.id)}>
                  <Text style={styles.readBtn}>Read</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.empty}>No notifications</Text>
          </View>
        ) : null}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  markAll: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  card: { marginHorizontal: 20, marginBottom: 8, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f1f5f9' },
  cardContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  cardMsg: { fontSize: 13, color: '#475569', marginTop: 2 },
  cardDate: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  readBtn: { color: '#2563eb', fontWeight: '600', fontSize: 12 },
  emptyWrap: { alignItems: 'center', marginTop: 60 },
  empty: { color: '#94a3b8', fontSize: 14 },
})
