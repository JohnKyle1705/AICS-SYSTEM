import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { Feather } from '@expo/vector-icons'
import { format } from 'date-fns'

export default function AuditLogsScreen() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { colors, isDark } = useTheme()

  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('system_logs')
        .select(`
          id, action, table_name, created_at,
          profiles (full_name, role)
        `)
        .order('created_at', { ascending: false })
        .limit(50)
      
      setLogs(data || [])
      setLoading(false)
    }
    fetchLogs()
  }, [])

  const getActionIcon = (action: string) => {
    if (action.includes('CREATE') || action.includes('INSERT')) return 'plus-circle'
    if (action.includes('UPDATE') || action.includes('ACTIVATE')) return 'edit-2'
    if (action.includes('DELETE')) return 'trash-2'
    if (action.includes('LOGIN')) return 'log-in'
    return 'activity'
  }

  const getActionColor = (action: string) => {
    if (action.includes('DELETE')) return '#ef4444' // red
    if (action.includes('ACTIVATE')) return '#10b981' // green
    if (action.includes('CREATE')) return '#2563eb' // blue
    return '#64748b' // gray
  }

  const formatActionName = (action: string) => {
    return action.replace(/_/g, ' ')
  }

  const s = styles(colors)

  if (loading) {
    return (
      <View style={s.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={s.container}>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Text style={s.emptyText}>No audit logs found</Text>
          </View>
        }
        renderItem={({ item }) => {
          const user = item.profiles ? item.profiles.full_name : 'Unknown User'
          const role = item.profiles ? item.profiles.role : ''
          const color = getActionColor(item.action)

          return (
            <View style={s.logCard}>
              <View style={[s.iconBox, { backgroundColor: color + '15' }]}>
                <Feather name={getActionIcon(item.action)} size={20} color={color} />
              </View>
              <View style={s.logDetails}>
                <View style={s.logHeader}>
                  <Text style={s.actionText}>{formatActionName(item.action)}</Text>
                  <Text style={s.timeText}>
                    {format(new Date(item.created_at), 'MMM d, h:mm a')}
                  </Text>
                </View>
                <Text style={s.userText}>
                  By: <Text style={s.userName}>{user}</Text>
                  {role ? ` (${role})` : ''}
                </Text>
                {item.table_name && (
                  <Text style={s.tableText}>Table: {item.table_name}</Text>
                )}
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  listContent: { padding: 16, gap: 12 },
  logCard: { flexDirection: 'row', backgroundColor: colors.card, padding: 16, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: colors.border },
  iconBox: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  logDetails: { flex: 1, justifyContent: 'center' },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  actionText: { fontSize: 14, fontWeight: '700', color: colors.text },
  timeText: { fontSize: 12, color: colors.textSecondary },
  userText: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
  userName: { fontWeight: '600', color: colors.text },
  tableText: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 15 }
})
