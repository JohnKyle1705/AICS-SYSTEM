import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, ScrollView } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLanguage } from '../lib/LanguageContext'


export default function UsersScreen() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const insets = useSafeAreaInsets()
  const [users, setUsers] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'active'>('pending')
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isAddModalVisible, setIsAddModalVisible] = useState(false)
  const [newUserData, setNewUserData] = useState({ email: '', full_name: '', role: 'staff' })

  const loadUsers = async () => {
    setLoading(true)
    let q = supabase.from('profiles').select('*')
    
    if (filter === 'pending') {
      q = q.eq('is_active', false)
    } else {
      q = q.eq('is_active', true)
    }
    
    const { data } = await q.order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadUsers()
    }
  }, [profile, filter])

  const handleAddUser = async () => {
    if (!newUserData.email || !newUserData.full_name) {
      Alert.alert(t('required'), t('beneficiary_requiredFields'))
      return
    }


    setLoading(true)
    const { data, error } = await supabase.from('profiles').insert({
      email: newUserData.email,
      full_name: newUserData.full_name,
      role: newUserData.role,
      is_active: true
    }).select().single()

    if (error) {
      Alert.alert(t('error'), error.message)
    } else {
      Alert.alert(t('success'), t('users_addSuccess'))
      setIsAddModalVisible(false)
      setNewUserData({ email: '', full_name: '', role: 'staff' })
      if (filter === 'active') loadUsers()
    }

    setLoading(false)
  }

  const activateUser = async (userId: string) => {
    Alert.alert(
      t('users_activateConfirm'),
      t('users_activateMsg'),
      [
        { text: t('cancel'), style: "cancel" },
        {
          text: t('users_active'), 
          style: "default",

          onPress: async () => {
            setActivatingId(userId)
            await supabase.from('profiles').update({ is_active: true }).eq('id', userId)

            const { data: { user: adminUser } } = await supabase.auth.getUser()
            if (adminUser) {
              await supabase.from('system_logs').insert({
                user_id: adminUser.id,
                action: 'ACTIVATE_USER',
                table_name: 'profiles',
                record_id: userId
              })
            }

            await supabase.from('notifications').insert({
              user_id: userId,
              title: 'Account Activated',
              message: 'Your account has been approved and activated by the administrator. You can now access the system.',
              type: 'info'
            })

            setUsers(prev => prev.filter(u => u.id !== userId))
            setActivatingId(null)
          }
        }
      ]
    )
  }

  const deleteProfile = async (userId: string, userName: string) => {
    Alert.alert(
      t('users_deleteConfirm'),
      `${t('users_deleteMsg')} (${userName})`,
      [
        { text: t('cancel'), style: "cancel" },
        {
          text: t('delete'),
          style: "destructive",

          onPress: async () => {
            setDeletingId(userId)
            const { error } = await supabase.from('profiles').delete().eq('id', userId)

            if (!error) {
              const { data: { user: adminUser } } = await supabase.auth.getUser()
              if (adminUser) {
                await supabase.from('system_logs').insert({
                  user_id: adminUser.id,
                  action: 'DELETE_USER',
                  table_name: 'profiles',
                  record_id: userId
                })
              }
              setUsers(prev => prev.filter(u => u.id !== userId))
            } else {
              Alert.alert(t('error'), t('settings_uploadError'))
            }
            setDeletingId(userId)

          }
        }
      ]
    )
  }

  if (profile?.role !== 'admin') {
    return (
      <View style={styles.centerContainer}>
        <Feather name="shield-off" size={48} color="#cbd5e1" />
        <Text style={styles.errorText}>{t('users_unauthorized')}</Text>
      </View>
    )
  }


  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('users_title')}</Text>
        <View style={[styles.badgeCount, { backgroundColor: filter === 'active' ? '#dcfce7' : '#fffbeb' }]}>
          <Text style={[styles.badgeCountText, { color: filter === 'active' ? '#15803d' : '#d97706' }]}>
            {users.length} {filter === 'active' ? t('users_active') : t('users_pending')}
          </Text>
        </View>
      </View>


      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, filter === 'pending' && styles.activeTab]} 
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.tabText, filter === 'pending' && styles.activeTabText]}>{t('users_tabPending')}</Text>
          {filter === 'pending' && users.length > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{users.length}</Text></View>}
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, filter === 'active' && styles.activeTab]} 
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.tabText, filter === 'active' && styles.activeTabText]}>{t('users_tabActive')}</Text>
        </TouchableOpacity>
      </View>


      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
      ) : (
        <>
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name={filter === 'pending' ? "check-circle" : "users"} size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>{filter === 'pending' ? t('users_noPending') : t('users_noActive')}</Text>
            </View>
          }

          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{item.full_name}</Text>
                  <Text style={styles.userEmail}>{item.email}</Text>
                  <Text style={styles.userRoleBadge}>{item.role?.toUpperCase()}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: item.is_active ? '#dcfce7' : '#fffbeb' }]}>
                  <Text style={[styles.statusBadgeText, { color: item.is_active ? '#15803d' : '#d97706' }]}>
                    {item.is_active ? t('users_active') : t('users_pending')}
                  </Text>
                </View>
              </View>

              
              {filter === 'pending' && (
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    style={[styles.btnActivate, activatingId === item.id && styles.btnDisabled]}
                    onPress={() => activateUser(item.id)}
                    disabled={activatingId === item.id || deletingId === item.id}
                    activeOpacity={0.8}
                  >
                    {activatingId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="user-check" size={16} color="#fff" />
                        <Text style={styles.btnText}>{t('users_approveBtn')}</Text>
                      </>
                    )}

                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnDelete, deletingId === item.id && styles.btnDisabled]}
                    onPress={() => deleteProfile(item.id, item.full_name)}
                    disabled={deletingId === item.id || activatingId === item.id}
                    activeOpacity={0.8}
                  >
                    {deletingId === item.id ? (
                      <ActivityIndicator size="small" color="#dc2626" />
                    ) : (
                      <Feather name="trash-2" size={18} color="#dc2626" />
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
        
        <TouchableOpacity 
          style={styles.fab} 
          onPress={() => setIsAddModalVisible(true)}
          activeOpacity={0.9}
        >
          <Feather name="user-plus" size={24} color="#fff" />
        </TouchableOpacity>
        </>
      )}

      {/* Add User Modal */}
      <Modal
        visible={isAddModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('users_addModalTitle')}</Text>
              <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                <Feather name="x" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>


            <ScrollView style={styles.modalForm}>
              <Text style={styles.modalLabel}>{t('users_fullName')}</Text>
              <TextInput
                style={styles.modalInput}
                value={newUserData.full_name}
                onChangeText={(text) => setNewUserData(v => ({ ...v, full_name: text }))}
                placeholder={t('settings_fullNamePlaceholder')}
              />


              <Text style={styles.modalLabel}>{t('users_email')}</Text>
              <TextInput
                style={styles.modalInput}
                value={newUserData.email}
                onChangeText={(text) => setNewUserData(v => ({ ...v, email: text }))}
                placeholder={t('login_emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
              />


              <Text style={styles.modalLabel}>{t('users_role')}</Text>

              <View style={styles.roleTabs}>
                {['resident', 'staff', 'admin'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleTab, newUserData.role === r && styles.activeRoleTab]}
                    onPress={() => setNewUserData(v => ({ ...v, role: r }))}
                  >
                    <Text style={[styles.roleTabText, newUserData.role === r && styles.activeRoleTabText]}>
                      {r.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity 
                style={styles.modalSubmit} 
                onPress={handleAddUser}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>{t('users_createBtn')}</Text>}
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  errorText: { marginTop: 12, fontSize: 16, color: '#64748b', fontWeight: '500' },
  sectionHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    paddingTop: 24,
    paddingBottom: 12 
  },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  badgeCount: { backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeCountText: { color: '#15803d', fontSize: 12, fontWeight: '800' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  activeTab: { borderBottomColor: '#2563eb' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  activeTabText: { color: '#2563eb' },
  tabBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  tabBadgeText: { color: '#dc2626', fontSize: 10, fontWeight: '800' },
  listContent: { padding: 16, gap: 12, paddingBottom: 100 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 16, fontSize: 15, color: '#64748b', fontWeight: '500' },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  userName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  userEmail: { fontSize: 13, color: '#64748b', marginTop: 2 },
  userRoleBadge: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, fontSize: 10, fontWeight: '800', color: '#475569' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  actionsContainer: { flexDirection: 'row', gap: 10, marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  btnActivate: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 10 },
  btnDelete: { width: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fee2e2', borderRadius: 10, borderWidth: 1, borderColor: '#fecaca' },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  fab: { position: 'absolute', right: 24, bottom: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', shadowColor: '#2563eb', shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  modalForm: { padding: 20 },
  modalLabel: { fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 8, marginTop: 16 },
  modalInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#1e293b' },
  roleTabs: { flexDirection: 'row', gap: 10, marginTop: 8 },
  roleTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  activeRoleTab: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  roleTabText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  activeRoleTabText: { color: '#fff' },
  modalSubmit: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 32 },
  modalSubmitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
