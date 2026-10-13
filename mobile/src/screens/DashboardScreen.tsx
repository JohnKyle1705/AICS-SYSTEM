import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Image, Alert
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { format } from 'date-fns'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Pending: { bg: '#fef3c7', text: '#92400e' },
  Approved: { bg: '#dbeafe', text: '#1e40af' },
  Released: { bg: '#d1fae5', text: '#065f46' },
  Declined: { bg: '#fee2e2', text: '#991b1b' },
}

export default function DashboardScreen({ navigation }: any) {
  const { profile } = useAuth()
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()
  const insets = useSafeAreaInsets()

  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, released: 0, declined: 0, beneficiaries: 0 })
  const [recentNotifications, setRecentNotifications] = useState<any[]>([])
  const [systemAnnouncements, setSystemAnnouncements] = useState<any[]>([])
  const [hasBeneficiaryRecord, setHasBeneficiaryRecord] = useState(true)
  const [beneficiaryData, setBeneficiaryData] = useState<any>(null)
  const [hasActiveRequest, setHasActiveRequest] = useState(false)
  const [activeRequest, setActiveRequest] = useState<any>(null)
  const [recentResidentRequests, setRecentResidentRequests] = useState<any[]>([])
  const [pendingUsers, setPendingUsers] = useState<any[]>([])
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !profile) return

    // 1. Load Requests Stats
    let q = supabase.from('requests').select('id, assistance_type, status, created_at, encoded_by, beneficiary_id')
    if (profile.role === 'resident') {
      q = q.eq('encoded_by', user.id)
    }
    const { data: reqData } = await q

    let bCount = 0
    if (profile.role !== 'resident') {
      const { count } = await supabase.from('beneficiaries').select('*', { count: 'exact', head: true })
      bCount = count || 0
    }

    if (reqData) {
      setStats({
        total: reqData.length,
        pending: reqData.filter(r => r.status === 'Pending').length,
        approved: reqData.filter(r => r.status === 'Approved').length,
        released: reqData.filter(r => r.status === 'Released').length,
        declined: reqData.filter(r => r.status === 'Declined').length,
        beneficiaries: bCount,
      })

      // Duplicate detection for admin
      if (profile.role === 'admin') {
        const bMap: Record<string, number> = {}
        reqData.forEach(r => {
          if (r.beneficiary_id) bMap[r.beneficiary_id] = (bMap[r.beneficiary_id] || 0) + 1
        })
        const dupes = Object.values(bMap).filter(c => c > 1).length
        setDuplicateCount(dupes)
      }
    }

    // 2. Resident specific data
    if (profile.role === 'resident') {
      const { data: bData } = await supabase
        .from('beneficiaries')
        .select('*')
        .eq('created_by', user.id)
        .maybeSingle()
      setHasBeneficiaryRecord(!!bData)
      setBeneficiaryData(bData ?? null)

      const { data: myReqs } = await supabase
        .from('requests')
        .select('*')
        .eq('encoded_by', user.id)
        .order('created_at', { ascending: false })
        .limit(4)
      setRecentResidentRequests(myReqs || [])

      // Detect active blocking request (Pending or Approved)
      const active = (myReqs || []).find((r: any) => r.status === 'Pending' || r.status === 'Approved')
      setHasActiveRequest(!!active)
      setActiveRequest(active ?? null)
    }

    // 3. Admin: Pending user approvals
    if (profile.role === 'admin') {
      const { data: inactiveUsers } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', false)
        .order('created_at', { ascending: false })
        .limit(3)
      setPendingUsers(inactiveUsers || [])
    }

    // 4. Notifications Preview
    const { data: notifData } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(3)
    if (notifData) setRecentNotifications(notifData)

    // 5. Announcements
    const { data: annData } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(3)
    if (annData) setSystemAnnouncements(annData)

    setLoading(false)
  }, [profile])

  useEffect(() => {
    load()
    const requestsChannel = supabase.channel('dashboard-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => load())
      .subscribe()
      
    const notifsChannel = supabase.channel('dashboard-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => load())
      .subscribe()

    return () => { 
      supabase.removeChannel(requestsChannel)
      supabase.removeChannel(notifsChannel)
    }
  }, [load])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const handleActivateUser = async (userId: string, userName: string) => {
    setActivatingId(userId)
    try {
      const { error } = await supabase.from('profiles').update({ is_active: true }).eq('id', userId)
      if (error) throw error

      const { data: { user: adminUser } } = await supabase.auth.getUser()
      if (adminUser) {
        await supabase.from('system_logs').insert({
          user_id: adminUser.id,
          action: 'ACTIVATE_USER',
          table_name: 'profiles',
          record_id: userId,
        })
      }

      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Account Activated',
        message: 'Your account has been approved and activated. You can now access all services.',
        type: 'info',
      })

      setPendingUsers(prev => prev.filter(u => u.id !== userId))
      Alert.alert('Activated', `${userName || 'User'} has been activated successfully!`)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setActivatingId(null)
    }
  }

  const cards = [
    ...(profile?.role !== 'resident' ? [{ label: t('dashboard_beneficiaries'), value: stats.beneficiaries, color: isDark ? '#3b82f6' : '#2563eb', bg: isDark ? 'rgba(30, 58, 95, 0.8)' : 'rgba(239, 246, 255, 0.9)', icon: 'users', screen: 'Beneficiaries' }] : []),
    { label: profile?.role === 'resident' ? t('dashboard_myRequests') : t('dashboard_totalRequests'), value: stats.total, color: isDark ? '#a78bfa' : '#7c3aed', bg: isDark ? 'rgba(45, 36, 66, 0.8)' : 'rgba(245, 243, 255, 0.9)', icon: 'file-text', screen: 'Requests', status: 'All' },
    { label: t('dashboard_pending'), value: stats.pending, color: isDark ? '#fbbf24' : '#d97706', bg: isDark ? 'rgba(61, 48, 20, 0.8)' : 'rgba(255, 251, 235, 0.9)', icon: 'clock', screen: 'Requests', status: 'Pending' },
    { label: t('dashboard_approved'), value: stats.approved, color: isDark ? '#60a5fa' : '#2563eb', bg: isDark ? 'rgba(30, 58, 95, 0.8)' : 'rgba(239, 246, 255, 0.9)', icon: 'check-circle', screen: 'Requests', status: 'Approved' },
    { label: t('dashboard_released'), value: stats.released, color: isDark ? '#34d399' : '#059669', bg: isDark ? 'rgba(20, 61, 44, 0.8)' : 'rgba(236, 253, 245, 0.9)', icon: 'dollar-sign', screen: 'Requests', status: 'Released' },
    { label: t('dashboard_declined'), value: stats.declined, color: isDark ? '#f87171' : '#dc2626', bg: isDark ? 'rgba(69, 26, 26, 0.8)' : 'rgba(254, 242, 242, 0.9)', icon: 'alert-circle', screen: 'Requests', status: 'Declined' },
  ]

  const adminTools = [
    { title: 'Reports', icon: 'bar-chart-2', screen: 'Reports', color: '#7c3aed', bg: isDark ? 'rgba(167, 139, 250, 0.2)' : '#f5f3ff' },
    { title: 'Audit Logs', icon: 'list', screen: 'AuditLogs', color: '#d97706', bg: isDark ? 'rgba(251, 191, 36, 0.2)' : '#fffbeb' },
    { title: 'Announce', icon: 'volume-2', screen: 'AnnouncementsManage', color: '#2563eb', bg: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff' },
    { title: 'Funds', icon: 'pie-chart', screen: 'FundsDashboard', color: '#16a34a', bg: isDark ? 'rgba(34, 197, 94, 0.2)' : '#f0fdf4' },
    { title: 'Assessments', icon: 'clipboard', screen: 'Assessments', color: '#0891b2', bg: isDark ? 'rgba(6, 182, 212, 0.2)' : '#ecfeff' },
    { title: 'Payouts', icon: 'dollar-sign', screen: 'Payouts', color: '#059669', bg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5' },
    { title: 'Requirements', icon: 'check-square', screen: 'Requirements', color: '#e11d48', bg: isDark ? 'rgba(244, 63, 94, 0.2)' : '#fff1f2' },
    { title: 'Feedback', icon: 'message-square', screen: 'FeedbackReview', color: '#4f46e5', bg: isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff' },
  ]

  const s = styles(colors, isDark, insets)

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.mainContent}>

          {/* Resident CTA: New Request Quick Action */}
          {profile?.role === 'resident' && (
            <TouchableOpacity
              style={[s.newRequestCTA, (!hasBeneficiaryRecord || hasActiveRequest) && { opacity: 0.72 }]}
              activeOpacity={0.88}
              onPress={() => {
                if (!hasBeneficiaryRecord) {
                  Alert.alert(
                    'Beneficiary Registration Required',
                    'You must complete your beneficiary registration before submitting an AICS request.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Complete Registration',
                        onPress: () => navigation.navigate('BeneficiaryForm', { beneficiary: null }),
                      },
                    ]
                  )
                  return
                }
                if (hasActiveRequest) {
                  Alert.alert(
                    'Active Request In Progress',
                    `You already have a ${activeRequest?.assistance_type} assistance request that is currently ${activeRequest?.status}. Multiple active requests are not allowed. Please wait for it to be resolved before submitting a new one.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'View My Request',
                        onPress: () => activeRequest && navigation.navigate('RequestDetail', { id: activeRequest.id }),
                      },
                    ]
                  )
                  return
                }
                navigation.navigate('RequestForm')
              }}
            >
              <View style={s.ctaIconBox}>
                <Feather
                  name={!hasBeneficiaryRecord ? 'lock' : hasActiveRequest ? 'clock' : 'plus-circle'}
                  size={24}
                  color="#fff"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.ctaTitle}>{t('newRequest_title')}</Text>
                <Text style={s.ctaSub}>
                  {!hasBeneficiaryRecord
                    ? 'Complete registration to unlock requests'
                    : hasActiveRequest
                    ? 'A request is currently being processed'
                    : 'Submit a new assistance application'}
                </Text>
              </View>
              <Feather name="arrow-right" size={20} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Registration Banner — shown only to residents without a beneficiary record */}
          {!loading && profile?.role === 'resident' && !hasBeneficiaryRecord && (
            <TouchableOpacity
              style={s.registrationBanner}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('BeneficiaryForm', { beneficiary: null })}
            >
              <View style={s.registrationBannerGlow} />
              <View style={s.registrationBannerInner}>
                <View style={s.registrationIconBox}>
                  <Feather name="user-plus" size={26} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.registrationTitle}>{t('dashboard_completeRegistration')}</Text>
                  <Text style={s.registrationSubtitle}>{t('dashboard_registrationDesc')}</Text>
                </View>
              </View>
              <View style={s.registrationButton}>
                <Text style={s.registrationButtonText}>{t('dashboard_startRegistration')}</Text>
                <Feather name="arrow-right" size={16} color="#1d4ed8" />
              </View>
            </TouchableOpacity>
          )}

          {/* Verified Beneficiary Card — shown after registration is complete */}
          {!loading && profile?.role === 'resident' && hasBeneficiaryRecord && !hasActiveRequest && (
            <View style={s.verifiedCard}>
              <View style={s.verifiedIconBox}>
                <Feather name="check-circle" size={22} color="#10b981" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={s.verifiedTitle}>Beneficiary Registration Verified</Text>
                  <View style={s.verifiedBadge}>
                    <Text style={s.verifiedBadgeText}>VERIFIED</Text>
                  </View>
                </View>
                <Text style={s.verifiedSub} numberOfLines={2}>
                  {beneficiaryData?.first_name} {beneficiaryData?.last_name}
                  {beneficiaryData?.barangay ? ` · ${beneficiaryData.barangay}` : ''}
                  {'  ·  Ready for Medical & Burial requests'}
                </Text>
              </View>
            </View>
          )}

          {/* Active Request Warning Banner — blocks new submissions */}
          {!loading && profile?.role === 'resident' && hasBeneficiaryRecord && hasActiveRequest && (
            <TouchableOpacity
              style={s.activeRequestBanner}
              activeOpacity={0.85}
              onPress={() => activeRequest && navigation.navigate('RequestDetail', { id: activeRequest.id })}
            >
              <View style={s.activeRequestIconBox}>
                <Feather name="alert-triangle" size={22} color="#d97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.activeRequestTitle}>Active Request In Progress</Text>
                <Text style={s.activeRequestSub} numberOfLines={2}>
                  You have a {activeRequest?.assistance_type} assistance request that is currently{' '}
                  <Text style={{ fontWeight: '700' }}>{activeRequest?.status}</Text>. New requests are blocked until it is resolved.
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#d97706" />
            </TouchableOpacity>
          )}

          {/* Admin Pending User Approvals Widget */}
          {profile?.role === 'admin' && pendingUsers.length > 0 && (
            <View style={s.pendingWidget}>
              <View style={s.widgetHeader}>
                <View style={s.widgetHeaderLeft}>
                  <Feather name="user-check" size={18} color="#d97706" />
                  <Text style={s.widgetTitle}>Pending User Approvals ({pendingUsers.length})</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Users')}>
                  <Text style={s.seeAllText}>Manage</Text>
                </TouchableOpacity>
              </View>

              {pendingUsers.map((u) => (
                <View key={u.id} style={s.pendingUserItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pendingUserName}>{u.full_name || 'Unnamed User'}</Text>
                    <Text style={s.pendingUserRole}>Role: {u.role}</Text>
                  </View>
                  <TouchableOpacity
                    style={s.activateBtn}
                    activeOpacity={0.8}
                    onPress={() => handleActivateUser(u.id, u.full_name)}
                    disabled={activatingId === u.id}
                  >
                    {activatingId === u.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={s.activateBtnText}>Approve</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Admin Duplicate Suspects Alert */}
          {profile?.role === 'admin' && duplicateCount > 0 && (
            <TouchableOpacity
              style={s.duplicateAlert}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Requests' as never)}
            >
              <Feather name="alert-triangle" size={20} color="#b45309" />
              <View style={{ flex: 1 }}>
                <Text style={s.duplicateAlertTitle}>Duplicate Suspects Detected</Text>
                <Text style={s.duplicateAlertText}>
                  {duplicateCount} beneficiaries have submitted multiple requests. Review before approval.
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#b45309" />
            </TouchableOpacity>
          )}

          {/* Announcements Feed */}
          {!loading && systemAnnouncements.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>{t('dashboard_latestAnnouncements')}</Text>
                {profile?.role === 'admin' && (
                  <TouchableOpacity onPress={() => navigation.navigate('AnnouncementsManage')}>
                    <Text style={s.seeAllText}>Manage</Text>
                  </TouchableOpacity>
                )}
              </View>
              {systemAnnouncements.map((ann) => (
                <TouchableOpacity
                  key={ann.id}
                  style={s.announcementCard}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('AnnouncementDetail', { announcement: ann })}
                >
                  <View style={s.announcementIconBox}>
                    <Feather name="volume-2" size={20} color="#6366f1" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.announcementTitle} numberOfLines={1}>{ann.title}</Text>
                    <Text style={s.announcementText} numberOfLines={2}>{ann.content}</Text>
                    <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 4 }}>
                      {new Date(ann.created_at).toLocaleDateString()} • {new Date(ann.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Stats Overview */}
          <Text style={s.sectionTitle}>
            {profile?.role === 'resident' ? 'My Request Status' : 'Overview'}
          </Text>
          
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <View style={s.grid}>
              {cards.map((card: any) => (
                <TouchableOpacity 
                  key={card.label} 
                  style={[s.card, { backgroundColor: card.bg, borderLeftColor: card.color }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (card.screen === 'Requests') {
                      navigation.navigate('Requests' as never, { statusFilter: card.status && card.status !== 'All' ? card.status : undefined } as never)
                    } else {
                      navigation.navigate(card.screen as never)
                    }
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={[s.cardValue, { color: card.color }]}>{card.value}</Text>
                    <Feather name={card.icon as any} size={20} color={card.color} style={{ opacity: 0.5 }} />
                  </View>
                  <Text style={s.cardLabel}>{card.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Resident My Recent Requests */}
          {profile?.role === 'resident' && recentResidentRequests.length > 0 && (
            <View style={{ marginTop: 16, marginBottom: 20 }}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>{'My Recent Requests'}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Requests' as never)}>
                  <Text style={s.seeAllText}>View All</Text>
                </TouchableOpacity>
              </View>

              {recentResidentRequests.map((req) => {
                const sc = STATUS_COLORS[req.status] || STATUS_COLORS.Pending
                return (
                  <TouchableOpacity
                    key={req.id}
                    style={s.recentReqCard}
                    activeOpacity={0.75}
                    onPress={() => navigation.navigate('RequestDetail', { id: req.id })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.recentReqType}>{req.assistance_type} Assistance</Text>
                      <Text style={s.recentReqDate}>
                        Filed {format(new Date(req.created_at), 'MMM d, yyyy')}
                      </Text>
                    </View>
                    <View style={[s.recentReqBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[s.recentReqBadgeText, { color: sc.text }]}>{req.status}</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {/* Notifications Preview */}
          <View style={s.notificationsSection}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{t('dashboard_recentNotifications')}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
                <Text style={s.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            
            {recentNotifications.length > 0 ? (
              <View style={s.notificationCard}>
                {recentNotifications.map((notif, index) => (
                  <View key={notif.id} style={[s.notifItem, index < recentNotifications.length - 1 && s.notifBorder]}>
                    <View style={s.notifDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.notifTitle}>{notif.title}</Text>
                      <Text style={s.notifMessage} numberOfLines={2}>{notif.message}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={s.emptyCard}>
                <Feather name="bell-off" size={24} color={colors.textSecondary} />
                <Text style={s.emptyText}>You're all caught up!</Text>
              </View>
            )}
          </View>

          {/* Expanded Admin Tools Grid (All 8 features from Web Sidebar) */}
          {profile?.role === 'admin' && (
            <View style={s.adminToolsContainer}>
              <Text style={s.sectionTitle}>Admin System Tools</Text>
              <View style={s.toolsGrid}>
                {adminTools.map((tool) => (
                  <TouchableOpacity
                    key={tool.title}
                    style={s.toolCard}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate(tool.screen)}
                  >
                    <View style={[s.toolIconBox, { backgroundColor: tool.bg }]}>
                      <Feather name={tool.icon as any} size={22} color={tool.color} />
                    </View>
                    <Text style={s.toolTitle}>{tool.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  )
}

const styles = (colors: any, isDark: boolean, insets: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  
  mainContent: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 20,
    paddingHorizontal: 18,
  },

  // New Request CTA
  newRequestCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
    gap: 14,
  },
  ctaIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  ctaSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },

  // Registration Banner
  registrationBanner: {
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    backgroundColor: '#2563eb',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  registrationBannerGlow: {
    position: 'absolute',
    bottom: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  registrationBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    paddingBottom: 10,
  },
  registrationIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registrationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  registrationSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 3,
  },
  registrationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    margin: 14,
    marginTop: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  registrationButtonText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 13,
  },

  // Verified Beneficiary Card
  verifiedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: isDark ? 'rgba(6, 78, 59, 0.3)' : '#f0fdf4',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  verifiedIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#6ee7b7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: isDark ? '#d1fae5' : '#065f46',
  },
  verifiedBadge: {
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#6ee7b7',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  verifiedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.5,
  },
  verifiedSub: {
    fontSize: 11,
    color: isDark ? '#6ee7b7' : '#047857',
    marginTop: 3,
    lineHeight: 16,
  },

  // Active Request Warning Banner
  activeRequestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: isDark ? 'rgba(78, 50, 0, 0.4)' : '#fffbeb',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(217, 119, 6, 0.4)' : '#fde68a',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  activeRequestIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#fef3c7',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(217, 119, 6, 0.25)' : '#fcd34d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeRequestTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: isDark ? '#fde68a' : '#92400e',
    marginBottom: 3,
  },
  activeRequestSub: {
    fontSize: 12,
    color: isDark ? '#fcd34d' : '#b45309',
    lineHeight: 17,
  },

  // Pending User Approvals Widget
  pendingWidget: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(217, 119, 6, 0.3)' : '#fde68a',
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  widgetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  widgetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  pendingUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pendingUserName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  pendingUserRole: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  activateBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  activateBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Duplicate Alert
  duplicateAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: isDark ? 'rgba(180, 83, 9, 0.2)' : '#fffbeb',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(180, 83, 9, 0.5)' : '#fde68a',
    marginBottom: 16,
  },
  duplicateAlertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: isDark ? '#fbbf24' : '#92400e',
  },
  duplicateAlertText: {
    fontSize: 11,
    color: isDark ? '#fcd34d' : '#b45309',
    marginTop: 2,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  // Announcements
  announcementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  announcementIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  announcementText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Stats Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  card: {
    width: '48%',
    flexGrow: 1,
    padding: 14,
    borderRadius: 14,
    borderLeftWidth: 4,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Recent Requests
  recentReqCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentReqType: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  recentReqDate: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  recentReqBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recentReqBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Notifications
  notificationsSection: {
    marginBottom: 20,
  },
  notificationCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
  },
  notifBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notifDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  notifMessage: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Admin Tools Grid
  adminToolsContainer: {
    marginBottom: 24,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  toolCard: {
    width: '23%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  toolTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
})
