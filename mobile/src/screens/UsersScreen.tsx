import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView,
  RefreshControl, SectionList,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffUser {
  id: string
  full_name: string
  role: 'admin' | 'treasurer'
  is_active: boolean
  created_at: string
  email: string
}

interface ResidentUser {
  id: string
  full_name: string
  role: 'resident'
  is_active: boolean
  created_at: string
  email: string
  contact_number: string
  beneficiary?: {
    address?: string
    barangay?: string
    birthdate?: string
    civil_status?: string
    sex?: string
  } | null
}

const RESIDENTS_PER_PAGE = 8

// ─── Avatar ───────────────────────────────────────────────────────────────────

function AvatarBubble({ name, color }: { name: string; color: string }) {
  const initial = name?.charAt(0)?.toUpperCase() ?? '?'
  return (
    <View style={[styles.avatarBubble, { backgroundColor: color }]}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeaderBar({
  icon, title, subtitle, accentColor, isDark,
}: {
  icon: string; title: string; subtitle?: string; accentColor: string; isDark: boolean
}) {
  return (
    <View style={[styles.sectionHeaderBar, { backgroundColor: isDark ? '#0f1624' : '#f8fafc' }]}>
      <View style={[styles.sectionIconBadge, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
        <Feather name={icon as any} size={18} color={accentColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionHeaderTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.sectionHeaderSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <View style={[styles.statusBadge, { backgroundColor: active ? '#10b98120' : '#ef444420' }]}>
      <View style={[styles.statusDot, { backgroundColor: active ? '#10b981' : '#ef4444' }]} />
      <Text style={[styles.statusBadgeText, { color: active ? '#10b981' : '#ef4444' }]}>
        {active ? 'Active' : 'Inactive'}
      </Text>
    </View>
  )
}

// ─── Search + Filter Row ──────────────────────────────────────────────────────

type StatusFilter = 'all' | 'active' | 'inactive'

function SearchFilterRow({
  search, onSearch, statusFilter, onStatusFilter, placeholder, isDark, colors,
}: {
  search: string; onSearch: (v: string) => void
  statusFilter: StatusFilter; onStatusFilter: (v: StatusFilter) => void
  placeholder: string; isDark: boolean; colors: any
}) {
  return (
    <View style={styles.searchFilterRow}>
      <View style={[styles.searchBox, {
        backgroundColor: isDark ? '#1e293b' : '#fff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
      }]}>
        <Feather name="search" size={14} color={isDark ? '#64748b' : '#94a3b8'} />
        <TextInput
          style={[styles.searchInput, { color: isDark ? '#f1f5f9' : '#0f172a' }]}
          value={search}
          onChangeText={onSearch}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => onSearch('')}>
            <Feather name="x" size={14} color={isDark ? '#64748b' : '#94a3b8'} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.filterRow, {
        backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
        borderColor: isDark ? '#334155' : '#e2e8f0',
      }]}>
        {(['all', 'active', 'inactive'] as StatusFilter[]).map(opt => (
          <TouchableOpacity
            key={opt}
            onPress={() => onStatusFilter(opt)}
            style={[
              styles.filterChip,
              statusFilter === opt && {
                backgroundColor:
                  opt === 'active' ? '#10b98130' :
                  opt === 'inactive' ? '#ef444430' :
                  colors.primary + '30',
              }
            ]}
          >
            <Text style={[
              styles.filterChipText,
              { color: isDark ? '#94a3b8' : '#64748b' },
              statusFilter === opt && {
                color:
                  opt === 'active' ? '#10b981' :
                  opt === 'inactive' ? '#ef4444' :
                  colors.primary,
                fontWeight: '700',
              }
            ]}>
              {opt === 'all' ? 'All' : opt === 'active' ? 'Active' : 'Inactive'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function UsersScreen() {
  const { profile } = useAuth()
  const { isDark, colors } = useTheme()
  const insets = useSafeAreaInsets()

  // ── Data State ────────────────────────────────────────────────────────────
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [residents, setResidents] = useState<ResidentUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // ── Staff Section State ───────────────────────────────────────────────────
  const [staffSearch, setStaffSearch] = useState('')
  const [staffStatusFilter, setStaffStatusFilter] = useState<StatusFilter>('all')
  const [showAddStaffModal, setShowAddStaffModal] = useState(false)
  const [staffForm, setStaffForm] = useState({ email: '', full_name: '', password: '', role: 'admin' })
  const [savingStaff, setSavingStaff] = useState(false)

  // ── Resident Section State ────────────────────────────────────────────────
  const [residentSearch, setResidentSearch] = useState('')
  const [residentStatusFilter, setResidentStatusFilter] = useState<StatusFilter>('all')
  const [residentPage, setResidentPage] = useState(1)
  const [viewingResident, setViewingResident] = useState<ResidentUser | null>(null)

  // ── Action State ──────────────────────────────────────────────────────────
  const [processingId, setProcessingId] = useState<string | null>(null)

  // ── Data Loading ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Load staff (admin + treasurer)
      const { data: staffData } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['admin', 'treasurer'])
        .order('full_name')

      // Load residents
      const { data: residentData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'resident')
        .order('full_name')

      // Load beneficiaries for contact numbers
      const { data: bens } = await supabase
        .from('beneficiaries')
        .select('created_by, contact_number, address, barangay, birthdate, civil_status, sex')

      const benMap: Record<string, any> = {}
      bens?.forEach(b => { if (b.created_by) benMap[b.created_by] = b })

      setStaff((staffData ?? []).map(p => ({ ...p, email: '' })) as StaffUser[])
      setResidents((residentData ?? []).map(p => ({
        ...p,
        email: '',
        contact_number: benMap[p.id]?.contact_number ?? '',
        beneficiary: benMap[p.id] ?? null,
      })) as ResidentUser[])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (profile?.role === 'admin') loadData()
  }, [profile])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData()
  }, [loadData])

  // ── Filtered Lists ────────────────────────────────────────────────────────
  const filteredStaff = useMemo(() => staff.filter(u => {
    const s = staffSearch.toLowerCase()
    const matchSearch = !staffSearch || u.full_name.toLowerCase().includes(s)
    const matchStatus =
      staffStatusFilter === 'all' ||
      (staffStatusFilter === 'active' && u.is_active) ||
      (staffStatusFilter === 'inactive' && !u.is_active)
    return matchSearch && matchStatus
  }), [staff, staffSearch, staffStatusFilter])

  const filteredResidents = useMemo(() => residents.filter(u => {
    const s = residentSearch.toLowerCase()
    const matchSearch = !residentSearch ||
      u.full_name.toLowerCase().includes(s) ||
      (u.contact_number || '').includes(residentSearch)
    const matchStatus =
      residentStatusFilter === 'all' ||
      (residentStatusFilter === 'active' && u.is_active) ||
      (residentStatusFilter === 'inactive' && !u.is_active)
    return matchSearch && matchStatus
  }), [residents, residentSearch, residentStatusFilter])

  const totalResidentPages = Math.max(1, Math.ceil(filteredResidents.length / RESIDENTS_PER_PAGE))
  const pagedResidents = filteredResidents.slice(
    (residentPage - 1) * RESIDENTS_PER_PAGE,
    residentPage * RESIDENTS_PER_PAGE
  )

  useEffect(() => { setResidentPage(1) }, [residentSearch, residentStatusFilter])

  // ── Summary Stats ─────────────────────────────────────────────────────────
  const activeStaff = staff.filter(u => u.is_active).length
  const activeResidents = residents.filter(u => u.is_active).length
  const inactiveResidents = residents.filter(u => !u.is_active).length

  // ── Actions ───────────────────────────────────────────────────────────────
  const toggleActive = async (userId: string, currentState: boolean, isResident: boolean) => {
    const newState = !currentState
    const label = isResident ? 'resident' : 'staff'
    const actionLabel = newState ? 'Activate' : 'Deactivate'

    Alert.alert(
      `${actionLabel} ${label}?`,
      `Are you sure you want to ${actionLabel.toLowerCase()} this account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionLabel,
          style: newState ? 'default' : 'destructive',
          onPress: async () => {
            setProcessingId(userId)
            const { error } = await supabase.from('profiles').update({ is_active: newState }).eq('id', userId)

            if (error) {
              Alert.alert('Error', error.message)
              setProcessingId(null)
              return
            }

            // Audit log & Admin notification
            const { data: { user: admin } } = await supabase.auth.getUser()
            if (admin) {
              await supabase.from('system_logs').insert({
                user_id: admin.id,
                action: newState ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
                table_name: 'profiles',
                record_id: userId,
              })

              // Notify admin on resident activation
              if (isResident && newState) {
                await supabase.from('notifications').insert({
                  user_id: admin.id,
                  title: 'Activate Resident',
                  message: 'You have successfully approved and activated a resident account.',
                  type: 'info',
                })
              }
            }

            if (isResident) {
              setResidents(prev => prev.map(u => u.id === userId ? { ...u, is_active: newState } : u))
            } else {
              setStaff(prev => prev.map(u => u.id === userId ? { ...u, is_active: newState } : u))
            }
            setProcessingId(null)
          },
        },
      ]
    )
  }

  const deleteUser = (userId: string, userName: string, isResident: boolean) => {
    Alert.alert(
      'Delete Account',
      `Are you sure you want to permanently delete "${userName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(userId)
            const { error } = await supabase.from('profiles').delete().eq('id', userId)
            if (error) {
              Alert.alert('Error', error.message)
              setProcessingId(null)
              return
            }

            // Audit log
            const { data: { user: admin } } = await supabase.auth.getUser()
            if (admin) {
              await supabase.from('system_logs').insert({
                user_id: admin.id,
                action: 'DELETE_USER',
                table_name: 'profiles',
                record_id: userId,
              })
            }

            if (isResident) {
              setResidents(prev => prev.filter(u => u.id !== userId))
            } else {
              setStaff(prev => prev.filter(u => u.id !== userId))
            }
            setProcessingId(null)
          },
        },
      ]
    )
  }

  const createStaffUser = async () => {
    if (!staffForm.email.trim() || !staffForm.full_name.trim() || !staffForm.password.trim()) {
      Alert.alert('Required', 'Please fill in all fields.')
      return
    }
    if (staffForm.password.length < 6) {
      Alert.alert('Required', 'Password must be at least 6 characters.')
      return
    }
    if (!['admin', 'treasurer'].includes(staffForm.role)) {
      Alert.alert('Error', 'Only Administrator and Treasurer accounts can be created here.')
      return
    }
    setSavingStaff(true)
    try {
      const tempClient = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL!,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      )

      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: staffForm.email.trim(),
        password: staffForm.password,
        options: {
          data: {
            full_name: staffForm.full_name.trim(),
          },
        },
      })

      if (authError) {
        Alert.alert('Error', authError.message)
        return
      }

      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: authData.user.id,
          full_name: staffForm.full_name.trim(),
          role: staffForm.role,
          is_active: true,
        })

        if (profileError) {
          Alert.alert('Error', profileError.message)
          return
        }

        // Audit log
        const { data: { user: admin } } = await supabase.auth.getUser()
        if (admin) {
          await supabase.from('system_logs').insert({
            user_id: admin.id,
            action: 'CREATE_STAFF_USER',
            table_name: 'profiles',
            record_id: authData.user.id,
          })
        }

        Alert.alert(
          'Success',
          `${staffForm.role === 'admin' ? 'Administrator' : 'Treasurer'} account created successfully!`
        )
        setShowAddStaffModal(false)
        setStaffForm({ email: '', full_name: '', password: '', role: 'admin' })
        loadData()
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create staff account')
    } finally {
      setSavingStaff(false)
    }
  }

  // ── Guard: admin only ─────────────────────────────────────────────────────
  if (profile?.role !== 'admin') {
    return (
      <View style={[styles.centerContainer, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}>
        <Feather name="shield-off" size={48} color={isDark ? '#475569' : '#cbd5e1'} />
        <Text style={[styles.errorText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          Unauthorized Access
        </Text>
        <Text style={[styles.errorSubtext, { color: isDark ? '#475569' : '#94a3b8' }]}>
          Only administrators can view user management.
        </Text>
      </View>
    )
  }

  const bg = isDark ? '#020617' : '#f1f5f9'
  const cardBg = isDark ? '#0f1624' : '#ffffff'
  const borderColor = isDark ? '#1e293b' : '#e2e8f0'
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a'
  const textSecondary = isDark ? '#94a3b8' : '#64748b'

  // ── Staff Card ─────────────────────────────────────────────────────────
  const renderStaffCard = ({ item }: { item: StaffUser }) => {
    const isProcessing = processingId === item.id
    const roleColor = item.role === 'admin' ? '#a78bfa' : '#fbbf24'
    const roleLabel = item.role === 'admin' ? 'Administrator' : 'Treasurer'
    const avatarColor = item.role === 'admin' ? '#6d28d9' : '#b45309'

    return (
      <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
        <View style={styles.cardRow}>
          <AvatarBubble name={item.full_name} color={avatarColor} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.cardName, { color: textPrimary }]}>{item.full_name}</Text>
            <View style={[styles.roleBadge, { backgroundColor: roleColor + '25', borderColor: roleColor + '50' }]}>
              <Feather name="shield" size={10} color={roleColor} />
              <Text style={[styles.roleBadgeText, { color: roleColor }]}>{roleLabel}</Text>
            </View>
          </View>
          <StatusBadge active={item.is_active} />
        </View>

        <Text style={[styles.cardDate, { color: textSecondary }]}>
          Added {format(new Date(item.created_at), 'MMM d, yyyy')}
        </Text>

        <View style={[styles.cardActions, { borderTopColor: borderColor }]}>
          {/* Toggle Active */}
          <TouchableOpacity
            style={[styles.actionBtn, {
              backgroundColor: item.is_active ? '#ef444415' : '#10b98115',
              borderColor: item.is_active ? '#ef444430' : '#10b98130',
            }]}
            onPress={() => toggleActive(item.id, item.is_active, false)}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={item.is_active ? '#ef4444' : '#10b981'} />
            ) : (
              <>
                <Feather
                  name={item.is_active ? 'toggle-right' : 'toggle-left'}
                  size={16}
                  color={item.is_active ? '#ef4444' : '#10b981'}
                />
                <Text style={[styles.actionBtnText, { color: item.is_active ? '#ef4444' : '#10b981' }]}>
                  {item.is_active ? 'Deactivate' : 'Activate'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Delete (not self) */}
          {profile?.id !== item.id && (
            <TouchableOpacity
              style={[styles.actionIconBtn, { backgroundColor: '#ef444415', borderColor: '#ef444430' }]}
              onPress={() => deleteUser(item.id, item.full_name, false)}
              disabled={isProcessing}
              activeOpacity={0.8}
            >
              <Feather name="trash-2" size={16} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  // ── Resident Card ──────────────────────────────────────────────────────
  const renderResidentCard = ({ item }: { item: ResidentUser }) => {
    const isProcessing = processingId === item.id
    return (
      <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
        <View style={styles.cardRow}>
          <AvatarBubble name={item.full_name} color="#0369a1" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.cardName, { color: textPrimary }]}>{item.full_name}</Text>
            {item.contact_number ? (
              <View style={styles.infoRow}>
                <Feather name="phone" size={11} color={textSecondary} />
                <Text style={[styles.cardInfo, { color: textSecondary }]}>{item.contact_number}</Text>
              </View>
            ) : null}
          </View>
          <StatusBadge active={item.is_active} />
        </View>

        <Text style={[styles.cardDate, { color: textSecondary }]}>
          Registered {format(new Date(item.created_at), 'MMM d, yyyy')}
        </Text>

        <View style={[styles.cardActions, { borderTopColor: borderColor }]}>
          {/* View Profile */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30', flex: 0, paddingHorizontal: 14 }]}
            onPress={() => setViewingResident(item)}
            activeOpacity={0.8}
          >
            <Feather name="eye" size={15} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>View</Text>
          </TouchableOpacity>

          {/* Toggle Active */}
          <TouchableOpacity
            style={[styles.actionBtn, {
              backgroundColor: item.is_active ? '#ef444415' : '#10b98115',
              borderColor: item.is_active ? '#ef444430' : '#10b98130',
            }]}
            onPress={() => toggleActive(item.id, item.is_active, true)}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={item.is_active ? '#ef4444' : '#10b981'} />
            ) : (
              <>
                <Feather
                  name={item.is_active ? 'toggle-right' : 'toggle-left'}
                  size={15}
                  color={item.is_active ? '#ef4444' : '#10b981'}
                />
                <Text style={[styles.actionBtnText, { color: item.is_active ? '#ef4444' : '#10b981' }]}>
                  {item.is_active ? 'Deactivate' : 'Activate'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Delete */}
          <TouchableOpacity
            style={[styles.actionIconBtn, { backgroundColor: '#ef444415', borderColor: '#ef444430' }]}
            onPress={() => deleteUser(item.id, item.full_name, true)}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            <Feather name="trash-2" size={15} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: bg }]}
      contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* ── Page Title ─────────────────────────────────────────────────────── */}
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: textPrimary }]}>User Management</Text>
        <Text style={[styles.pageSubtitle, { color: textSecondary }]}>
          Manage system staff and resident accounts
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <>
          {/* ════════════════════════════════════════════════════════════════
              SECTION 1 — ADMIN & TREASURER ACCOUNTS
              ════════════════════════════════════════════════════════════════ */}
          <View style={styles.section}>
            <SectionHeaderBar
              icon="shield"
              title="Admin & Treasurer Accounts"
              subtitle={`${staff.length} Staff Account${staff.length !== 1 ? 's' : ''} · ${activeStaff} Active`}
              accentColor="#a78bfa"
              isDark={isDark}
            />

            {/* Search + Filter */}
            <SearchFilterRow
              search={staffSearch}
              onSearch={setStaffSearch}
              statusFilter={staffStatusFilter}
              onStatusFilter={setStaffStatusFilter}
              placeholder="Search staff..."
              isDark={isDark}
              colors={colors}
            />

            {/* Add Staff Button */}
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowAddStaffModal(true)}
              activeOpacity={0.85}
            >
              <Feather name="user-plus" size={16} color="#fff" />
              <Text style={styles.addBtnText}>Add Staff Account</Text>
            </TouchableOpacity>

            {/* Staff List */}
            {filteredStaff.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="shield-off" size={36} color={isDark ? '#475569' : '#cbd5e1'} />
                <Text style={[styles.emptyText, { color: textSecondary }]}>No staff accounts found</Text>
              </View>
            ) : (
              filteredStaff.map(item => (
                <View key={item.id}>{renderStaffCard({ item })}</View>
              ))
            )}
          </View>

          {/* ════════════════════════════════════════════════════════════════
              SECTION 2 — RESIDENT ACCOUNTS
              ════════════════════════════════════════════════════════════════ */}
          <View style={styles.section}>
            <SectionHeaderBar
              icon="users"
              title="Resident Accounts"
              subtitle={
                `${residents.length} Resident${residents.length !== 1 ? 's' : ''} · ${activeResidents} Active` +
                (inactiveResidents > 0 ? ` · ${inactiveResidents} Inactive` : '')
              }
              accentColor="#34d399"
              isDark={isDark}
            />

            {/* Info Notice */}
            <View style={[styles.infoNotice, {
              backgroundColor: isDark ? '#1e3a5f20' : '#eff6ff',
              borderColor: isDark ? '#3b82f640' : '#bfdbfe',
            }]}>
              <Feather name="info" size={14} color="#3b82f6" style={{ marginTop: 1 }} />
              <Text style={[styles.infoNoticeText, { color: isDark ? '#93c5fd' : '#1d4ed8' }]}>
                Residents are created through the{' '}
                <Text style={{ fontWeight: '700' }}>Resident Registration / Sign-Up system</Text>,
                not manually. Manage existing resident accounts below.
              </Text>
            </View>

            {/* Search + Filter */}
            <SearchFilterRow
              search={residentSearch}
              onSearch={setResidentSearch}
              statusFilter={residentStatusFilter}
              onStatusFilter={setResidentStatusFilter}
              placeholder="Search residents..."
              isDark={isDark}
              colors={colors}
            />

            {/* Resident List */}
            {pagedResidents.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="user" size={36} color={isDark ? '#475569' : '#cbd5e1'} />
                <Text style={[styles.emptyText, { color: textSecondary }]}>
                  {residentSearch || residentStatusFilter !== 'all'
                    ? 'No residents match your filters'
                    : 'No resident accounts found'}
                </Text>
              </View>
            ) : (
              pagedResidents.map(item => (
                <View key={item.id}>{renderResidentCard({ item })}</View>
              ))
            )}

            {/* Pagination */}
            {filteredResidents.length > RESIDENTS_PER_PAGE && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.pageBtn, {
                    backgroundColor: isDark ? '#1e293b' : '#fff',
                    borderColor,
                    opacity: residentPage === 1 ? 0.4 : 1,
                  }]}
                  onPress={() => setResidentPage(p => Math.max(1, p - 1))}
                  disabled={residentPage === 1}
                >
                  <Feather name="chevron-left" size={16} color={textSecondary} />
                </TouchableOpacity>

                <Text style={[styles.pageInfo, { color: textSecondary }]}>
                  Page {residentPage} of {totalResidentPages}
                </Text>

                <TouchableOpacity
                  style={[styles.pageBtn, {
                    backgroundColor: isDark ? '#1e293b' : '#fff',
                    borderColor,
                    opacity: residentPage === totalResidentPages ? 0.4 : 1,
                  }]}
                  onPress={() => setResidentPage(p => Math.min(totalResidentPages, p + 1))}
                  disabled={residentPage === totalResidentPages}
                >
                  <Feather name="chevron-right" size={16} color={textSecondary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      )}

      {/* ── Add Staff Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={showAddStaffModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddStaffModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: isDark ? '#0f1624' : '#fff' }]}>
            {/* Header */}
            <View style={[styles.modalHeaderRow, { borderBottomColor: borderColor }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Feather name="shield" size={18} color="#a78bfa" />
                <Text style={[styles.modalTitle, { color: textPrimary }]}>Add Staff Account</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddStaffModal(false)}>
                <Feather name="x" size={20} color={textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalNotice, { color: textSecondary }]}>
                Creates an Administrator or Treasurer account. Residents must sign up through the resident registration system.
              </Text>

              {/* Full Name */}
              <Text style={[styles.fieldLabel, { color: textSecondary }]}>Full Name *</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor, color: textPrimary }]}
                value={staffForm.full_name}
                onChangeText={v => setStaffForm(f => ({ ...f, full_name: v }))}
                placeholder="e.g. Juan dela Cruz"
                placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
              />

              {/* Email */}
              <Text style={[styles.fieldLabel, { color: textSecondary }]}>Email Address *</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor, color: textPrimary }]}
                value={staffForm.email}
                onChangeText={v => setStaffForm(f => ({ ...f, email: v }))}
                placeholder="staff@aics.gov.ph"
                placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              {/* Password */}
              <Text style={[styles.fieldLabel, { color: textSecondary }]}>Password *</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor, color: textPrimary }]}
                value={staffForm.password}
                onChangeText={v => setStaffForm(f => ({ ...f, password: v }))}
                placeholder="••••••••"
                placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                secureTextEntry
              />

              {/* Role — ONLY Admin or Treasurer */}
              <Text style={[styles.fieldLabel, { color: textSecondary }]}>Role *</Text>
              <View style={styles.rolePickerRow}>
                {[
                  { value: 'admin', label: 'Administrator', color: '#a78bfa', bg: '#a78bfa20' },
                  { value: 'treasurer', label: 'Treasurer', color: '#fbbf24', bg: '#fbbf2420' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.roleOption,
                      { borderColor: staffForm.role === opt.value ? opt.color : borderColor },
                      staffForm.role === opt.value && { backgroundColor: opt.bg },
                    ]}
                    onPress={() => setStaffForm(f => ({ ...f, role: opt.value }))}
                  >
                    <Feather name="shield" size={14} color={staffForm.role === opt.value ? opt.color : textSecondary} />
                    <Text style={[styles.roleOptionText, {
                      color: staffForm.role === opt.value ? opt.color : textSecondary,
                      fontWeight: staffForm.role === opt.value ? '700' : '500',
                    }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Note: Staff creation only */}
              <View style={[styles.warningNotice, { backgroundColor: isDark ? '#1e3a5f20' : '#eff6ff', borderColor: isDark ? '#3b82f640' : '#bfdbfe' }]}>
                <Feather name="info" size={14} color="#3b82f6" />
                <Text style={[styles.warningText, { color: isDark ? '#93c5fd' : '#1d4ed8' }]}>
                  Creates an authorized staff account with active status. Resident accounts must register through the resident portal.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: savingStaff ? 0.7 : 1 }]}
                onPress={createStaffUser}
                disabled={savingStaff}
                activeOpacity={0.85}
              >
                {savingStaff
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitBtnText}>Create Staff Account</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Resident Profile Modal ──────────────────────────────────────────── */}
      {viewingResident && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setViewingResident(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: isDark ? '#0f1624' : '#fff' }]}>
              {/* Header */}
              <View style={[styles.modalHeaderRow, { borderBottomColor: borderColor }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <AvatarBubble name={viewingResident.full_name} color="#0369a1" />
                  <View>
                    <Text style={[styles.modalTitle, { color: textPrimary }]}>{viewingResident.full_name}</Text>
                    <View style={[styles.roleBadge, { backgroundColor: '#34d39920', borderColor: '#34d39940', alignSelf: 'flex-start' }]}>
                      <Text style={[styles.roleBadgeText, { color: '#34d399' }]}>Resident</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setViewingResident(null)}>
                  <Feather name="x" size={20} color={textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <ProfileRow label="Contact" value={viewingResident.contact_number || '—'} icon="phone" isDark={isDark} colors={colors} />
                <ProfileRow label="Status" value={viewingResident.is_active ? 'Active' : 'Inactive'} icon="activity" isDark={isDark} colors={colors} valueColor={viewingResident.is_active ? '#10b981' : '#ef4444'} />
                <ProfileRow label="Registered On" value={format(new Date(viewingResident.created_at), 'MMMM d, yyyy')} icon="calendar" isDark={isDark} colors={colors} />

                {viewingResident.beneficiary && (
                  <>
                    <View style={[styles.profileDivider, { borderTopColor: borderColor }]}>
                      <Text style={[styles.profileSectionLabel, { color: textSecondary }]}>BENEFICIARY DETAILS</Text>
                    </View>
                    <ProfileRow label="Address" value={viewingResident.beneficiary.address || '—'} icon="map-pin" isDark={isDark} colors={colors} />
                    <ProfileRow label="Barangay" value={viewingResident.beneficiary.barangay || '—'} icon="home" isDark={isDark} colors={colors} />
                    {viewingResident.beneficiary.birthdate && (
                      <ProfileRow
                        label="Date of Birth"
                        value={format(new Date(viewingResident.beneficiary.birthdate), 'MMMM d, yyyy')}
                        icon="gift"
                        isDark={isDark}
                        colors={colors}
                      />
                    )}
                    <ProfileRow label="Civil Status" value={viewingResident.beneficiary.civil_status || '—'} icon="heart" isDark={isDark} colors={colors} />
                    <ProfileRow label="Sex" value={viewingResident.beneficiary.sex || '—'} icon="user" isDark={isDark} colors={colors} />
                  </>
                )}

                {!viewingResident.beneficiary && (
                  <View style={[styles.infoNotice, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor, marginTop: 12 }]}>
                    <Feather name="info" size={14} color={textSecondary} />
                    <Text style={[styles.infoNoticeText, { color: textSecondary }]}>
                      No beneficiary profile linked to this account yet.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.closeModalBtn, { borderColor, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                  onPress={() => setViewingResident(null)}
                >
                  <Text style={[styles.closeModalBtnText, { color: textSecondary }]}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  )
}

// ─── Profile Row Component ────────────────────────────────────────────────────

function ProfileRow({
  label, value, icon, isDark, colors, valueColor,
}: {
  label: string; value: string; icon: string; isDark: boolean; colors: any; valueColor?: string
}) {
  const textSecondary = isDark ? '#94a3b8' : '#64748b'
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a'
  return (
    <View style={styles.profileRow}>
      <View style={styles.profileRowLeft}>
        <Feather name={icon as any} size={14} color={textSecondary} />
        <Text style={[styles.profileRowLabel, { color: textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.profileRowValue, { color: valueColor ?? textPrimary }]}>{value}</Text>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  errorSubtext: { fontSize: 14, marginTop: 6, textAlign: 'center' },

  pageHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  pageTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, marginTop: 4 },

  section: { marginHorizontal: 16, marginTop: 20 },

  sectionHeaderBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 14, marginBottom: 12,
  },
  sectionIconBadge: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  sectionHeaderTitle: { fontSize: 15, fontWeight: '800' },
  sectionHeaderSubtitle: { fontSize: 12, marginTop: 2 },

  searchFilterRow: { gap: 8, marginBottom: 12 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  filterRow: {
    flexDirection: 'row', borderRadius: 10, borderWidth: 1,
    padding: 3, gap: 2,
  },
  filterChip: {
    flex: 1, paddingVertical: 7, alignItems: 'center',
    borderRadius: 8,
  },
  filterChipText: { fontSize: 12, fontWeight: '600' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: 12, marginBottom: 12,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { marginTop: 12, fontSize: 14, fontWeight: '500' },

  card: {
    borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatarBubble: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cardName: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardInfo: { fontSize: 12, marginLeft: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  cardDate: { fontSize: 12, marginTop: 8 },

  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1, marginTop: 2,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  cardActions: {
    flexDirection: 'row', gap: 8, marginTop: 12,
    paddingTop: 12, borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
  actionIconBtn: {
    width: 42, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, borderWidth: 1,
  },

  infoNotice: {
    flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
  },
  infoNoticeText: { flex: 1, fontSize: 13, lineHeight: 19 },

  pagination: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, marginTop: 8,
  },
  pageBtn: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  pageInfo: { fontSize: 13, fontWeight: '600' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '88%',
  },
  modalHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  modalBody: { padding: 20 },
  modalNotice: { fontSize: 13, lineHeight: 18, marginBottom: 20 },

  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 14 },
  fieldInput: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15,
  },
  rolePickerRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  roleOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5,
  },
  roleOptionText: { fontSize: 13 },

  warningNotice: {
    flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 20,
  },
  warningText: { flex: 1, fontSize: 12, lineHeight: 18 },

  submitBtn: {
    paddingVertical: 16, borderRadius: 14, alignItems: 'center',
    marginTop: 20, marginBottom: 8,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Profile Modal
  profileRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingVertical: 11, gap: 12,
  },
  profileRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileRowLabel: { fontSize: 13, fontWeight: '500' },
  profileRowValue: { fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1 },
  profileDivider: { borderTopWidth: 1, marginTop: 8, paddingTop: 12, marginBottom: 4 },
  profileSectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  closeModalBtn: {
    borderWidth: 1, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 20, marginBottom: 8,
  },
  closeModalBtnText: { fontSize: 14, fontWeight: '700' },
})
