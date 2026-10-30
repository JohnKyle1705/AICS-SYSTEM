import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions, useWindowDimensions } from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { useAuth } from '../lib/AuthContext'
import { useLanguage } from '../lib/LanguageContext'
import { Feather } from '@expo/vector-icons'

import { PieChart, BarChart, LineChart } from 'react-native-chart-kit'

const ASSISTANCE_TYPES = ['Medical', 'Burial'] as const
const ASSISTANCE_COLORS: Record<string, string> = {
  Medical: '#3b82f6',
  Burial: '#64748b'
}
const STATUS_COLORS: Record<string, string> = {
  Pending: '#f59e0b',
  Approved: '#3b82f6',
  Released: '#10b981',
  Declined: '#ef4444',
}
const STATUS_TEXT_COLORS: Record<string, { light: string; dark: string }> = {
  Pending:  { light: '#b45309', dark: '#fbbf24' },
  Approved: { light: '#1d4ed8', dark: '#60a5fa' },
  Released: { light: '#047857', dark: '#34d399' },
  Declined: { light: '#b91c1c', dark: '#f87171' },
}
const BARANGAYS = [
  'Aguho', 'Bagay', 'Bakhaw', 'Bateria', 'Bitoon', 'Calape', 'Carnaza',
  'Daanbantayan', 'Dalingding', 'Lanao', 'Logon', 'Malbago', 'Malingin',
  'Maya', 'Pajo', 'Paypay', 'Poblacion', 'Talisay', 'Tapilon', 'Tinubdan', 'Tominjao'
]

function getLastNMonths(n: number) {
  const months = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString('default', { month: 'short' }) })
  }
  return months
}

