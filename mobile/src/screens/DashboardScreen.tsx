import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ImageBackground, Platform } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function DashboardScreen({ navigation }: any) {
  const { profile, signOut } = useAuth()
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()
  const insets = useSafeAreaInsets()

  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, released: 0, declined: 0, beneficiaries: 0 })
  const [recentNotifications, setRecentNotifications] = useState<any[]>([])
  const [systemAnnouncements, setSystemAnnouncements] = useState<any[]>([])
  const [hasBeneficiaryRecord, setHasBeneficiaryRecord] = useState(true)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !profile) return

    // Load Requests Stats
    let q = supabase.from('requests').select('status, encoded_by')
    if (profile.role === 'resident') q = q.eq('encoded_by', user.id)
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
        beneficiaries: bCount
      })
    }

    // Check beneficiary record for residents
    if (profile.role === 'resident') {
      const { data: bData } = await supabase
        .from('beneficiaries')
        .select('id')
        .eq('created_by', user.id)
        .maybeSingle()
      setHasBeneficiaryRecord(!!bData)
    }

    // Load Recent Notifications
    const { data: notifData } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(3)
    
    if (notifData) {
      setRecentNotifications(notifData)
    }

    // Load Announcements
    const { data: annData } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(3)
    
    if (annData) {
      setSystemAnnouncements(annData)
    }

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

  const cards = [
    ...(profile?.role !== 'resident' ? [{ label: t('dashboard_beneficiaries'), value: stats.beneficiaries, color: isDark ? '#3b82f6' : '#2563eb', bg: isDark ? 'rgba(30, 58, 95, 0.8)' : 'rgba(239, 246, 255, 0.9)', icon: 'users', screen: 'Beneficiaries' }] : []),
    { label: profile?.role === 'resident' ? t('dashboard_myRequests') : t('dashboard_totalRequests'), value: stats.total, color: isDark ? '#a78bfa' : '#7c3aed', bg: isDark ? 'rgba(45, 36, 66, 0.8)' : 'rgba(245, 243, 255, 0.9)', icon: 'file-text', screen: 'Requests', status: 'All' },
    { label: t('dashboard_pending'), value: stats.pending, color: isDark ? '#fbbf24' : '#d97706', bg: isDark ? 'rgba(61, 48, 20, 0.8)' : 'rgba(255, 251, 235, 0.9)', icon: 'clock', screen: 'Requests', status: 'Pending' },
    { label: t('dashboard_approved'), value: stats.approved, color: isDark ? '#60a5fa' : '#2563eb', bg: isDark ? 'rgba(30, 58, 95, 0.8)' : 'rgba(239, 246, 255, 0.9)', icon: 'check-circle', screen: 'Requests', status: 'Approved' },
    { label: t('dashboard_released'), value: stats.released, color: isDark ? '#34d399' : '#059669', bg: isDark ? 'rgba(20, 61, 44, 0.8)' : 'rgba(236, 253, 245, 0.9)', icon: 'dollar-sign', screen: 'Requests', status: 'Released' },
    { label: t('dashboard_declined'), value: stats.declined, color: isDark ? '#f87171' : '#dc2626', bg: isDark ? 'rgba(69, 26, 26, 0.8)' : 'rgba(254, 242, 242, 0.9)', icon: 'alert-circle', screen: 'Requests', status: 'Declined' },
  ]

  const s = styles(colors, isDark, insets)

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Content Layout */}
        <View style={s.mainContent}>
          
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

          {/* Announcements Feed */}
          {!loading && systemAnnouncements.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>{t('dashboard_latestAnnouncements')}</Text>
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


          <Text style={s.sectionTitle}>
            {profile?.role === 'resident' ? 'My Request Status' : 'Overview'}
          </Text>
          
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <View style={s.grid}>
              {cards.map((card: any) => {
                return (
                  <TouchableOpacity 
                    key={card.label} 
                    style={[s.card, { backgroundColor: card.bg, borderLeftColor: card.color }]}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate(card.screen, { statusFilter: card.status })}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={[s.cardValue, { color: card.color }]}>{card.value}</Text>
                      <Feather name={card.icon as any} size={20} color={card.color} style={{ opacity: 0.5 }} />
                    </View>
                    <Text style={s.cardLabel}>{card.label}</Text>
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

          {/* Admin Tools */}
          {profile?.role === 'admin' && (
            <View style={s.adminToolsContainer}>
              <Text style={s.sectionTitle}>Admin Tools</Text>
              <View style={s.toolsGrid}>
                <TouchableOpacity style={s.toolCard} activeOpacity={0.8} onPress={() => navigation.navigate('Reports')}>
                  <View style={[s.toolIconBox, { backgroundColor: isDark ? 'rgba(167, 139, 250, 0.2)' : '#f5f3ff' }]}>
                    <Feather name="bar-chart-2" size={24} color={isDark ? '#a78bfa' : '#7c3aed'} />
                  </View>
                  <Text style={s.toolTitle}>Reports</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.toolCard} activeOpacity={0.8} onPress={() => navigation.navigate('AuditLogs')}>
                  <View style={[s.toolIconBox, { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.2)' : '#fffbeb' }]}>
                    <Feather name="list" size={24} color={isDark ? '#fbbf24' : '#d97706'} />
                  </View>
                  <Text style={s.toolTitle}>Logs</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.toolCard} activeOpacity={0.8} onPress={() => navigation.navigate('FeedbackReview')}>
                  <View style={[s.toolIconBox, { backgroundColor: isDark ? 'rgba(96, 165, 250, 0.2)' : '#eff6ff' }]}>
                    <Feather name="message-square" size={24} color={isDark ? '#60a5fa' : '#2563eb'} />
                  </View>
                  <Text style={s.toolTitle}>Feedback</Text>
                </TouchableOpacity>
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
    paddingTop: 24,
    paddingHorizontal: 20,
  },

  // Registration Banner
  registrationBanner: {
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
    backgroundColor: '#2563eb',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
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
    gap: 16,
    padding: 20,
    paddingBottom: 12,
  },
  registrationIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  registrationTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  registrationSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.80)',
    lineHeight: 17,
  },
  registrationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 11,
    borderRadius: 14,
  },
  registrationButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  
  announcementCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  announcementIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  announcementText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 14,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 14,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  card: {
    width: '48%',
    borderRadius: 20,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
  },
  cardLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    fontWeight: '600',
  },

  notificationsSection: {
    marginBottom: 28,
  },
  notificationCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  notifBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  notifMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  adminToolsContainer: {
    marginBottom: 20,
  },
  toolsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  toolCard: {
    flex: 1,
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  toolIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  toolTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
})
