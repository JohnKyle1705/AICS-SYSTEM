import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { format } from 'date-fns'
import { Feather } from '@expo/vector-icons'

const STATUS_COLORS: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  Pending:  { bg: '#fef3c7', text: '#92400e', darkBg: '#3d3014', darkText: '#fbbf24' },
  Approved: { bg: '#dbeafe', text: '#1e40af', darkBg: '#142c3d', darkText: '#60a5fa' },
  Released: { bg: '#d1fae5', text: '#065f46', darkBg: '#143d2c', darkText: '#34d399' },
  Declined: { bg: '#fee2e2', text: '#991b1b', darkBg: '#3d1414', darkText: '#f87171' },
}

export default function RequestsScreen({ route, navigation }: any) {
  const [requests, setRequests] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [typeFilter, setTypeFilter] = useState<string>('All')
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
      .select('*, beneficiaries(first_name, last_name, barangay, contact_number), payouts(release_date, amount_released)')
      .order('created_at', { ascending: false })

    if (statusFilter && statusFilter !== 'All') {
      query = query.eq('status', statusFilter)
    }

    if (typeFilter && typeFilter !== 'All') {
      query = query.eq('assistance_type', typeFilter)
    }

    if (profile?.role === 'resident') {
      query = query.eq('encoded_by', user?.id)
    }

    const { data } = await query

    const filtered = search.trim()
      ? (data ?? []).filter((r: any) => {
          const q = search.toLowerCase().trim()
          const benName = `${r.beneficiaries?.first_name || ''} ${r.beneficiaries?.last_name || ''}`.toLowerCase()
          const refNo = `ref-${(r.id || '').slice(0, 8)}`.toLowerCase()
          const fullId = (r.id || '').toLowerCase()
          const purpose = (r.purpose || '').toLowerCase()
          return benName.includes(q) || refNo.includes(q) || fullId.includes(q) || purpose.includes(q)
        })
      : (data ?? [])
    setRequests(filtered)
    setLoading(false)
  }, [search, statusFilter, typeFilter])

  useEffect(() => { load() }, [load])

  // Real-time synchronization when requests change in database
  useEffect(() => {
    const channel = supabase
      .channel('mobile_requests_screen_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        load()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  useEffect(() => {
    if (route.params?.statusFilter) {
      setStatusFilter(route.params.statusFilter)
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
            }
            setLoading(false)
          }
        }
      ]
    )
  }

  const s = styles(colors, isDark)

  const getScreenTitle = () => {
    if (userRole === 'treasurer') return 'All Requests (Treasury)'
    if (userRole === 'resident') return t('dashboard_myRequests') || 'My Requests'
    return t('requests_title') || 'All Requests'
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>{getScreenTitle()}</Text>
          <Text style={s.subtitle}>
            {userRole === 'treasurer' ? 'Financial oversight & tracking' : `${requests.length} total records`}
          </Text>
        </View>
        {userRole === 'resident' && (
          <TouchableOpacity style={s.addBtn} onPress={() => navigation.navigate('RequestForm')} activeOpacity={0.8}>
            <Text style={s.addBtnText}>+ {t('requests_new')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Input */}
      <TextInput
        style={s.search}
        placeholder="Search beneficiary, Ref #, ID..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor={colors.textSecondary}
      />

      {/* Status Filter Chips */}
      <View style={{ paddingBottom: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {['All', 'Pending', 'Approved', 'Released', 'Declined'].map(st => (
            <TouchableOpacity 
              key={st} 
              style={[s.filterChip, statusFilter === st && s.filterChipActive]}
              onPress={() => setStatusFilter(st)}
              activeOpacity={0.7}
            >
              <Text style={[s.filterChipText, statusFilter === st && s.filterChipTextActive]}>
                {st}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Assistance Type Filter Chips */}
      <View style={{ paddingBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {[
            { key: 'All', label: 'All Types' },
            { key: 'Medical', label: 'Medical Assistance' },
            { key: 'Burial', label: 'Burial Assistance' },
          ].map(tp => (
            <TouchableOpacity
              key={tp.key}
              style={[s.subFilterChip, typeFilter === tp.key && s.subFilterChipActive]}
              onPress={() => setTypeFilter(tp.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.subFilterChipText, typeFilter === tp.key && s.subFilterChipTextActive]}>
                {tp.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Request List */}
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={load}
        contentContainerStyle={{ paddingBottom: 30 }}
        renderItem={({ item }) => {
          const c = STATUS_COLORS[item.status] ?? STATUS_COLORS.Pending
          const refNo = `REF-${item.id.slice(0, 8).toUpperCase()}`
          const requestedAmt = item.amount_requested
            ? `₱${Number(item.amount_requested).toLocaleString()}`
            : (item.extra_fields?.estimated_cost ? `₱${Number(item.extra_fields.estimated_cost).toLocaleString()}` : (item.extra_fields?.amount_range || '—'))
          const approvedAmt = item.amount_approved ? `₱${Number(item.amount_approved).toLocaleString()}` : '—'
          const releaseDate = item.payouts?.[0]?.release_date
            ? format(new Date(item.payouts[0].release_date), 'MMM d, yyyy')
            : (item.status === 'Released' ? 'Released' : '—')

          return (
            <TouchableOpacity
              style={s.card}
              onPress={() => navigation.navigate('RequestDetail', { id: item.id })}
              activeOpacity={0.7}
            >
              {/* Header: Ref & Status */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.refText}>{refNo}</Text>
                  <Text style={s.cardName}>{item.beneficiaries?.last_name}, {item.beneficiaries?.first_name}</Text>
                  <Text style={s.cardSub}>{item.beneficiaries?.barangay || 'Daanbantayan'} • {item.assistance_type} Assistance</Text>
                </View>
                <View style={[s.badge, { backgroundColor: isDark ? c.darkBg : c.bg }]}>
                  <Text style={[s.badgeText, { color: isDark ? c.darkText : c.text }]}>
                    {item.status}
                  </Text>
                </View>
              </View>

              {/* Purpose */}
              {item.purpose ? (
                <Text style={s.purpose} numberOfLines={2}>
                  <Text style={{ fontWeight: '600' }}>Purpose: </Text>{item.purpose}
                </Text>
              ) : null}

              {/* Financial Box */}
              <View style={s.financeBox}>
                <View style={{ flex: 1 }}>
                  <Text style={s.financeLabel}>REQUESTED</Text>
                  <Text style={s.financeVal}>{requestedAmt}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.financeLabel}>APPROVED</Text>
                  <Text style={[s.financeVal, { color: item.amount_approved ? '#10b981' : colors.textSecondary }]}>
                    {approvedAmt}
                  </Text>
                </View>
                {releaseDate !== '—' && (
                  <View style={{ flex: 1 }}>
                    <Text style={s.financeLabel}>RELEASED</Text>
                    <Text style={[s.financeVal, { color: '#059669', fontSize: 11 }]}>{releaseDate}</Text>
                  </View>
                )}
              </View>

              {/* Declined reason */}
              {item.status === 'Declined' && !!item.remarks && (
                <Text style={{ fontSize: 12, color: '#ef4444', fontStyle: 'italic', marginTop: 6 }} numberOfLines={2}>
                  Reason: {item.remarks}
                </Text>
              )}

              {/* Footer */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: isDark ? '#334155' : '#f1f5f9' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Feather name="calendar" size={12} color={colors.textSecondary} />
                  <Text style={s.date}>{format(new Date(item.created_at), 'MMM d, yyyy')}</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>
                    View Details →
                  </Text>

                  {(userRole === 'admin' || (userRole === 'resident' && item.status === 'Pending')) && (
                    <TouchableOpacity 
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Feather name="trash-2" size={15} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={!loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Feather name="file-text" size={36} color={colors.textSecondary} style={{ opacity: 0.5, marginBottom: 8 }} />
            <Text style={s.empty}>{t('requests_noRequestsFound') || 'No requests found.'}</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>Try clearing or changing your filters</Text>
          </View>
        ) : null}
      />
    </View>
  )
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 6 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  search: { marginHorizontal: 20, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, fontSize: 13, color: colors.text, marginBottom: 10, backgroundColor: colors.card },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  filterChipTextActive: { color: '#fff' },
  subFilterChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderWidth: 1, borderColor: colors.border },
  subFilterChipActive: { backgroundColor: isDark ? '#334155' : '#e2e8f0', borderColor: colors.primary },
  subFilterChipText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  subFilterChipTextActive: { color: colors.primary },
  card: { backgroundColor: colors.card, marginHorizontal: 20, marginBottom: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: colors.border },
  refText: { fontSize: 10, fontFamily: 'monospace', fontWeight: '700', color: colors.primary, marginBottom: 2 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  purpose: { fontSize: 12, color: colors.textSecondary, marginTop: 6, lineHeight: 17 },
  financeBox: { flexDirection: 'row', backgroundColor: isDark ? '#0f172a' : '#f8fafc', padding: 8, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: colors.border },
  financeLabel: { fontSize: 9, fontWeight: '700', color: colors.textSecondary, marginBottom: 2 },
  financeVal: { fontSize: 13, fontWeight: '700', color: colors.text },
  date: { fontSize: 11, color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
})
