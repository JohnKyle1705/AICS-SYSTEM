import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, ScrollView
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { Feather } from '@expo/vector-icons'
import GlobalHeader from '../components/GlobalHeader'

export default function FundTransactionsScreen({ navigation }: any) {
  const { colors, isDark } = useTheme()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const loadTransactions = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('fund_transactions')
      .select('*, funds(assistance_type), profiles(full_name), requests(beneficiary_id, beneficiaries(first_name, last_name))')
      .order('created_at', { ascending: false })

    if (typeFilter) {
      query = query.eq('transaction_type', typeFilter)
    }

    const { data, error } = await query
    if (error) {
      console.log('Error fetching transactions', error)
    }

    const filtered = data?.filter(tx => {
      if (!search) return true
      const q = search.toLowerCase()
      const typeMatch = tx.funds?.assistance_type?.toLowerCase().includes(q)
      const profMatch = tx.profiles?.full_name?.toLowerCase().includes(q)
      const benMatch = tx.requests?.beneficiaries?.first_name?.toLowerCase().includes(q) || tx.requests?.beneficiaries?.last_name?.toLowerCase().includes(q)
      const remMatch = tx.remarks?.toLowerCase().includes(q)
      return typeMatch || profMatch || benMatch || remMatch
    })

    setTransactions(filtered || [])
    setLoading(false)
  }, [search, typeFilter])

  useEffect(() => { loadTransactions() }, [loadTransactions])

  const formatCurrency = (amount: number) => {
    return '₱' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const s = styles(colors, isDark)

  const renderItem = ({ item: tx }: any) => {
    const isAdd = tx.transaction_type === 'Allocation'
    const isSubtract = tx.transaction_type === 'Release' || tx.transaction_type === 'Adjustment'
    
    return (
      <View style={s.card}>
        <View style={s.cardHeader}>
          <View style={s.typeBox}>
            <View style={[s.iconCircle, isAdd ? { backgroundColor: 'rgba(99, 102, 241, 0.1)' } : { backgroundColor: 'rgba(249, 115, 22, 0.1)' }]}>
              <Feather name={isAdd ? 'arrow-up-right' : 'arrow-down-right'} size={14} color={isAdd ? '#6366f1' : '#f97316'} />
            </View>
            <Text style={s.typeText}>{tx.transaction_type}</Text>
          </View>
          <Text style={s.dateText}>{new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
        </View>

        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.fundType}>{tx.funds?.assistance_type} Assistance</Text>
            {tx.requests?.beneficiaries && (
              <Text style={s.benName}>For: {tx.requests.beneficiaries.first_name} {tx.requests.beneficiaries.last_name}</Text>
            )}
            {tx.remarks ? <Text style={s.remarks}>{tx.remarks}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.amount, isAdd ? { color: '#6366f1' } : { color: colors.text }]}>
              {isAdd ? '+' : '-'}{formatCurrency(tx.amount)}
            </Text>
            <Text style={s.balance}>Bal: {formatCurrency(tx.balance_after)}</Text>
          </View>
        </View>

        <View style={s.cardFooter}>
          <Feather name="user" size={12} color={colors.textSecondary} />
          <Text style={s.processorName}>{tx.profiles?.full_name}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={s.container}>
      <GlobalHeader />
      
      <View style={s.filterContainer}>
        <View style={s.searchBox}>
          <Feather name="search" size={16} color={colors.textSecondary} style={s.searchIcon} />
          <TextInput
            style={s.searchInput}
            placeholder="Search transactions..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={s.chipsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity 
              style={[s.chip, !typeFilter && s.chipActive]} 
              onPress={() => setTypeFilter('')}
            >
              <Text style={[s.chipText, !typeFilter && s.chipTextActive]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[s.chip, typeFilter === 'Allocation' && s.chipActive]} 
              onPress={() => setTypeFilter('Allocation')}
            >
              <Text style={[s.chipText, typeFilter === 'Allocation' && s.chipTextActive]}>Allocations</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[s.chip, typeFilter === 'Release' && s.chipActive]} 
              onPress={() => setTypeFilter('Release')}
            >
              <Text style={[s.chipText, typeFilter === 'Release' && s.chipTextActive]}>Releases</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <Feather name="file-text" size={40} color={colors.textSecondary} opacity={0.5} />
              <Text style={s.emptyText}>No transactions found.</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterContainer: { padding: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 10, paddingHorizontal: 12, height: 40, marginBottom: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  chipsRow: { flexDirection: 'row' },
  chip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
  chipActive: { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff', borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.primary },
  listContent: { padding: 16 },
  card: { backgroundColor: colors.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  typeBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconCircle: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  typeText: { fontSize: 13, fontWeight: '700', color: colors.text },
  dateText: { fontSize: 11, color: colors.textSecondary },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  fundType: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  benName: { fontSize: 13, color: colors.primary, fontWeight: '500', marginBottom: 2 },
  remarks: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  amount: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  balance: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  processorName: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: 12 },
})
