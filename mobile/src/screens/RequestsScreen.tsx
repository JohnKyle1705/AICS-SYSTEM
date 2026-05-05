import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { format } from 'date-fns'
import { Feather } from '@expo/vector-icons'

const STATUS_COLORS: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  Pending: { bg: '#fef3c7', text: '#92400e', darkBg: '#3d3014', darkText: '#fbbf24' },
  Approved: { bg: '#dbeafe', text: '#1e40af', darkBg: '#142c3d', darkText: '#60a5fa' },
  Released: { bg: '#d1fae5', text: '#065f46', darkBg: '#143d2c', darkText: '#34d399' },
  Declined: { bg: '#fee2e2', text: '#991b1b', darkBg: '#3d1414', darkText: '#f87171' },
}

export default function RequestsScreen({ route, navigation }: any) {
  const [requests, setRequests] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
    if (profile) setUserRole(profile.role)

    let query = supabase.from('requests')
      .select('*, beneficiaries(first_name, last_name, barangay)')
      .order('created_at', { ascending: false })

    if (statusFilter !== 'All') {
      query = query.eq('status', statusFilter)
    }

    if (profile?.role === 'resident') {
      query = query.eq('encoded_by', user?.id)
    }

    const { data } = await query

    const filtered = search
      ? (data ?? []).filter((r: any) => `${r.beneficiaries?.first_name} ${r.beneficiaries?.last_name}`.toLowerCase().includes(search.toLowerCase()))
      : (data ?? [])
    setRequests(filtered)
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (route.params?.statusFilter) {
      setStatusFilter(route.params.statusFilter)
      // Clear the param so it doesn't force this filter continuously if navigated to normally
      navigation.setParams({ statusFilter: undefined })
    }
  }, [route.params?.statusFilter])

  const handleDelete = (id: string) => {
    Alert.alert(
      t('requests_deleteConfirmTitle') || 'Delete Request',
      t('requests_deleteConfirm') || 'Are you sure you want to delete this request?\nThis action cannot be undone.',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        { 
          text: t('delete') || 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true)
            const { error } = await supabase.from('requests').delete().eq('id', id)
            if (error) {
              Alert.alert(t('error') || 'Error', error.message)
            } else {
              setRequests(prev => prev.filter(r => r.id !== id))
              // Optional success toast/alert
            }
            setLoading(false)
          }
        }
      ]
    )
  }

  const s = styles(colors)

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{t('requests_title')}</Text>
        {userRole === 'resident' && (
          <TouchableOpacity style={s.addBtn} onPress={() => navigation.navigate('RequestForm')} activeOpacity={0.8}>
            <Text style={s.addBtnText}>+ {t('requests_new')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput style={s.search} placeholder={t('requests_search')} value={search}
        onChangeText={setSearch} placeholderTextColor={colors.textSecondary} />

      <View style={{ paddingBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {['All', 'Pending', 'Approved', 'Released', 'Declined'].map(status => (
            <TouchableOpacity 
              key={status} 
              style={[s.filterChip, statusFilter === status && s.filterChipActive]}
              onPress={() => setStatusFilter(status)}
              activeOpacity={0.7}
            >
              <Text style={[s.filterChipText, statusFilter === status && s.filterChipTextActive]}>{status === 'All' ? t('dashboard_totalRequests').split(' ')[0] : t('dashboard_' + status.toLowerCase()) || status}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={load}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => {
          const c = STATUS_COLORS[item.status] ?? STATUS_COLORS.Pending
          return (
            <TouchableOpacity style={s.card}
              onPress={() => navigation.navigate('RequestDetail', { id: item.id })} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName}>{item.beneficiaries?.last_name}, {item.beneficiaries?.first_name}</Text>
                  <Text style={s.cardSub}>{item.beneficiaries?.barangay} • {item.assistance_type}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: isDark ? c.darkBg : c.bg }]}>
                  <Text style={[s.badgeText, { color: isDark ? c.darkText : c.text }]}>{t('dashboard_' + item.status.toLowerCase()) || item.status}</Text>
                </View>
              </View>
              <Text style={s.purpose} numberOfLines={1}>{item.purpose}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
                <Text style={s.amount}>
                  {item.amount_requested ? `₱${Number(item.amount_requested).toLocaleString()}` : '—'}
                </Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={s.date}>{format(new Date(item.created_at), 'MMM d, yyyy')}</Text>
                  {(userRole === 'admin' || userRole === 'staff' || userRole === 'resident') && (
                    <TouchableOpacity 
                      onPress={(e) => {
                        e.stopPropagation(); // prevent navigation
                        handleDelete(item.id);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Feather name="trash-2" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={!loading ? <Text style={s.empty}>{t('requests_noRequestsFound')}</Text> : null}
      />
    </View>
  )
}

const styles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 6 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  search: { marginHorizontal: 20, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: colors.text, marginBottom: 12, backgroundColor: colors.card },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  filterChipTextActive: { color: '#fff' },
  card: { backgroundColor: colors.card, marginHorizontal: 20, marginBottom: 10, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: colors.border },
  cardName: { fontSize: 15, fontWeight: '600', color: colors.text },
  cardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  purpose: { fontSize: 13, color: colors.textSecondary, marginTop: 8 },
  amount: { fontSize: 14, fontWeight: '600', color: colors.text },
  date: { fontSize: 12, color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40, fontSize: 14 },
})
