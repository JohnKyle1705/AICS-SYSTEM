import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, RefreshControl, ActivityIndicator,
  Modal
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { Feather } from '@expo/vector-icons'
import { format } from 'date-fns'

const RELEASE_STATUSES = ['Pending Release', 'Ready for Release', 'Released']

const STATUS_STYLE: Record<string, { bg: string; text: string; darkBg: string; darkText: string; icon: string }> = {
  'Released':          { bg: '#d1fae5', text: '#065f46', darkBg: 'rgba(16, 185, 129, 0.2)',  darkText: '#34d399', icon: 'check-circle' },
  'Ready for Release': { bg: '#fef3c7', text: '#92400e', darkBg: 'rgba(245, 158, 11, 0.2)',  darkText: '#fbbf24', icon: 'clock'        },
  'Pending Release':   { bg: '#f1f5f9', text: '#334155', darkBg: '#1e293b',                  darkText: '#94a3b8', icon: 'loader'       },
}

const FILTER_TABS = ['All', 'Pending Release', 'Ready for Release', 'Released']

type ActiveCard = 'total_funds' | 'total_allocated' | 'available' | 'released' | 'pending' | 'approved' | null

export default function TreasurerDashboardScreen({ navigation }: any) {
  const [requests, setRequests]         = useState<any[]>([])
  const [funds, setFunds]               = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [search, setSearch]             = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [typeFilter, setTypeFilter]     = useState('')
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [profile, setProfile]           = useState<any>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [totalRequestsCount, setTotalRequestsCount] = useState(0)
  const [activeCard, setActiveCard]     = useState<ActiveCard>(null)
  const [activeFund, setActiveFund]     = useState<string | null>(null)

  // Voucher Modal State
  const [voucherModalOpen, setVoucherModalOpen]   = useState(false)
  const [selectedReq, setSelectedReq]             = useState<any>(null)
  const [voucherNo, setVoucherNo]                 = useState('')
  const [checkNo, setCheckNo]                     = useState('')
  const [paymentMethod, setPaymentMethod]         = useState('Cash')
  const [disbursingOfficer, setDisbursingOfficer] = useState('')
  const [voucherNotes, setVoucherNotes]           = useState('')
  const [processingModal, setProcessingModal]     = useState(false)

  // Return to Admin Modal State
  const [returnModalOpen, setReturnModalOpen]     = useState(false)
  const [returnRemarks, setReturnRemarks]         = useState('')

  const { colors, isDark } = useTheme()
  const { t } = useLanguage()

  const formatCurrency = (val: number) =>
    '₱' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user && !profile) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user?.id).single()
      if (p) {
        setProfile(p)
        if (p.full_name) setDisbursingOfficer(p.full_name)
      }
    }

    // Fetch approved requests
    const { data } = await supabase.from('requests')
      .select('*, beneficiaries(first_name, last_name, barangay)')
      .eq('status', 'Approved')
      .order('created_at', { ascending: false })
    setRequests(data ?? [])

    // Fetch funds
    const { data: fundsData } = await supabase.from('funds').select('*').order('assistance_type')
    if (fundsData) setFunds(fundsData)

    // Accurate pending count
    const { count } = await supabase.from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Approved')
      .or('release_status.is.null,release_status.neq.Released')
    setPendingCount(count ?? 0)

    // Total requests across all statuses
    const { count: totalReqs } = await supabase.from('requests')
      .select('*', { count: 'exact', head: true })
    setTotalRequestsCount(totalReqs ?? 0)

    // Recent transactions
    const { data: txData } = await supabase
      .from('fund_transactions')
      .select('*, funds(assistance_type), profiles(full_name), requests(id, beneficiaries(first_name, last_name))')
      .order('created_at', { ascending: false })
      .limit(4)
    if (txData) setTransactions(txData)

    setLoading(false)
    setRefreshing(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const channel = supabase
      .channel('mobile_treasurer_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        load(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'funds' }, () => {
        load(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  /* ── financial calculations ───────────────────────────────────── */
  const totalFundsBudget = funds.reduce((s, f) => s + Number(f.total_allocated || 0), 0)
  const totalAvailable   = funds.reduce((s, f) => s + Number(f.current_balance || 0), 0)
  const totalReleased    = funds.reduce((s, f) => s + Number(f.total_released || 0), 0)

  const totalEarmarkedAllocated = requests
    .filter(r => (r.release_status || 'Pending Release') !== 'Released')
    .reduce((s, r) => s + Number(r.amount_approved || 0), 0)

  /* ── card click handlers ───────────────────────────────────────── */
  const handleCardClick = (card: ActiveCard) => {
    if (activeCard === card) {
      setActiveCard(null)
      setActiveFilter('All')
    } else {
      setActiveCard(card)
      setActiveFund(null)
      setTypeFilter('')

      if (card === 'total_funds') {
        setActiveFilter('All')
      } else if (card === 'total_allocated') {
        setActiveFilter('Pending Release')
      } else if (card === 'released') {
        setActiveFilter('Released')
      } else if (card === 'available') {
        setActiveFilter('All')
      } else if (card === 'pending') {
        setActiveFilter('Pending Release')
      } else if (card === 'approved') {
        setActiveFilter('All')
      }
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

  /* ── voucher processing ───────────────────────────────────────── */
  const openVoucherModal = (req: any) => {
    setSelectedReq(req)
    setVoucherNo(req.extra_fields?.voucher_number || `DV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)
    setCheckNo(req.extra_fields?.check_number || '')
    setPaymentMethod(req.extra_fields?.payment_method || 'Cash')
    setDisbursingOfficer(req.extra_fields?.disbursing_officer || profile?.full_name || 'Municipal Treasurer')
    setVoucherNotes(req.extra_fields?.voucher_notes || '')
    setVoucherModalOpen(true)
  }

  const handleSaveVoucher = async () => {
    if (!voucherNo.trim()) {
      Alert.alert('Required', 'Please enter a Disbursement Voucher (DV) Number.')
      return
    }

    setProcessingModal(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('requests').update({
        release_status: 'Ready for Release',
        extra_fields: {
          ...(selectedReq.extra_fields || {}),
          voucher_number: voucherNo.trim(),
          check_number: checkNo.trim() || null,
          payment_method: paymentMethod,
          disbursing_officer: disbursingOfficer.trim() || profile?.full_name || 'Municipal Treasurer',
          voucher_notes: voucherNotes.trim() || null,
        }
      }).eq('id', selectedReq.id)

      if (error) throw error

      if (user) {
        await supabase.from('system_logs').insert({
          user_id: user.id,
          action: 'PROCESS_VOUCHER',
          table_name: 'requests',
          record_id: selectedReq.id,
          details: { voucher_number: voucherNo.trim(), release_status: 'Ready for Release' }
        })
      }

      setVoucherModalOpen(false)
      load(true)
      Alert.alert('Success', 'Voucher details recorded! Status is now Ready for Release.')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setProcessingModal(false)
    }
  }

  /* ── confirm release ──────────────────────────────────────────── */
  const handleConfirmRelease = (req: any) => {
    if (!req.amount_approved || Number(req.amount_approved) <= 0) {
      Alert.alert('Cannot Release', 'Approved amount is missing or zero.')
      return
    }

    const benName = req.beneficiaries ? `${req.beneficiaries.first_name} ${req.beneficiaries.last_name}` : 'the beneficiary'
    Alert.alert(
      'Confirm Disbursement',
      `Release ₱${Number(req.amount_approved).toLocaleString()} to ${benName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Release',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser()
              const amt = Number(req.amount_approved)

              // 1. Payout
              const { error: payErr } = await supabase.from('payouts').insert({
                request_id: req.id,
                amount_released: amt,
                release_date: new Date().toISOString().split('T')[0],
                released_by: user?.id,
                acknowledgment_notes: 'Released via Mobile Treasurer Dashboard'
              })
              if (payErr) throw payErr

              // 2. Request status
              await supabase.from('requests').update({
                status: 'Released',
                release_status: 'Released'
              }).eq('id', req.id)

              // 3. Fund deduction & transaction
              if (req.assistance_type) {
                const { data: fund } = await supabase.from('funds').select('*').eq('assistance_type', req.assistance_type).single()
                if (fund) {
                  const newBalance = Math.max(0, Number(fund.current_balance) - amt)
                  const newReleased = Number(fund.total_released || 0) + amt
                  await supabase.from('funds').update({
                    current_balance: newBalance,
                    total_released: newReleased
                  }).eq('id', fund.id)

                  await supabase.from('fund_transactions').insert({
                    fund_id: fund.id,
                    request_id: req.id,
                    transaction_type: 'Release',
                    amount: amt,
                    balance_after: newBalance,
                    processed_by: user?.id,
                    remarks: `Disbursement to ${benName}`
                  })
                }
              }

              // 4. Log
              if (user) {
                await supabase.from('system_logs').insert({
                  user_id: user.id,
                  action: 'CONFIRM_RELEASE',
                  table_name: 'requests',
                  record_id: req.id,
                  details: { amount_released: amt, release_status: 'Released' }
                })
              }

              // 5. Notify resident
              if (req.encoded_by) {
                await supabase.from('notifications').insert({
                  user_id: req.encoded_by,
                  title: 'Assistance Released',
                  message: `Your ${req.assistance_type} assistance payout of ₱${amt.toLocaleString()} has been released.`,
                  type: 'info',
                  request_id: req.id
                })
              }

              load(true)
              Alert.alert('Success', 'Assistance payout released and recorded successfully!')
            } catch (e: any) {
              Alert.alert('Error', e.message)
            }
          }
        }
      ]
    )
  }

  /* ── return to admin ──────────────────────────────────────────── */
  const openReturnModal = (req: any) => {
    setSelectedReq(req)
    setReturnRemarks('')
    setReturnModalOpen(true)
  }

  const handleReturnToAdmin = async () => {
    if (!returnRemarks.trim()) {
      Alert.alert('Required', 'Please state the reason for returning this request.')
      return
    }

    setProcessingModal(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('requests').update({
        status: 'Pending',
        release_status: 'Pending Release',
        remarks: `[Returned by Treasurer]: ${returnRemarks.trim()}`
      }).eq('id', selectedReq.id)

      if (error) throw error

      // Notify Admins
      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
      if (admins) {
        const benName = selectedReq.beneficiaries ? `${selectedReq.beneficiaries.first_name} ${selectedReq.beneficiaries.last_name}` : 'Unknown'
        await supabase.from('notifications').insert(
          admins.map((a: any) => ({
            user_id: a.id,
            title: 'Request Returned by Treasurer',
            message: `Request for ${benName} was returned: ${returnRemarks.trim()}`,
            type: 'warning',
            request_id: selectedReq.id
          }))
        )
      }

      setReturnModalOpen(false)
      load(true)
      Alert.alert('Returned', 'Request returned to Admin with remarks.')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setProcessingModal(false)
    }
  }

  /* ── filtered list ─────────────────────────────────────────────── */
  const filteredRequests = requests.filter(r => {
    const rStatus = r.release_status || 'Pending Release'
    const matchesTab    = activeFilter === 'All' || rStatus === activeFilter
    const matchesType   = typeFilter ? r.assistance_type === typeFilter : true
    const matchesSearch = search
      ? `${r.beneficiaries?.first_name} ${r.beneficiaries?.last_name} ${r.id} ${r.extra_fields?.voucher_number || ''}`.toLowerCase().includes(search.toLowerCase())
      : true
    return matchesTab && matchesType && matchesSearch
  })

  const s = styles(colors, isDark)

  /* ── List Header ──────────────────────────────────────────────── */
  const ListHeader = () => (
    <View>
      {/* ── 6 Stat Cards Grid ───────────────────────── */}
      <View style={s.statsGrid}>

        {/* 1. Total Funds */}
        <TouchableOpacity
          style={[s.statCard, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }, activeCard === 'total_funds' && s.statCardActive]}
          onPress={() => handleCardClick('total_funds')}
          activeOpacity={0.75}
        >
          <View style={[s.statIcon, { backgroundColor: isDark ? '#312e81' : '#e0e7ff' }]}>
            <Feather name="folder" size={14} color="#6366f1" />
          </View>
          <Text style={[s.statValue, { color: '#6366f1', fontSize: 11 }]}>{formatCurrency(totalFundsBudget)}</Text>
          <Text style={s.statLabel}>Total Funds</Text>
        </TouchableOpacity>

        {/* 2. Total Allocated */}
        <TouchableOpacity
          style={[s.statCard, { backgroundColor: isDark ? '#2e2617' : '#fffbeb' }, activeCard === 'total_allocated' && s.statCardActive]}
          onPress={() => handleCardClick('total_allocated')}
          activeOpacity={0.75}
        >
          <View style={[s.statIcon, { backgroundColor: isDark ? '#78350f' : '#fef3c7' }]}>
            <Feather name="clock" size={14} color="#d97706" />
          </View>
          <Text style={[s.statValue, { color: '#d97706', fontSize: 11 }]}>{formatCurrency(totalEarmarkedAllocated)}</Text>
          <Text style={s.statLabel}>Allocated</Text>
        </TouchableOpacity>

        {/* 3. Total Released */}
        <TouchableOpacity
          style={[s.statCard, { backgroundColor: isDark ? '#2a1a12' : '#fff7ed' }, activeCard === 'released' && s.statCardActive]}
          onPress={() => handleCardClick('released')}
          activeOpacity={0.75}
        >
          <View style={[s.statIcon, { backgroundColor: isDark ? '#7c2d12' : '#ffedd5' }]}>
            <Feather name="arrow-down-right" size={14} color="#ea580c" />
          </View>
          <Text style={[s.statValue, { color: '#ea580c', fontSize: 11 }]}>{formatCurrency(totalReleased)}</Text>
          <Text style={s.statLabel}>Released</Text>
        </TouchableOpacity>

        {/* 4. Remaining Balance */}
        <TouchableOpacity
          style={[s.statCard, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }, activeCard === 'available' && s.statCardActive]}
          onPress={() => handleCardClick('available')}
          activeOpacity={0.75}
        >
          <View style={[s.statIcon, { backgroundColor: isDark ? '#065f46' : '#d1fae5' }]}>
            <Feather name="briefcase" size={14} color="#10b981" />
          </View>
          <Text style={[s.statValue, { color: '#10b981', fontSize: 11 }]}>{formatCurrency(totalAvailable)}</Text>
          <Text style={s.statLabel}>Remaining</Text>
        </TouchableOpacity>

        {/* 5. Pending Releases */}
        <TouchableOpacity
          style={[s.statCard, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }, activeCard === 'pending' && s.statCardActive]}
          onPress={() => handleCardClick('pending')}
          activeOpacity={0.75}
        >
          <View style={[s.statIcon, { backgroundColor: isDark ? '#1d4ed8' : '#dbeafe' }]}>
            <Feather name="alert-circle" size={14} color="#3b82f6" />
          </View>
          <Text style={[s.statValue, { color: '#3b82f6' }]}>{pendingCount}</Text>
          <Text style={s.statLabel}>Pending</Text>
        </TouchableOpacity>

        {/* 6. Total Requests */}
        <TouchableOpacity
          style={[s.statCard, { backgroundColor: isDark ? '#3b0764' : '#faf5ff' }]}
          onPress={() => navigation.navigate('Requests', { statusFilter: 'All' })}
          activeOpacity={0.75}
        >
          <View style={[s.statIcon, { backgroundColor: isDark ? '#6b21a8' : '#f3e8ff' }]}>
            <Feather name="clipboard" size={14} color="#9333ea" />
          </View>
          <Text style={[s.statValue, { color: '#9333ea' }]}>{totalRequestsCount}</Text>
          <Text style={s.statLabel}>Total Requests</Text>
        </TouchableOpacity>

      </View>

      {/* ── Quick Actions ───────────────────────────── */}
      <View style={s.quickActions}>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#7c3aed' }]} onPress={() => navigation.navigate('Requests', { statusFilter: 'All' })} activeOpacity={0.8}>
          <Feather name="clipboard" size={14} color="#fff" />
          <Text style={s.actionBtnText}>All Requests</Text>
        </TouchableOpacity>
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
        <TouchableOpacity style={[s.actionBtn, s.actionBtnOutline]} onPress={() => navigation.navigate('Reports')} activeOpacity={0.8}>
          <Feather name="bar-chart-2" size={14} color={colors.primary} />
          <Text style={[s.actionBtnText, { color: colors.primary }]}>Reports</Text>
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
                  style={[s.fundChip, isLow && s.fundChipLow, isAct && s.fundChipActive]}
                  onPress={() => handleFundClick(fund.assistance_type)}
                  activeOpacity={0.75}
                >
                  <View style={s.fundChipTop}>
                    <Text style={s.fundChipType}>{fund.assistance_type}</Text>
                    {isLow && (
                      <View style={s.lowBadge}>
                        <Feather name="alert-triangle" size={9} color="#ea580c" />
                        <Text style={s.lowBadgeText}> Low</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.fundChipBal}>{formatCurrency(fund.current_balance)}</Text>
                  <View style={s.fundProgressBg}>
                    <View style={[s.fundProgressFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: isLow ? '#ea580c' : colors.primary }]} />
                  </View>
                  <Text style={s.fundChipSub}>{Math.round(pct)}% remaining</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Search Bar ──────────────────────────────── */}
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Feather name="search" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Search beneficiary or DV #..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Filter Tabs ─────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterTabs}>
        {FILTER_TABS.map(tab => {
          const isAct = activeFilter === tab
          const count = tab === 'All' ? requests.length : requests.filter(r => (r.release_status || 'Pending Release') === tab).length
          return (
            <TouchableOpacity
              key={tab}
              style={[s.tab, isAct && s.tabActive]}
              onPress={() => { setActiveFilter(tab); setActiveCard(null) }}
              activeOpacity={0.7}
            >
              <Text style={[s.tabText, isAct && s.tabTextActive]}>
                {tab} ({count})
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* ── Filter banner if applied ────────────────── */}
      {(activeCard || activeFund || activeFilter !== 'All' || typeFilter || search) ? (
        <View style={s.filterBanner}>
          <Feather name="filter" size={12} color={colors.primary} />
          <Text style={s.filterBannerText}>
            Filtering: {activeFilter !== 'All' ? activeFilter : ''} {typeFilter ? `• ${typeFilter}` : ''} {search ? `• "${search}"` : ''} ({filteredRequests.length} results)
          </Text>
          <TouchableOpacity onPress={clearAll}>
            <Text style={s.filterBannerClear}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={[s.sectionLabel, { marginTop: 8, marginBottom: 8 }]}>
        Approved Requests ({filteredRequests.length})
      </Text>
    </View>
  )

  const renderItem = ({ item: r }: any) => {
    const rStatus = r.release_status || 'Pending Release'
    const st = STATUS_STYLE[rStatus] || STATUS_STYLE['Pending Release']

    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => navigation.navigate('RequestDetail', { id: r.id })}>
              <Text style={s.benName}>
                {r.beneficiaries?.last_name}, {r.beneficiaries?.first_name}
              </Text>
            </TouchableOpacity>
            <Text style={s.barangay}>Brgy. {r.beneficiaries?.barangay || '—'}</Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: isDark ? st.darkBg : st.bg }]}>
            <Text style={[s.statusText, { color: isDark ? st.darkText : st.text }]}>{rStatus}</Text>
          </View>
        </View>

        <View style={s.cardMid}>
          <View style={s.detailCol}>
            <Text style={s.detailLabel}>Assistance</Text>
            <Text style={s.detailVal}>{r.assistance_type}</Text>
          </View>
          <View style={s.detailCol}>
            <Text style={s.detailLabel}>Approved Amount</Text>
            <Text style={[s.detailVal, { color: '#10b981', fontWeight: 'bold' }]}>
              ₱{Number(r.amount_approved || 0).toLocaleString()}
            </Text>
          </View>
          <View style={s.detailCol}>
            <Text style={s.detailLabel}>Voucher #</Text>
            <Text style={[s.detailVal, { fontSize: 11 }]}>
              {r.extra_fields?.voucher_number || '—'}
            </Text>
          </View>
        </View>

        {/* Row Action Buttons */}
        <View style={s.cardActions}>
          <TouchableOpacity
            style={s.rowBtn}
            onPress={() => navigation.navigate('RequestDetail', { id: r.id })}
          >
            <Feather name="eye" size={13} color={colors.textSecondary} />
            <Text style={[s.rowBtnText, { color: colors.textSecondary }]}>View</Text>
          </TouchableOpacity>

          {rStatus !== 'Released' && (
            <TouchableOpacity
              style={[s.rowBtn, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }]}
              onPress={() => openVoucherModal(r)}
            >
              <Feather name="file-text" size={13} color={colors.primary} />
              <Text style={[s.rowBtnText, { color: colors.primary }]}>Voucher</Text>
            </TouchableOpacity>
          )}

          {rStatus !== 'Released' && (
            <TouchableOpacity
              style={[s.rowBtn, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }]}
              onPress={() => handleConfirmRelease(r)}
            >
              <Feather name="check-circle" size={13} color="#10b981" />
              <Text style={[s.rowBtnText, { color: '#10b981' }]}>Release</Text>
            </TouchableOpacity>
          )}

          {rStatus !== 'Released' && (
            <TouchableOpacity
              style={[s.rowBtn, { backgroundColor: isDark ? '#3d1414' : '#fee2e2' }]}
              onPress={() => openReturnModal(r)}
            >
              <Feather name="rotate-ccw" size={13} color="#ef4444" />
              <Text style={[s.rowBtnText, { color: '#ef4444' }]}>Return</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={s.container}>
      <FlatList
        data={filteredRequests}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true) }} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={s.emptyBox}>
              <Feather name="file-text" size={36} color={colors.textSecondary} style={{ marginBottom: 8 }} />
              <Text style={s.emptyTitle}>No requests found</Text>
              <Text style={s.emptySub}>No approved requests match your current filters.</Text>
            </View>
          )
        }
      />

      {/* Voucher Modal */}
      <Modal visible={voucherModalOpen} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Process Voucher</Text>
              <TouchableOpacity onPress={() => setVoucherModalOpen(false)}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={s.modalSub}>
              Beneficiary: {selectedReq?.beneficiaries?.first_name} {selectedReq?.beneficiaries?.last_name} · ₱{Number(selectedReq?.amount_approved || 0).toLocaleString()}
            </Text>

            <Text style={s.inputLabel}>Disbursement Voucher (DV) # *</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. DV-2026-10-0089"
              placeholderTextColor={colors.textSecondary}
              value={voucherNo}
              onChangeText={setVoucherNo}
            />

            <Text style={s.inputLabel}>Check / Ref # (Optional)</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. CHK-554219"
              placeholderTextColor={colors.textSecondary}
              value={checkNo}
              onChangeText={setCheckNo}
            />

            <Text style={s.inputLabel}>Payment Method</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Cash / Cheque / Bank Transfer"
              placeholderTextColor={colors.textSecondary}
              value={paymentMethod}
              onChangeText={setPaymentMethod}
            />

            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setVoucherModalOpen(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalConfirmBtn}
                onPress={handleSaveVoucher}
                disabled={processingModal}
              >
                {processingModal ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.modalConfirmText}>Save & Ready</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Return Modal */}
      <Modal visible={returnModalOpen} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: '#ef4444' }]}>Return to Admin</Text>
              <TouchableOpacity onPress={() => setReturnModalOpen(false)}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={s.modalSub}>
              State the reason for returning this request (e.g. insufficient funds, documentation issue).
            </Text>

            <Text style={s.inputLabel}>Reason / Remarks *</Text>
            <TextInput
              style={[s.modalInput, { height: 75, textAlignVertical: 'top' }]}
              multiline
              numberOfLines={3}
              placeholder="Enter remarks..."
              placeholderTextColor={colors.textSecondary}
              value={returnRemarks}
              onChangeText={setReturnRemarks}
            />

            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setReturnModalOpen(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirmBtn, { backgroundColor: '#ef4444' }]}
                onPress={handleReturnToAdmin}
                disabled={processingModal}
              >
                {processingModal ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.modalConfirmText}>Confirm Return</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },

  // 6 Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    width: '31.5%',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statCardActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  statIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingVertical: 9,
    borderRadius: 10,
  },
  actionBtnOutline: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Fund chip
  fundChip: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 120,
  },
  fundChipLow: {
    borderColor: '#ea580c',
  },
  fundChipActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  fundChipTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  fundChipType: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  lowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  lowBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ea580c',
  },
  fundChipBal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 5,
  },
  fundProgressBg: {
    height: 3,
    backgroundColor: isDark ? '#334155' : '#e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  fundProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  fundChipSub: {
    fontSize: 9,
    color: colors.textSecondary,
  },

  // Search
  searchRow: {
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },

  // Filter tabs
  filterTabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    gap: 6,
  },
  filterBannerText: {
    flex: 1,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  filterBannerClear: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },

  // Cards
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  benName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  barangay: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardMid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  detailCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  detailVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: isDark ? '#334155' : '#f1f5f9',
  },
  rowBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },

  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  modalSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    marginBottom: 10,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: isDark ? '#334155' : '#f1f5f9',
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  modalConfirmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  modalConfirmText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
})
