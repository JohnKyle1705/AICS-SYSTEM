import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { Feather } from '@expo/vector-icons'
import GlobalHeader from '../components/GlobalHeader'

export default function FundsDashboardScreen({ navigation }: any) {
  const { colors, isDark } = useTheme()
  const [funds, setFunds] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  // Allocation Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedFundId, setSelectedFundId] = useState('')
  const [transactionType, setTransactionType] = useState<'Allocation' | 'Adjustment'>('Allocation')
  const [amount, setAmount] = useState('')
  const [threshold, setThreshold] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      // Fetch funds
      const { data: fundsData, error: fundsError } = await supabase.from('funds').select('*').order('assistance_type')
      if (fundsError) throw fundsError
      setFunds(fundsData || [])

      if (fundsData && fundsData.length > 0 && !selectedFundId) {
        setSelectedFundId(fundsData[0].id)
        setThreshold(fundsData[0].low_balance_threshold?.toString() || '0')
      }

      // Fetch pending count
      const { count: count1 } = await supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'Approved')
      const { count: count2 } = await supabase.from('requests').select('*', { count: 'exact', head: true }).in('release_status', ['Ready for Release', 'Pending Release'])
      setPendingCount((count1 || 0) + (count2 || 0))

      // Fetch recent transactions
      const { data: txData } = await supabase.from('fund_transactions').select('*').order('created_at', { ascending: false }).limit(5)
      setTransactions(txData || [])

    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedFundId])

  useEffect(() => { loadData() }, [loadData])

  const formatCurrency = (val: number) => {
    return '₱' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const openAllocationModal = (fundIdToSelect?: string) => {
    const targetId = fundIdToSelect || (funds[0] ? funds[0].id : '')
    setSelectedFundId(targetId)
    const f = funds.find(x => x.id === targetId)
    if (f) {
      setThreshold(f.low_balance_threshold?.toString() || '0')
    }
    setAmount('')
    setRemarks('')
    setTransactionType('Allocation')
    setModalOpen(true)
  }

  const handleFundChange = (id: string) => {
    setSelectedFundId(id)
    const f = funds.find(x => x.id === id)
    if (f) {
      setThreshold(f.low_balance_threshold?.toString() || '0')
    }
  }

  const handleSubmitAllocation = async () => {
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.')
      return
    }

    const selectedFund = funds.find(f => f.id === selectedFundId)
    if (!selectedFund) return

    let newBalance = Number(selectedFund.current_balance)
    let newTotalAllocated = Number(selectedFund.total_allocated)

    if (transactionType === 'Allocation') {
      newBalance += numAmount
      newTotalAllocated += numAmount
    } else {
      newBalance -= numAmount
      newTotalAllocated -= numAmount
      if (newBalance < 0) {
        Alert.alert('Invalid Adjustment', 'Adjustment would cause the fund balance to fall below zero.')
        return
      }
    }

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const newThreshold = threshold ? parseFloat(threshold) : selectedFund.low_balance_threshold

      // 1. Update funds table
      const { error: fundErr } = await supabase
        .from('funds')
        .update({
          total_allocated: newTotalAllocated,
          current_balance: newBalance,
          low_balance_threshold: newThreshold,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq('id', selectedFundId)

      if (fundErr) throw fundErr

      // 2. Insert into fund_transactions
      const { error: txErr } = await supabase
        .from('fund_transactions')
        .insert({
          fund_id: selectedFundId,
          transaction_type: transactionType,
          amount: numAmount,
          balance_after: newBalance,
          remarks: remarks.trim() || `${transactionType} via mobile app`,
          created_by: user?.id,
        })

      if (txErr) throw txErr

      // 3. Log to system_logs
      if (user) {
        await supabase.from('system_logs').insert({
          user_id: user.id,
          action: 'FUND_ALLOCATION',
          table_name: 'funds',
          record_id: selectedFundId,
          details: {
            type: transactionType,
            amount: numAmount,
            balance_after: newBalance,
          }
        })
      }

      setModalOpen(false)
      loadData()
      Alert.alert('Success', `Fund ${transactionType.toLowerCase()} saved successfully!`)
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const totalAvailable = funds.reduce((sum, f) => sum + Number(f.current_balance), 0)
  const totalAllocated = funds.reduce((sum, f) => sum + Number(f.total_allocated), 0)
  const totalReleased = funds.reduce((sum, f) => sum + Number(f.total_released), 0)

  const s = styles(colors, isDark)

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={s.container}>
      <GlobalHeader />
      <ScrollView 
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData() }} />}
      >
        <View style={s.headerRow}>
          <Text style={s.pageTitle}>Municipal Funds</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              style={s.allocateBtn} 
              onPress={() => openAllocationModal()}
            >
              <Feather name="plus-circle" size={14} color="#fff" />
              <Text style={s.allocateBtnText}>Allocate</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={s.ledgerBtn} 
              onPress={() => navigation.navigate('FundTransactions')}
            >
              <Feather name="file-text" size={14} color={colors.primary} />
              <Text style={s.ledgerBtnText}>Ledger</Text>
            </TouchableOpacity>
          </View>
        </View>

        {funds.length === 0 && (
          <View style={s.warningBox}>
            <Feather name="alert-triangle" size={20} color="#b45309" />
            <Text style={s.warningText}>No funds available. Please configure funds in database.</Text>
          </View>
        )}

        {funds.map(fund => {
          if (Number(fund.current_balance) <= Number(fund.low_balance_threshold)) {
            return (
              <View key={`warn-${fund.id}`} style={s.warningBox}>
                <Feather name="alert-triangle" size={20} color="#b45309" />
                <View style={{ flex: 1 }}>
                  <Text style={s.warningTitle}>Low Balance: {fund.assistance_type}</Text>
                  <Text style={s.warningText}>
                    Available ({formatCurrency(fund.current_balance)}) reached threshold ({formatCurrency(fund.low_balance_threshold)}).
                  </Text>
                </View>
              </View>
            )
          }
          return null
        })}

        {/* Overall Summary Cards */}
        <View style={s.summaryGrid}>
          <View style={s.summaryCard}>
            <View style={[s.iconBox, { backgroundColor: isDark ? '#1e3a8a' : '#eff6ff' }]}>
              <Feather name="briefcase" size={18} color="#3b82f6" />
            </View>
            <Text style={s.summaryLabel}>Total Available</Text>
            <Text style={s.summaryValue}>{formatCurrency(totalAvailable)}</Text>
          </View>

          <View style={s.summaryCard}>
            <View style={[s.iconBox, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }]}>
              <Feather name="arrow-down-right" size={18} color="#10b981" />
            </View>
            <Text style={s.summaryLabel}>Total Released</Text>
            <Text style={s.summaryValue}>{formatCurrency(totalReleased)}</Text>
          </View>
        </View>

        <View style={s.summaryGrid}>
          <View style={s.summaryCard}>
            <View style={[s.iconBox, { backgroundColor: isDark ? '#312e81' : '#eef2ff' }]}>
              <Feather name="trending-up" size={18} color="#6366f1" />
            </View>
            <Text style={s.summaryLabel}>Total Allocated</Text>
            <Text style={s.summaryValue}>{formatCurrency(totalAllocated)}</Text>
          </View>

          <View style={s.summaryCard}>
            <View style={[s.iconBox, { backgroundColor: isDark ? '#7c2d12' : '#fff7ed' }]}>
              <Feather name="alert-circle" size={18} color="#f97316" />
            </View>
            <Text style={s.summaryLabel}>Pending Releases</Text>
            <Text style={s.summaryValue}>{pendingCount}</Text>
          </View>
        </View>

        {/* Breakdown */}
        <Text style={s.sectionTitle}>Fund Breakdown</Text>
        {funds.map(fund => {
          const percentage = fund.total_allocated > 0 
            ? (Number(fund.current_balance) / Number(fund.total_allocated)) * 100 
            : 0

          return (
            <View key={fund.id} style={s.fundCard}>
              <View style={s.fundHeader}>
                <View>
                  <Text style={s.fundType}>{fund.assistance_type} Assistance</Text>
                  <Text style={s.fundThreshold}>Threshold: {formatCurrency(fund.low_balance_threshold)}</Text>
                </View>
                <TouchableOpacity onPress={() => openAllocationModal(fund.id)}>
                  <Feather name="plus-circle" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={s.balanceRow}>
                <Text style={s.balanceLabel}>Available Balance</Text>
                <Text style={s.balanceValue}>{formatCurrency(fund.current_balance)}</Text>
              </View>

              <View style={s.progressBarBg}>
                <View style={[s.progressBarFill, { 
                  width: `${Math.min(percentage, 100)}%`,
                  backgroundColor: percentage > 20 ? '#3b82f6' : '#ef4444'
                }]} />
              </View>

              <View style={s.fundFooter}>
                <View>
                  <Text style={s.footerLabel}>Total Allocated</Text>
                  <Text style={s.footerValue}>{formatCurrency(fund.total_allocated)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.footerLabel}>Total Released</Text>
                  <Text style={s.footerValue}>{formatCurrency(fund.total_released)}</Text>
                </View>
              </View>
            </View>
          )
        })}

        {/* Recent Transactions */}
        <View style={[s.headerRow, { marginTop: 24 }]}>
          <Text style={s.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => navigation.navigate('FundTransactions')}>
            <Text style={s.viewAllText}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={s.txList}>
          {transactions.length === 0 && (
            <Text style={s.emptyTx}>No recent transactions</Text>
          )}
          {transactions.map((tx, index) => (
            <View key={tx.id} style={[s.txItem, index === transactions.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={s.txIconBox}>
                <Feather name={tx.transaction_type === 'Allocation' ? 'arrow-up-right' : 'arrow-down-right'} size={16} color={tx.transaction_type === 'Allocation' ? '#6366f1' : '#f97316'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.txType}>{tx.transaction_type}</Text>
                <Text style={s.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.txAmount, tx.transaction_type === 'Allocation' ? { color: '#6366f1' } : { color: colors.text }]}>
                  {tx.transaction_type === 'Allocation' ? '+' : '-'}{formatCurrency(tx.amount)}
                </Text>
                <Text style={s.txBalance}>Bal: {formatCurrency(tx.balance_after)}</Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* Allocation Modal */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Fund Allocation / Adjustment</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.inputLabel}>Select Assistance Fund</Text>
              <View style={s.chipRow}>
                {funds.map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    style={[s.chip, selectedFundId === f.id && s.chipActive]}
                    onPress={() => handleFundChange(f.id)}
                  >
                    <Text style={[s.chipText, selectedFundId === f.id && s.chipTextActive]}>
                      {f.assistance_type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.inputLabel}>Transaction Type</Text>
              <View style={s.chipRow}>
                {(['Allocation', 'Adjustment'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[s.chip, transactionType === type && s.chipActive]}
                    onPress={() => setTransactionType(type)}
                  >
                    <Text style={[s.chipText, transactionType === type && s.chipTextActive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.inputLabel}>Amount (₱)</Text>
              <TextInput
                style={s.input}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              <Text style={s.inputLabel}>Low Balance Threshold (₱)</Text>
              <TextInput
                style={s.input}
                placeholder="Alert threshold..."
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={threshold}
                onChangeText={setThreshold}
              />

              <Text style={s.inputLabel}>Remarks / Source of Fund</Text>
              <TextInput
                style={[s.input, { height: 75, textAlignVertical: 'top' }]}
                placeholder="e.g. Q3 LGU Internal Allocation"
                placeholderTextColor={colors.textSecondary}
                value={remarks}
                onChangeText={setRemarks}
                multiline
              />

              <View style={s.modalButtons}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setModalOpen(false)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.submitBtn}
                  activeOpacity={0.8}
                  onPress={handleSubmitAllocation}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.submitBtnText}>Save Allocation</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  allocateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  allocateBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  ledgerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  ledgerBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: isDark ? 'rgba(180, 83, 9, 0.2)' : '#fef3c7', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: isDark ? 'rgba(180, 83, 9, 0.5)' : '#fde68a', marginBottom: 16 },
  warningTitle: { fontSize: 14, fontWeight: '700', color: isDark ? '#fbbf24' : '#92400e', marginBottom: 4 },
  warningText: { fontSize: 13, color: isDark ? '#fcd34d' : '#b45309', lineHeight: 20 },
  summaryGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: colors.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 8, marginBottom: 16 },
  viewAllText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  fundCard: { backgroundColor: colors.card, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  fundHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  fundType: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 },
  fundThreshold: { fontSize: 12, color: colors.textSecondary },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  balanceLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  balanceValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  progressBarBg: { height: 8, backgroundColor: isDark ? '#334155' : '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginBottom: 18 },
  progressBarFill: { height: '100%', borderRadius: 4 },
  fundFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 },
  footerLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 },
  footerValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  txList: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  emptyTx: { padding: 20, textAlign: 'center', color: colors.textSecondary, fontSize: 14 },
  txItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  txIconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? '#334155' : '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txType: { fontSize: 14, fontWeight: '600', color: colors.text },
  txDate: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txBalance: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  chip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: isDark ? 'rgba(37, 99, 235, 0.25)' : '#eff6ff',
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  input: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    paddingBottom: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
})