export default function ReportsScreen({ navigation }: any) {
  const { colors, isDark } = useTheme()
  const { profile } = useAuth()
  const { t } = useLanguage()
  const { width } = useWindowDimensions()

  const chartWidth = width - 48

  const [loading, setLoading] = useState(true)
  const [allData, setAllData] = useState<any[]>([])
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [includeDeclined, setIncludeDeclined] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'table'>('overview')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('requests')
      .select('*, beneficiaries(first_name, last_name, barangay)')
      .order('created_at', { ascending: false })
    setAllData(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Real-time synchronization when requests change in database
  useEffect(() => {
    const channel = supabase
      .channel('mobile_reports_requests_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        load()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  // Base scoped data respecting type & status filters
  const scopedData = allData.filter(r => {
    if (filterType && r.assistance_type !== filterType) return false
    if (filterStatus && r.status !== filterStatus) return false
    return true
  })

  // Apply filters — Declined excluded by default for charts and breakdown tables
  const filtered = scopedData.filter(r => {
    if (!includeDeclined && r.status === 'Declined') return false
    return true
  })

  // Stats — numbers directly match database requests for synchronization
  const stats = {
    total: scopedData.length,
    pending: scopedData.filter(r => r.status === 'Pending').length,
    approved: scopedData.filter(r => ['Approved', 'Released'].includes(r.status)).length,
    declined: scopedData.filter(r => r.status === 'Declined').length,
    totalAmount: scopedData.reduce((s, r) => s + Number(r.amount_approved || 0), 0),
  }

  const legendTextColor = isDark ? '#cbd5e1' : '#334155'
  const chartSurface = isDark ? '#0f172a' : '#ffffff'

  // Pie data - by type
  const byTypePie = ASSISTANCE_TYPES
    .map((t) => ({ name: t, population: filtered.filter(r => r.assistance_type === t).length, color: ASSISTANCE_COLORS[t], legendFontColor: legendTextColor, legendFontSize: 12 }))
    .filter(x => x.population > 0)

  // Donut data - by status
  const byStatusPie = Object.entries(STATUS_COLORS)
    .map(([name, color]) => ({ name, population: filtered.filter(r => r.status === name).length, color, legendFontColor: legendTextColor, legendFontSize: 12 }))
    .filter(x => x.population > 0)

  // Bar chart - top 5 barangays
  const byBarangay = BARANGAYS
    .map(b => ({ name: b.slice(0, 6), count: filtered.filter(r => r.beneficiaries?.barangay === b).length }))
    .filter(x => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 5)

  // Line chart - last 6 months (synchronized with Web Declined toggle)
  const months = getLastNMonths(6)
  const monthlyLabels = months.map(m => m.label)
  const monthlyBase = includeDeclined ? allData : allData.filter(r => r.status !== 'Declined')
  const monthlyDataSets = months.map(m =>
    monthlyBase.filter(r => {
      const d = new Date(r.created_at)
      return d.getFullYear() === m.year && d.getMonth() === m.month
    }).length
  )
  const monthlyApproved = months.map(m =>
    monthlyBase.filter(r => {
      const d = new Date(r.created_at)
      return d.getFullYear() === m.year && d.getMonth() === m.month && ['Approved', 'Released'].includes(r.status)
    }).length
  )

  const chartConfig = {
    backgroundColor: chartSurface,
    backgroundGradientFrom: chartSurface,
    backgroundGradientTo: chartSurface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
    labelColor: (opacity = 1) => isDark ? `rgba(203, 213, 225, ${opacity})` : `rgba(51, 65, 85, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: '4', strokeWidth: '2', stroke: '#2563eb' },
  }

  const s = styles(colors, isDark)

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.loadingText}>{t('reports_loading')}</Text>
      </View>
    )

  }

  return (
    <View style={s.container}>
      {/* Tabs */}
      <View style={s.tabBar}>
        {(['overview', 'charts', 'table'] as const).map(tab => (
          <TouchableOpacity key={tab} style={[s.tab, activeTab === tab && s.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab === 'overview' ? t('reports_tabOverview') : tab === 'charts' ? t('reports_tabCharts') : t('reports_tabTable')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>


      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        {/* Declined toggle chip */}
        <TouchableOpacity
          style={[
            s.chip,
            includeDeclined
              ? { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#fef2f2', borderColor: isDark ? '#f87171' : '#dc2626' }
              : { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5', borderColor: isDark ? '#34d399' : '#059669' },
          ]}
          onPress={() => { setIncludeDeclined(v => !v); setFilterStatus('') }}
        >
          <Text
            style={[
              s.chipText,
              { color: includeDeclined ? (isDark ? '#f87171' : '#dc2626') : (isDark ? '#34d399' : '#047857') },
            ]}
          >
            {includeDeclined ? t('reports_declinedVisible') : t('reports_declinedHidden')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.chip, !filterType && s.chipActive]} onPress={() => setFilterType('')}>
          <Text style={[s.chipText, !filterType && s.chipTextActive]}>{t('reports_allTypes')}</Text>
        </TouchableOpacity>

        {ASSISTANCE_TYPES.map(typeName => {
          const activeText = typeName === 'Medical' ? (isDark ? '#60a5fa' : '#1d4ed8') : (isDark ? '#cbd5e1' : '#334155')
          return (
            <TouchableOpacity key={typeName} style={[s.chip, filterType === typeName && { backgroundColor: ASSISTANCE_COLORS[typeName] + '22', borderColor: activeText }]} onPress={() => setFilterType(filterType === typeName ? '' : typeName)}>
              <Text style={[s.chipText, filterType === typeName && { color: activeText, fontWeight: '700' }]}>{typeName}</Text>
            </TouchableOpacity>
          )
        })}
        {['Pending', 'Approved', 'Released', ...(includeDeclined ? ['Declined'] : [])].map(st => {
          const stTextColor = (STATUS_TEXT_COLORS[st] || STATUS_TEXT_COLORS.Pending)[isDark ? 'dark' : 'light']
          return (
            <TouchableOpacity key={st} style={[s.chip, filterStatus === st && { backgroundColor: STATUS_COLORS[st] + '22', borderColor: stTextColor }]} onPress={() => setFilterStatus(filterStatus === st ? '' : st)}>
              <Text style={[s.chipText, filterStatus === st && { color: stTextColor, fontWeight: '700' }]}>{st}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Record Summary Line (matches Web) */}
        <Text style={s.summaryMeta}>
          {filtered.length} of {allData.length} records ·{' '}
          <Text style={{ color: includeDeclined ? (isDark ? '#fbbf24' : '#d97706') : (isDark ? '#34d399' : '#059669'), fontWeight: '700' }}>
            {includeDeclined ? t('reports_allIncluded') : t('reports_declinedExcluded')}
          </Text>
        </Text>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* Stat Grid - Clickable Summary Cards */}
            <View style={s.grid}>
              {[
                { label: t('dashboard_totalRequests'), value: stats.total, color: isDark ? '#a78bfa' : '#7c3aed', bg: isDark ? '#2d2442' : '#f5f3ff', icon: 'file-text', status: 'All' },
                { label: t('dashboard_approved'), value: stats.approved, color: isDark ? '#34d399' : '#059669', bg: isDark ? '#143d2c' : '#ecfdf5', icon: 'check-circle', status: 'Approved' },
                { label: t('dashboard_pending'), value: stats.pending, color: isDark ? '#fbbf24' : '#d97706', bg: isDark ? '#3d3014' : '#fffbeb', icon: 'clock', status: 'Pending' },
                { label: t('dashboard_declined'), value: stats.declined, color: isDark ? '#f87171' : '#dc2626', bg: isDark ? '#3d1414' : '#fef2f2', icon: 'x-circle', status: 'Declined' },
              ].map(({ label, value, color, bg, icon, status }) => (
                <TouchableOpacity
                  key={label}
                  style={[s.statCard, { borderLeftColor: color }]}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Main' as never, { screen: 'Requests', params: { statusFilter: status } } as never)}
                >
                  <View style={[s.statIcon, { backgroundColor: bg }]}>
                    <Feather name={icon as any} size={18} color={color} />
                  </View>
                  <Text style={s.statLabel}>{label}</Text>
                  <Text style={[s.statValue, { color: colors.text }]}>{value}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Amount Banner */}
            <View style={s.amountBanner}>
              <View style={s.amountIconBox}>
                <Feather name="trending-up" size={24} color="#ffffff" />
              </View>
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={s.amountLabel}>{t('reports_totalAmount')}</Text>
                <Text style={s.amountValue}>₱{stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            </View>

            {/* Type breakdown list */}
            <Text style={s.sectionTitle}>{t('reports_byType')}</Text>

            {ASSISTANCE_TYPES.map(t => {
              const count = filtered.filter(r => r.assistance_type === t).length
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
              return (
                <View key={t} style={s.typeRow}>
                  <View style={[s.typeDot, { backgroundColor: ASSISTANCE_COLORS[t] }]} />
                  <Text style={s.typeName}>{t}</Text>
                  <View style={s.typeBar}>
                    <View style={[s.typeBarFill, { width: `${pct}%`, backgroundColor: ASSISTANCE_COLORS[t] }]} />
                  </View>
                  <Text style={s.typeCount}>{count}</Text>
                </View>
              )
            })}
          </>
        )}

        {/* CHARTS TAB */}
        {activeTab === 'charts' && (
          <>
            {/* Line Chart */}
            <Text style={s.sectionTitle}>{t('reports_trend')}</Text>
            <Text style={s.sectionSubtitle}>{t('reports_lastMonths')}</Text>

            {monthlyDataSets.some(v => v > 0) ? (
              <View style={s.chartCard}>
                <LineChart
                  {...({
                    data: { labels: monthlyLabels, datasets: [{ data: monthlyDataSets, color: (o = 1) => `rgba(59,130,246,${o})`, strokeWidth: 2 }, { data: monthlyApproved, color: (o = 1) => `rgba(16,185,129,${o})`, strokeWidth: 2 }] },
                    width: chartWidth,
                    height: 200,
                    chartConfig: chartConfig,
                    bezier: true,
                    style: { borderRadius: 16 },
                    withDots: true,
                    withInnerLines: false,
                    legend: [t('all'), t('dashboard_approved')]
                  } as any)}
                />
              </View>
            ) : <View style={s.empty}><Text style={s.emptyText}>{t('reports_noTrend')}</Text></View>}

            {/* Pie Chart - Type */}
            <Text style={[s.sectionTitle, { marginTop: 20 }]}>{t('reports_byType')}</Text>

            {byTypePie.length > 0 ? (
              <View style={s.chartCard}>
                <PieChart
                  data={byTypePie}
                  width={chartWidth}
                  height={200}
                  chartConfig={chartConfig}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="16"
                  center={[10, 0]}
                />
              </View>
            ) : <View style={s.empty}><Text style={s.emptyText}>{t('reports_noTypeData')}</Text></View>}

            {/* Donut - Status */}
            <Text style={[s.sectionTitle, { marginTop: 20 }]}>{t('reports_statusBreakdown')}</Text>

            {byStatusPie.length > 0 ? (
              <View style={s.chartCard}>
                <PieChart
                  data={byStatusPie}
                  width={chartWidth}
                  height={200}
                  chartConfig={chartConfig}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="16"
                  center={[10, 0]}
                />
              </View>
            ) : <View style={s.empty}><Text style={s.emptyText}>{t('reports_noStatusData')}</Text></View>}

            {/* Bar Chart - Barangay */}
            <Text style={[s.sectionTitle, { marginTop: 20 }]}>{t('reports_topBarangays')}</Text>

            {byBarangay.length > 0 ? (
              <View style={s.chartCard}>
                <BarChart
                  data={{ labels: byBarangay.map(b => b.name), datasets: [{ data: byBarangay.map(b => b.count) }] }}
                  width={chartWidth}
                  height={200}
                  chartConfig={{ ...chartConfig, color: (o = 1) => `rgba(59,130,246,${o})` }}
                  style={{ borderRadius: 16 }}
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  yAxisLabel=""
                  yAxisSuffix=""
                />
              </View>
            ) : <View style={s.empty}><Text style={s.emptyText}>{t('reports_noBarangayData')}</Text></View>}
          </>
        )}

        {/* TABLE TAB */}
        {activeTab === 'table' && (
          <>
            <Text style={s.sectionTitle}>{t('reports_recentRecords')} ({filtered.length})</Text>

            {filtered.slice(0, 30).map((r, i) => (
              <View key={r.id} style={s.tableRow}>
                <View style={s.tableLeft}>
                  <Text style={s.tableIndex}>{i + 1}</Text>
                  <View>
                    <Text style={s.tableName} numberOfLines={1}>{r.beneficiaries?.last_name}, {r.beneficiaries?.first_name}</Text>
                    <Text style={s.tableSub}>{r.beneficiaries?.barangay} · {r.assistance_type}</Text>
                  </View>
                </View>
                <View style={s.tableRight}>
                  {(() => {
                    const stColor = (STATUS_TEXT_COLORS[r.status] || STATUS_TEXT_COLORS.Pending)[isDark ? 'dark' : 'light']
                    return (
                      <View style={[s.statusBadge, { backgroundColor: stColor + '20' }]}>
                        <Text style={[s.statusText, { color: stColor }]}>{r.status}</Text>
                      </View>
                    )
                  })()}
                  <Text style={s.tableAmount}>{r.amount_approved ? `₱${Number(r.amount_approved).toLocaleString()}` : '—'}</Text>
                </View>
              </View>
            ))}
            {filtered.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyText}>{t('noData')}</Text>
              </View>
            )}

          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: 12 },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  tabBar: { flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  filterBar: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignSelf: 'center' },
  chipActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.primary },
  scroll: { flex: 1 },
  content: { padding: 16 },
  summaryMeta: { fontSize: 13, color: colors.textSecondary, fontWeight: '500', marginBottom: 14 },
  amountBanner: { borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: '#2563eb', borderWidth: 1, borderColor: '#4f46e5', shadowColor: '#2563eb', shadowOpacity: 0.28, shadowRadius: 12, elevation: 5 },
  amountIconBox: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', justifyContent: 'center', alignItems: 'center' },
  amountLabel: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  amountValue: { color: '#ffffff', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { width: '47.5%', backgroundColor: colors.card, borderRadius: 14, padding: 14, borderLeftWidth: 4, borderWidth: 1, borderColor: colors.border },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 },
  statLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: colors.textSecondary, marginBottom: 12 },
  typeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  typeDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  typeName: { fontSize: 13, fontWeight: '600', color: colors.text, width: 80 },
  typeBar: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  typeBarFill: { height: 8, borderRadius: 4 },
  typeCount: { fontSize: 13, fontWeight: '700', color: colors.text, width: 30, textAlign: 'right' },
  chartCard: { backgroundColor: colors.card, borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', overflow: 'hidden' },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
  tableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  tableLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  tableIndex: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, width: 20 },
  tableName: { fontSize: 13, fontWeight: '700', color: colors.text, maxWidth: 160 },
  tableSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  tableRight: { alignItems: 'flex-end', gap: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  tableAmount: { fontSize: 12, fontWeight: '700', color: colors.text },
})
