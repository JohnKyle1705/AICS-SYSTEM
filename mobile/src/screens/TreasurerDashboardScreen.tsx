import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, RefreshControl, ActivityIndicator
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { Feather } from '@expo/vector-icons'
import { format } from 'date-fns'

const RELEASE_STATUSES = ['Pending Release', 'Ready for Release', 'Released']

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: string }> = {
  'Released':          { bg: '#d1fae5', text: '#065f46', icon: 'check-circle'  },
  'Ready for Release': { bg: '#fef3c7', text: '#92400e', icon: 'clock'         },
  'Pending Release':   { bg: '#f1f5f9', text: '#475569', icon: 'loader'        },
}

const FILTER_TABS = ['All', 'Pending Release', 'Ready for Release', 'Released']

type ActiveCard = 'pending' | 'available' | 'released' | null

export default function TreasurerDashboardScreen({ navigation }: any) {
  const [requests, setRequests]         = useState<any[]>([])
  const [funds, setFunds]               = useState<any[]>([])
  const [search, setSearch]             = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [typeFilter, setTypeFilter]     = useState('')
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [profile, setProfile]           = useState<any>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [activeCard, setActiveCard]     = useState<ActiveCard>(null)
  const [activeFund, setActiveFund]     = useState<string | null>(null)

  const { colors, isDark } = useTheme()
  const { t } = useLanguage()

  const formatCurrency = (val: number) =>
    '₱' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user && !profile) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user?.id).single()
      if (p) setProfile(p)
    }

    const { data } = await supabase.from('requests')
      .select('*, beneficiaries(first_name, last_name, barangay)')
      .eq('status', 'Approved')
      .order('created_at', { ascending: false })
    setRequests(data ?? [])

    const { data: fundsData } = await supabase.from('funds').select('*').order('assistance_type')
    if (fundsData) setFunds(fundsData)

    const { count } = await supabase.from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Approved')
      .in('release_status', ['Pending Release', 'Ready for Release'])
    setPendingCount(count ?? 0)

    setLoading(false)
    setRefreshing(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  const handleUpdateReleaseStatus = (id: string, currentStatus: string | null) => {
    const nextIdx = (RELEASE_STATUSES.indexOf(currentStatus || 'Pending Release') + 1) % RELEASE_STATUSES.length
    const newStatus = RELEASE_STATUSES[nextIdx]
    const req = requests.find(r => r.id === id)

    if (newStatus === 'Released' && (!req?.amount_approved || Number(req.amount_approved) <= 0)) {
      Alert.alert('Cannot Release', 'Approved amount is missing or zero. Please ask the Admin to set it first.')
      return
    }

    Alert.alert('Update Release Status', `Change to "${newStatus}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Update', onPress: async () => {
          const { error } = await supabase.from('requests').update({ release_status: newStatus }).eq('id', id)
          if (error) { Alert.alert('Error', error.message); return }

          setRequests(prev => prev.map(r => r.id === id ? { ...r, release_status: newStatus } : r))

          if (newStatus === 'Released') {
            const { data: updatedFunds } = await supabase.from('funds').select('*').order('assistance_type')
            if (updatedFunds) setFunds(updatedFunds)
            setPendingCount(c => Math.max(0, c - 1))

            const { data: { user: currentUser } } = await supabase.auth.getUser()
            await supabase.from('payouts').insert({
              request_id: id,
              amount_released: Number(req?.amount_approved ?? 0),
              release_date: new Date().toISOString().split('T')[0],
              released_by: currentUser?.id ?? null,
              acknowledgment_notes: 'Released via Treasurer Dashboard',
            })
          }

          if (profile) {
            await supabase.from('system_logs').insert({
              user_id: profile.id,
              action: 'UPDATE_RELEASE_STATUS',
              table_name: 'requests',
              record_id: id,
              details: { new_release_status: newStatus }
            })
          }

          if (newStatus === 'Ready for Release') {
            const benName = req?.beneficiaries
              ? `${req.beneficiaries.first_name} ${req.beneficiaries.last_name}` : 'Unknown'
            const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
            if (admins) {
              await supabase.from('notifications').insert(
                admins.map((admin: any) => ({
                  user_id: admin.id,
                  title: 'Ready for Release',
                  message: `Treasurer: Request for ${benName} is now ready for release.`,
                  type: 'info',
                  request_id: id
                }))
              )
            }
          }
        }
      }
    ])
  }

  const totalAvailable = funds.reduce((s, f) => s + Number(f.current_balance), 0)
  const totalReleased  = funds.reduce((s, f) => s + Number(f.total_released),  0)

  /* ── card click handlers ───────────────────────────────────────── */
  const handleCardClick = (card: ActiveCard) => {
    if (activeCard === card) {
      setActiveCard(null)
      setActiveFilter('All')
    } else {
      setActiveCard(card)
      setActiveFund(null)
      setTypeFilter('')
      if (card === 'pending')       setActiveFilter('Pending Release')
      else if (card === 'released') setActiveFilter('Released')
      else                          setActiveFilter('All')
    }
  }

  const handleFundClick = (fundType: string) => {
    if (activeFund === fundType) {
      setActiveFund(null)
      setTypeFilter('')
    } else {
      setActiveFund(fundType)
      setActiveCard(null)
      setTypeFilter(fundType)
    }
  }

  const clearAll = () => {
    setActiveCard(null)
    setActiveFund(null)
    setActiveFilter('All')
    setTypeFilter('')
    setSearch('')
  }

  const hasActiveFilter = !!(activeCard || activeFund || activeFilter !== 'All' || typeFilter || search)

  /* ── filtered list ─────────────────────────────────────────────── */
  const filteredRequests = requests.filter(r => {
    const rStatus = r.release_status || 'Pending Release'
    const matchesTab    = activeFilter === 'All' || rStatus === activeFilter
    const matchesType   = typeFilter ? r.assistance_type === typeFilter : true
    const matchesSearch = search
      ? `${r.beneficiaries?.first_name} ${r.beneficiaries?.last_name}`.toLowerCase().includes(search.toLowerCase())
      : true
    return matchesTab && matchesType && matchesSearch
  })

  const s = styles(colors, isDark)

  /* ── List Header ──────────────────────────────────────────────── */
  const ListHeader = () => (
    <View>

      {/* ── Stat Cards ─────────────────────────────── */}
      <View style={s.statsRow}>

        {/* Pending Releases */}
        <TouchableOpacity
          style={[s.statCard, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }, activeCard === 'pending' && s.statCardActive]}
          onPress={() => handleCardClick('pending')}
          activeOpacity={0.75}
        >
          <View style={[s.statIcon, { backgroundColor: isDark ? '#1d4ed8' : '#dbeafe' }]}>
            <Feather name="alert-circle" size={15} color="#3b82f6" />
          </View>
          <Text style={[s.statValue, { color: '#3b82f6' }]}>{pendingCount}</Text>
          <Text style={s.statLabel}>Pending{'\n'}Releases</Text>
          {activeCard === 'pending' && (
            <View style={s.activeIndicator}>
              <Feather name="filter" size={8} color="#3b82f6" />
              <Text style={[s.activeIndicatorText, { color: '#3b82f6' }]}> Filtering</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Total Available */}
        <TouchableOpacity
          style={[s.statCard, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }, activeCard === 'available' && s.statCardActive]}
          onPress={() => handleCardClick('available')}
          activeOpacity={0.75}
        >
          <View style={[s.statIcon, { backgroundColor: isDark ? '#065f46' : '#d1fae5' }]}>
            <Feather name="briefcase" size={15} color="#10b981" />
          </View>
          <Text style={[s.statValue, { color: '#10b981', fontSize: 11 }]}>{formatCurrency(totalAvailable)}</Text>
          <Text style={s.statLabel}>Total{'\n'}Available</Text>
          {activeCard === 'available' && (
            <View style={s.activeIndicator}>
              <Feather name="info" size={8} color="#10b981" />
              <Text style={[s.activeIndicatorText, { color: '#10b981' }]}> Selected</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Total Released */}
        <TouchableOpacity
          style={[s.statCard, { backgroundColor: isDark ? '#312e81' : '#eef2ff' }, activeCard === 'released' && s.statCardActive]}
          onPress={() => handleCardClick('released')}
          activeOpacity={0.75}
        >
          <View style={[s.statIcon, { backgroundColor: isDark ? '#4338ca' : '#e0e7ff' }]}>
            <Feather name="arrow-down-right" size={15} color="#6366f1" />
          </View>
          <Text style={[s.statValue, { color: '#6366f1', fontSize: 11 }]}>{formatCurrency(totalReleased)}</Text>
          <Text style={s.statLabel}>Total{'\n'}Released</Text>
          {activeCard === 'released' && (
            <View style={s.activeIndicator}>
              <Feather name="filter" size={8} color="#6366f1" />
              <Text style={[s.activeIndicatorText, { color: '#6366f1' }]}> Filtering</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Quick Actions ───────────────────────────── */}
      <View style={s.quickActions}>
        <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('FundsDashboard')} activeOpacity={0.8}>
          <Feather name="pie-chart" size={14} color="#fff" />
          <Text style={s.actionBtnText}>Funds</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.actionBtnOutline]} onPress={() => navigation.navigate('FundTransactions')} activeOpacity={0.8}>
          <Feather name="file-text" size={14} color={colors.primary} />
          <Text style={[s.actionBtnText, { color: colors.primary }]}>Ledger</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.actionBtnOutline]} onPress={() => navigation.navigate('Payouts')} activeOpacity={0.8}>
          <Feather name="credit-card" size={14} color={colors.primary} />
          <Text style={[s.actionBtnText, { color: colors.primary }]}>Payouts</Text>
        </TouchableOpacity>
      </View>

      {/* ── Fund Balance Chips ──────────────────────── */}
      {funds.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text style={s.sectionLabel}>Fund Balances</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
            {funds.map(fund => {
              const pct   = fund.total_allocated > 0 ? (Number(fund.current_balance) / Number(fund.total_allocated)) * 100 : 0
              const isLow = Number(fund.current_balance) <= Number(fund.low_balance_threshold)
              const isAct = activeFund === fund.assistance_type
              return (
                <TouchableOpacity
                  key={fund.id}
                  style={[
                    s.fundChip,
                    isLow && { borderColor: '#f97316' },
                    isAct && { borderColor: colors.primary, borderWidth: 2 },
                  ]}
                  onPress={() => handleFundClick(fund.assistance_type)}
                  activeOpacity={0.75}
                >
                  {/* Corner icon */}
                  <View style={{ position: 'absolute', top: 8, right: 8 }}>
                    {isAct
                      ? <Feather name="filter" size={10} color={colors.primary} />
                      : isLow
                        ? <Feather name="alert-triangle" size={10} color="#f97316" />
                        : null
                    }
                  </View>

                  <Text style={s.fundChipType}>{fund.assistance_type}</Text>
                  <Text style={s.fundChipBalance}>{formatCurrency(fund.current_balance)}</Text>
                  <View style={s.miniProgressBg}>
                    <View style={[s.miniProgressFill, {
                      flex: Math.min(pct, 100) / 100,
                      backgroundColor: isAct ? colors.primary : isLow ? '#f97316' : '#3b82f6'
                    }]} />
                    <View style={{ flex: 1 - Math.min(pct, 100) / 100 }} />
                  </View>
                  <Text style={[s.fundChipPct, isAct && { color: colors.primary }]}>
                    {Math.round(pct)}% remaining
                  </Text>
                  {isAct && (
                    <Text style={[s.fundChipPct, { color: colors.primary, marginTop: 3 }]}>
                      Tap again to clear
                    </Text>
                  )}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Active Filter Banner ────────────────────── */}
      {hasActiveFilter && (
        <TouchableOpacity style={s.filterBanner} onPress={clearAll} activeOpacity={0.85}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name="filter" size={12} color={colors.primary} />
            <Text style={[s.filterBannerText, { color: colors.primary }]}>
              {filteredRequests.length} result{filteredRequests.length !== 1 ? 's' : ''} filtered
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name="x" size={12} color={colors.primary} />
            <Text style={[s.filterBannerText, { color: colors.primary, fontWeight: '700' }]}>Clear all</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Search ─────────────────────────────────── */}
      <View style={s.searchRow}>
        <Feather name="search" size={14} color={colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Search beneficiary..."
          value={search}
          onChangeText={v => { setSearch(v); if (v) setActiveCard(null) }}
          placeholderTextColor={colors.textSecondary}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter Tabs ────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.filterTab, activeFilter === tab && s.filterTabActive]}
            onPress={() => { setActiveFilter(tab); setActiveCard(null) }}
            activeOpacity={0.75}
          >
            <Text style={[s.filterTabText, activeFilter === tab && s.filterTabTextActive]}>
              {tab}{tab === 'Pending Release' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[s.sectionLabel, { marginBottom: 8 }]}>
        Approved Requests{filteredRequests.length > 0 ? ` · ${filteredRequests.length}` : ''}
      </Text>
    </View>
  )

  return (
    <View style={s.container}>
      {/* Page Header */}
      <View style={s.pageHeader}>
        <View>
          <Text style={s.pageTitle}>{t('nav_treasurerDashboard') || 'Treasurer Dashboard'}</Text>
          <Text style={s.pageSubtitle}>{requests.length} approved request{requests.length !== 1 ? 's' : ''} awaiting release</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true) }}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={<ListHeader />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
          renderItem={({ item }) => {
            const rStatus = item.release_status || 'Pending Release'
            const st = STATUS_STYLE[rStatus] || STATUS_STYLE['Pending Release']
            const typeIsActive = activeFund === item.assistance_type
            return (
              <TouchableOpacity
                style={s.requestCard}
                onPress={() => navigation.navigate('RequestDetail', { id: item.id })}
                activeOpacity={0.75}
              >
                {/* Top Row */}
                <View style={s.cardTopRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={s.cardName} numberOfLines={1}>
                      {item.beneficiaries?.last_name}, {item.beneficiaries?.first_name}
                    </Text>
                    <Text style={s.cardSub} numberOfLines={1}>{item.beneficiaries?.barangay}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); handleUpdateReleaseStatus(item.id, item.release_status) }}
                    style={[s.statusBadge, { backgroundColor: st.bg, borderColor: st.text + '33' }]}
                    activeOpacity={0.8}
                  >
                    <Feather name={st.icon as any} size={10} color={st.text} style={{ marginRight: 4 }} />
                    <Text style={[s.statusBadgeText, { color: st.text }]}>{rStatus}</Text>
                  </TouchableOpacity>
                </View>

                {/* Details Row */}
                <View style={s.cardDetailsRow}>
                  {/* Assistance type — tappable to filter */}
                  <TouchableOpacity
                    style={[
                      s.cardDetail,
                      typeIsActive && { backgroundColor: colors.primary + '22', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 }
                    ]}
                    onPress={() => handleFundClick(item.assistance_type)}
                    activeOpacity={0.8}
                  >
                    <Feather name="tag" size={11} color={typeIsActive ? colors.primary : colors.textSecondary} />
                    <Text style={[s.cardDetailText, typeIsActive && { color: colors.primary, fontWeight: '700' }]}>
                      {item.assistance_type}
                    </Text>
                  </TouchableOpacity>

                  <View style={s.cardDetail}>
                    <Feather name="check-square" size={11} color="#10b981" />
                    <Text style={[s.cardDetailText, { color: '#10b981', fontWeight: '700' }]}>
                      {item.amount_approved ? `₱${Number(item.amount_approved).toLocaleString()}` : '—'}
                    </Text>
                  </View>
                  <View style={s.cardDetail}>
                    <Feather name="calendar" size={11} color={colors.textSecondary} />
                    <Text style={s.cardDetailText}>{format(new Date(item.created_at), 'MMM d, yyyy')}</Text>
                  </View>
                </View>

                {/* Bottom hint */}
                <View style={s.cardHint}>
                  <Text style={s.cardHintText}>Tap badge to update · tap type to filter</Text>
                  <Feather name="chevron-right" size={12} color={colors.textSecondary} style={{ opacity: 0.4 }} />
                </View>
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <Feather name="inbox" size={38} color={colors.textSecondary} style={{ opacity: 0.35, marginBottom: 12 }} />
              <Text style={s.emptyText}>No records found</Text>
              <Text style={s.emptySubText}>
                {hasActiveFilter
                  ? 'No requests match the current filters'
                  : 'No approved requests waiting for release'}
              </Text>
              {hasActiveFilter && (
                <TouchableOpacity onPress={clearAll} style={{ marginTop: 14 }} activeOpacity={0.8}>
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Clear all filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  pageHeader: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pageTitle:    { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  /* ── Stat Cards ─────────────────────────────────────────────── */
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 14 },
  statCard: {
    flex: 1, borderRadius: 14, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    borderWidth: 2, borderColor: 'transparent',
  },
  statCardActive: {
    borderColor: colors.primary,
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  statIcon: {
    width: 30, height: 30, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  statValue:           { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  statLabel:           { fontSize: 10, fontWeight: '600', color: colors.textSecondary, lineHeight: 14 },
  activeIndicator:     { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  activeIndicatorText: { fontSize: 9, fontWeight: '700' },

  /* ── Active filter banner ───────────────────────────────────── */
  filterBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.primary + '18',
    borderWidth: 1, borderColor: colors.primary + '40',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  filterBannerText: { fontSize: 12, fontWeight: '600' },

  /* ── Quick actions ──────────────────────────────────────────── */
  quickActions: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, backgroundColor: colors.primary, paddingVertical: 9, borderRadius: 12,
  },
  actionBtnOutline: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
    borderWidth: 1, borderColor: colors.border,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  /* ── Section label ──────────────────────────────────────────── */
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textSecondary,
    marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase',
  },

  /* ── Fund chips ─────────────────────────────────────────────── */
  fundChip: {
    backgroundColor: colors.card, borderRadius: 14, padding: 14, width: 160,
    borderWidth: 1, borderColor: colors.border, position: 'relative',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  fundChipType:     { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
  fundChipBalance:  { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 8 },
  miniProgressBg:   { height: 4, flexDirection: 'row', backgroundColor: isDark ? '#334155' : '#e2e8f0', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  miniProgressFill: { height: 4, borderRadius: 2 },
  fundChipPct:      { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },

  /* ── Search ─────────────────────────────────────────────────── */
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },

  /* ── Filter tabs ────────────────────────────────────────────── */
  filterRow:           { gap: 8, paddingRight: 4, marginBottom: 14 },
  filterTab:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', borderWidth: 1, borderColor: 'transparent' },
  filterTabActive:     { backgroundColor: isDark ? 'rgba(37,99,235,0.25)' : '#eff6ff', borderColor: colors.primary },
  filterTabText:       { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  filterTabTextActive: { color: colors.primary, fontWeight: '700' },

  /* ── Request card ───────────────────────────────────────────── */
  requestCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTopRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardName:        { fontSize: 15, fontWeight: '700', color: colors.text },
  cardSub:         { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statusBadge:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  cardDetailsRow:  { flexDirection: 'row', gap: 12, marginBottom: 8, flexWrap: 'wrap' },
  cardDetail:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardDetailText:  { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  cardHint: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border,
  },
  cardHintText: { fontSize: 10, color: colors.textSecondary, opacity: 0.6 },

  /* ── Empty state ────────────────────────────────────────────── */
  emptyContainer: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  emptyText:      { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  emptySubText:   { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
})
