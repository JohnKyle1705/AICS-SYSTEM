import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { Feather } from '@expo/vector-icons'
import { format } from 'date-fns'

export default function AssessmentsScreen({ navigation }: any) {
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()
  const [assessments, setAssessments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')

  const loadData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('assessments')
        .select('*, requests(id, assistance_type, status, beneficiaries(first_name, last_name, barangay))')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAssessments(data ?? [])
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const onRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  const filtered = assessments.filter((a) => {
    const ben = a.requests?.beneficiaries
    const name = `${ben?.first_name || ''} ${ben?.last_name || ''}`.toLowerCase()
    const matchesSearch = name.includes(search.toLowerCase())
    const matchesType = typeFilter === 'All' || a.requests?.assistance_type === typeFilter
    return matchesSearch && matchesType
  })

  const s = styles(colors, isDark)

  const renderItem = ({ item }: { item: any }) => {
    const ben = item.requests?.beneficiaries
    const benName = ben ? `${ben.last_name}, ${ben.first_name}` : 'Unknown Beneficiary'
    const dateStr = item.interview_date ? format(new Date(item.interview_date), 'MMM d, yyyy') : '—'
    const reqType = item.requests?.assistance_type || 'General'

    return (
      <TouchableOpacity
        style={s.card}
        activeOpacity={0.7}
        onPress={() => item.request_id && navigation.navigate('RequestDetail', { id: item.request_id })}
      >
        <View style={s.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.beneficiaryName}>{benName}</Text>
            {ben?.barangay && <Text style={s.barangayText}>Brgy. {ben.barangay}</Text>}
          </View>
          <View style={[s.typeBadge, { backgroundColor: reqType === 'Medical' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(100, 116, 139, 0.15)' }]}>
            <Text style={[s.typeBadgeText, { color: reqType === 'Medical' ? '#2563eb' : '#475569' }]}>
              {reqType}
            </Text>
          </View>
        </View>

        <View style={s.detailRow}>
          <View style={s.metaItem}>
            <Feather name="calendar" size={13} color={colors.textSecondary} />
            <Text style={s.metaText}>{dateStr}</Text>
          </View>
          <View style={s.metaItem}>
            <Feather name="home" size={13} color={item.home_visit ? '#10b981' : colors.textSecondary} />
            <Text style={[s.metaText, item.home_visit && { color: '#10b981', fontWeight: '600' }]}>
              {item.home_visit ? 'Home Visit: Yes' : 'Home Visit: No'}
            </Text>
          </View>
        </View>

        {item.recommendation ? (
          <View style={s.recommendationBox}>
            <Text style={s.recLabel}>Recommendation:</Text>
            <Text style={s.recText} numberOfLines={2}>{item.recommendation}</Text>
          </View>
        ) : null}

        <View style={s.cardFooter}>
          <Text style={s.viewRequestText}>View Request Details</Text>
          <Feather name="chevron-right" size={16} color={colors.primary} />
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={s.container}>
      {/* Search & Filter Bar */}
      <View style={s.filterContainer}>
        <View style={s.searchBar}>
          <Feather name="search" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Search by beneficiary name..."
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

        {/* Filter Pills */}
        <View style={s.pillRow}>
          {['All', 'Medical', 'Burial'].map((tVal) => (
            <TouchableOpacity
              key={tVal}
              style={[s.pill, typeFilter === tVal && s.pillActive]}
              onPress={() => setTypeFilter(tVal)}
            >
              <Text style={[s.pillText, typeFilter === tVal && s.pillTextActive]}>{tVal}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Feather name="clipboard" size={42} color={colors.textSecondary} style={{ opacity: 0.4 }} />
              <Text style={s.emptyText}>No assessments found</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  beneficiaryName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  barangayText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  recommendationBox: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
    padding: 10,
    borderRadius: 10,
    marginVertical: 8,
  },
  recLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  recText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  viewRequestText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
})
