import React, { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Switch, Image, ScrollView, Platform } from 'react-native'
import { supabase } from '../lib/supabase'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { Feather } from '@expo/vector-icons'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { Picker } from '@react-native-picker/picker'

const BARANGAY_PAJO = 'Barangay Pajo'

const PUROKS_PAJO = [
  'Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5',
  'Purok 6', 'Purok 7', 'Purok 8', 'Purok 9', 'Purok 10',
  'Purok Centro', 'Purok Riverside', 'Purok San Isidro',
  'Purok Lower Pajo', 'Purok Upper Pajo',
]

type TabType = 'profile' | 'support' | 'feedback' | 'requirements'

export default function SettingsScreen() {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme, isDark, colors } = useTheme()
  const { t, language, setLanguage } = useLanguage()
  
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(true)
  
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [beneficiary, setBeneficiary] = useState<any>(null)
  
  const [supportForm, setSupportForm] = useState({ concern_type: 'General Inquiry', message: '' })
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, comments: '' })

  // Admin Requirements state
  const [requirements, setRequirements] = useState<any[]>([])
  const [reqTypeFilter, setReqTypeFilter] = useState('Medical')
  const [newReqName, setNewReqName] = useState('')
  const [newReqRequired, setNewReqRequired] = useState(true)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
    }
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email || '')
        
        if (profile?.role === 'resident') {
          const { data: ben } = await supabase.from('beneficiaries').select('*').eq('created_by', user.id).single()
          if (ben) {
            setBeneficiary(ben)
          } else {
            setBeneficiary({
              first_name: profile.full_name?.split(' ')[0] || '',
              last_name: profile.full_name?.split(' ').slice(1).join(' ') || '',
              address: '',
              contact_number: '',
              birthdate: '',
              civil_status: 'Single',
              occupation: '',
              barangay: BARANGAY_PAJO,
              purok: '',
              sex: 'Male',
              monthly_income: '0',
              family_size: '1'
            })
          }
        }
        
        if (profile?.role === 'admin') {
          loadRequirements()
        }
      }
      setFetching(false)
    }
    load()
  }, [profile])

  const loadRequirements = async () => {
    const { data } = await supabase.from('assistance_requirements').select('*').order('created_at', { ascending: true })
    if (data) setRequirements(data)
  }

  const handleAddRequirement = async () => {
    if (!newReqName.trim()) {
      Alert.alert(t('error'), t('req_enterDocumentName'))
      return
    }
    setSaving(true)
    const { error } = await supabase.from('assistance_requirements').insert({
      assistance_type: reqTypeFilter,
      document_name: newReqName,
      is_required: newReqRequired
    })
    
    if (error) {
      Alert.alert(t('error'), error.message)
    } else {
      Alert.alert(t('success'), t('req_addedSuccess'))
      setNewReqName('')
      await loadRequirements()
    }
    setSaving(false)
  }

  const handleToggleRequirement = async (id: string, currentVal: boolean) => {
    setSaving(true)
    const { error } = await supabase.from('assistance_requirements').update({ is_required: !currentVal }).eq('id', id)
    if (error) {
      Alert.alert(t('error'), error.message)
    } else {
      await loadRequirements()
    }
    setSaving(false)
  }

  const handleDeleteRequirement = async (id: string) => {
    Alert.alert(t('delete'), t('req_deleteConfirm'), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setSaving(true)
        const { error } = await supabase.from('assistance_requirements').delete().eq('id', id)
        if (error) Alert.alert(t('error'), error.message)
        else await loadRequirements()
        setSaving(false)
      }}
    ])
  }



  const handleUpdateProfile = async () => {
    if (!profile) return
    if (!fullName.trim()) return Alert.alert(t('error'), t('settings_nameEmpty'))

    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', profile.id)

    if (error) {
      Alert.alert(t('error'), error.message)
      setSaving(false)
      return
    }

    if (profile.role === 'resident' && beneficiary) {
      if (!beneficiary.birthdate || !beneficiary.address || !beneficiary.contact_number || !beneficiary.barangay || !beneficiary.monthly_income || !beneficiary.family_size) {
         Alert.alert(t('error'), t('settings_completeFields'))
         setSaving(false)
         return
      }

      const benPayload = {
        first_name: fullName.split(' ')[0] || beneficiary.first_name,
        last_name: fullName.split(' ').slice(1).join(' ') || beneficiary.last_name,
        address: beneficiary.address,
        contact_number: beneficiary.contact_number,
        birthdate: beneficiary.birthdate,
        civil_status: beneficiary.civil_status,
        occupation: beneficiary.occupation,
        barangay: beneficiary.barangay,
        sex: beneficiary.sex,
        monthly_income: beneficiary.monthly_income,
        family_size: beneficiary.family_size,
        created_by: profile.id
      }

      let benError
      if (beneficiary.id) {
        const res = await supabase.from('beneficiaries').update(benPayload).eq('id', beneficiary.id)
        benError = res.error
      } else {
        const res = await supabase.from('beneficiaries').insert(benPayload).select().single()
        benError = res.error
        if (res.data) setBeneficiary(res.data)
      }

      if (benError) {
        Alert.alert(t('error'), 'Error saving personal info: ' + benError.message)
        setSaving(false)
        return
      }
    }

    Alert.alert(t('success'), t('settings_profileUpdated'))
    setSaving(false)
  }

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('settings_permissionDenied'), t('settings_photoPermission'))
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })

    if (!result.canceled) {
      uploadImage(result.assets[0].uri)
    }
  }

  const uploadImage = async (uri: string) => {
    try {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        Alert.alert('Error', 'You must be logged in to upload a photo.')
        return
      }

      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
      const uriLower = uri.toLowerCase()
      let mimeType = 'image/jpeg'
      let ext = 'jpg'
      if (uriLower.includes('.png')) { mimeType = 'image/png'; ext = 'png' }
      else if (uriLower.includes('.gif')) { mimeType = 'image/gif'; ext = 'gif' }
      else if (uriLower.includes('.webp')) { mimeType = 'image/webp'; ext = 'webp' }

      const filePath = `${user.id}/avatar-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(base64), { contentType: mimeType, upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError
      Alert.alert(t('success'), t('settings_pictureUpdated'))
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const removeImage = async () => {
    try {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id)

      if (error) throw error
      Alert.alert(t('success'), t('settings_pictureRemoved'))
    } catch (error: any) {
      Alert.alert(t('error'), error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitSupport = async () => {
    if (!supportForm.message.trim()) {
      Alert.alert(t('error'), t('support_enterMessage'))
      return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('support_tickets').insert({
      user_id: user.id,
      concern_type: supportForm.concern_type,
      message: supportForm.message
    })

    if (error) {
      Alert.alert(t('error'), error.message)
    } else {
      Alert.alert(t('success'), t('support_submitted'))
      setSupportForm({ ...supportForm, message: '' })
    }
    setSaving(false)
  }

  const handleSubmitFeedback = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('feedbacks').insert({
      user_id: user.id,
      rating: feedbackForm.rating,
      comments: feedbackForm.comments
    })

    if (error) {
      Alert.alert(t('error'), error.message)
    } else {
      Alert.alert(t('success'), t('feedback_submitted'))
      setFeedbackForm({ rating: 5, comments: '' })
    }
    setSaving(false)
  }

  const s = styles(colors)

  if (fetching) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={s.container}>
      <View style={s.tabContainer}>
        <TouchableOpacity style={[s.tab, activeTab === 'profile' && s.activeTab]} onPress={() => setActiveTab('profile')}>
          <Feather name="user" size={16} color={activeTab === 'profile' ? colors.primary : colors.textSecondary} />
          <Text style={[s.tabText, activeTab === 'profile' && s.activeTabText]}>{t('settings_profile')}</Text>

        </TouchableOpacity>
        {(profile?.role === 'admin') && (
          <TouchableOpacity style={[s.tab, activeTab === 'requirements' && s.activeTab]} onPress={() => setActiveTab('requirements')}>
            <Feather name="file-text" size={16} color={activeTab === 'requirements' ? colors.primary : colors.textSecondary} />
            <Text style={[s.tabText, activeTab === 'requirements' && s.activeTabText]}>{t('settings_setup')}</Text>

          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.tab, activeTab === 'support' && s.activeTab]} onPress={() => setActiveTab('support')}>
          <Feather name="message-square" size={16} color={activeTab === 'support' ? colors.primary : colors.textSecondary} />
          <Text style={[s.tabText, activeTab === 'support' && s.activeTabText]}>{t('settings_support')}</Text>

        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === 'feedback' && s.activeTab]} onPress={() => setActiveTab('feedback')}>
          <Feather name="heart" size={16} color={activeTab === 'feedback' ? colors.primary : colors.textSecondary} />
          <Text style={[s.tabText, activeTab === 'feedback' && s.activeTabText]}>{t('settings_feedback')}</Text>

        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent}>
        {activeTab === 'profile' && (
          <>
            <View style={s.section}>
              <View style={s.avatarContainer}>
                <TouchableOpacity onPress={pickImage} disabled={saving} activeOpacity={0.8}>
                  <View style={s.avatarWrapper}>
                    {profile?.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
                    ) : (
                      <View style={s.avatarPlaceholder}>
                        <Feather name="user" size={40} color={colors.textSecondary} />
                      </View>
                    )}
                    {saving && (
                      <View style={s.avatarOverlay}>
                        <ActivityIndicator color="#fff" />
                      </View>
                    )}
                    <View style={s.editIconBadge}>
                      <Feather name="camera" size={14} color="#fff" />
                    </View>
                  </View>
                </TouchableOpacity>
                <View style={s.avatarInfo}>
                  <Text style={s.avatarName}>{profile?.full_name}</Text>
                  <Text style={s.avatarRole}>{profile?.role?.toUpperCase()}</Text>
                  {profile?.avatar_url && (
                    <TouchableOpacity onPress={removeImage} disabled={saving}>
                      <Text style={s.removeText}>{t('removePhoto')}</Text>
                    </TouchableOpacity>

                  )}
                </View>
              </View>
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('settings_accountInfo')}</Text>

              <View style={s.field}>
                <Text style={s.label}>{t('settings_emailAddress')}</Text>
                <TextInput style={[s.input, s.inputDisabled, { color: colors.textSecondary }]} value={email} editable={false} />
              </View>

              <View style={s.field}>
                <Text style={s.label}>{t('settings_fullName')}</Text>
                <TextInput
                  style={[s.input, { color: colors.text }]}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder={t('settings_fullNamePlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  cursorColor={colors.primary}
                  selectionColor={colors.primary}
                />
              </View>
            </View>

            {profile?.role === 'resident' && beneficiary && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('settings_personalDetails')}</Text>

                <View style={s.field}>
                  <Text style={s.label}>{t('settings_dateOfBirth')}</Text>
                  <TextInput
                    style={[s.input, { color: colors.text }]}
                    value={beneficiary.birthdate}
                    onChangeText={(v) => setBeneficiary({ ...beneficiary, birthdate: v })}
                    placeholder={t('settings_dobPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    cursorColor={colors.primary}
                    selectionColor={colors.primary}
                  />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>{t('settings_civilStatus')}</Text>
                  <View style={s.pickerWrap}>
                    <Picker
                      selectedValue={beneficiary.civil_status}
                      onValueChange={(v) => setBeneficiary({ ...beneficiary, civil_status: v })}
                      style={s.picker}
                      dropdownIconColor={colors.textSecondary}
                    >
                      {['Single','Married','Widowed','Separated','Annulled'].map(st => (
                        <Picker.Item key={st} label={st} value={st} color={Platform.OS === 'android' ? '#0f172a' : colors.text} />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={s.field}>
                  <Text style={s.label}>{t('settings_contactNumber')}</Text>
                  <TextInput
                    style={[s.input, { color: colors.text }]}
                    value={beneficiary.contact_number}
                    onChangeText={(v) => setBeneficiary({ ...beneficiary, contact_number: v })}
                    keyboardType="phone-pad"
                    placeholder={t('settings_contactPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    cursorColor={colors.primary}
                    selectionColor={colors.primary}
                  />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>{t('settings_occupation')}</Text>
                  <TextInput
                    style={[s.input, { color: colors.text }]}
                    value={beneficiary.occupation}
                    onChangeText={(v) => setBeneficiary({ ...beneficiary, occupation: v })}
                    placeholder={t('settings_occupationPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    cursorColor={colors.primary}
                    selectionColor={colors.primary}
                  />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>{t('settings_completeAddress')}</Text>
                  <TextInput
                    style={[s.input, { height: 80, textAlignVertical: 'top', color: colors.text }]}
                    value={beneficiary.address}
                    onChangeText={(v) => setBeneficiary({ ...beneficiary, address: v })}
                    multiline
                    placeholder={t('settings_addressPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    cursorColor={colors.primary}
                    selectionColor={colors.primary}
                  />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>{t('beneficiary_sex')}</Text>
                  <View style={s.pickerWrap}>
                    <Picker
                      selectedValue={beneficiary.sex}
                      onValueChange={(v) => setBeneficiary({ ...beneficiary, sex: v })}
                      style={s.picker}
                      dropdownIconColor={colors.textSecondary}
                    >
                      <Picker.Item label={t('beneficiary_male')} value="Male" color={Platform.OS === 'android' ? '#0f172a' : colors.text} />
                      <Picker.Item label={t('beneficiary_female')} value="Female" color={Platform.OS === 'android' ? '#0f172a' : colors.text} />
                    </Picker>
                  </View>
                </View>

                <View style={s.field}>
                  <Text style={s.label}>{t('beneficiary_barangay')}</Text>
                  <View style={[s.pickerWrap, { opacity: 0.7 }]}>
                    <Picker
                      selectedValue={BARANGAY_PAJO}
                      enabled={false}
                      style={s.picker}
                      dropdownIconColor={colors.textSecondary}
                    >
                      <Picker.Item label={BARANGAY_PAJO} value={BARANGAY_PAJO} color={Platform.OS === 'android' ? '#0f172a' : colors.text} />
                    </Picker>
                  </View>
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Purok</Text>
                  <View style={s.pickerWrap}>
                    <Picker
                      selectedValue={beneficiary.purok || ''}
                      onValueChange={(v) => setBeneficiary({ ...beneficiary, purok: v })}
                      style={s.picker}
                      dropdownIconColor={colors.textSecondary}
                    >
                      <Picker.Item label="Select Purok" value="" color={Platform.OS === 'android' ? '#64748b' : colors.textSecondary} />
                      {PUROKS_PAJO.map(p => (
                        <Picker.Item key={p} label={p} value={p} color={Platform.OS === 'android' ? '#0f172a' : colors.text} />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={s.field}>
                  <Text style={s.label}>{t('beneficiary_monthlyIncome')}</Text>
                  <TextInput
                    style={[s.input, { color: colors.text }]}
                    value={beneficiary.monthly_income?.toString()}
                    onChangeText={(v) => setBeneficiary({ ...beneficiary, monthly_income: v.replace(/[^0-9]/g, '') })}
                    keyboardType="numeric"
                    cursorColor={colors.primary}
                    selectionColor={colors.primary}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>{t('beneficiary_familySize')}</Text>
                  <TextInput
                    style={s.input}
                    value={beneficiary.family_size?.toString()}
                    onChangeText={(v) => setBeneficiary({ ...beneficiary, family_size: v.replace(/[^0-9]/g, '') })}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>
            )}

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={handleUpdateProfile} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>{t('saveProfile')}</Text>}
            </TouchableOpacity>


            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('settings_appearance')}</Text>
              <View style={s.settingRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Feather name={isDark ? "moon" : "sun"} size={20} color={colors.text} />
                  <Text style={s.settingLabel}>{t('settings_darkMode')}</Text>

                </View>
                <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: '#d1d5db', true: colors.primary }} thumbColor={'#fff'} />
              </View>
            </View>

            <TouchableOpacity style={s.signOutBtn} onPress={signOut} activeOpacity={0.8}>
              <Feather name="log-out" size={20} color="#dc2626" />
              <Text style={s.signOutText}>{t('signOut')}</Text>
            </TouchableOpacity>
          </>
        )}

        {activeTab === 'support' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('support_title')}</Text>
            <Text style={s.helperText}>{t('support_subtitle')}</Text>

            
            <View style={s.field}>
              <Text style={s.label}>{t('support_concernType')}</Text>
              <View style={s.pickerWrap}>
                <Picker
                  selectedValue={supportForm.concern_type}
                  onValueChange={(v) => setSupportForm({ ...supportForm, concern_type: v })}
                  style={s.picker}
                  dropdownIconColor={colors.textSecondary}
                >
                  <Picker.Item label="General Inquiry" value="General Inquiry" color={Platform.OS === 'android' ? '#0f172a' : colors.text} />
                  <Picker.Item label="Technical Issue" value="Technical Issue" color={Platform.OS === 'android' ? '#0f172a' : colors.text} />
                  <Picker.Item label="Request Follow-up" value="Request Follow-up" color={Platform.OS === 'android' ? '#0f172a' : colors.text} />
                </Picker>
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>{t('support_message')}</Text>
              <TextInput
                style={[s.input, { height: 120, textAlignVertical: 'top', color: colors.text }]}
                value={supportForm.message}
                onChangeText={(v) => setSupportForm({ ...supportForm, message: v })}
                multiline
                placeholder={t('support_messagePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                cursorColor={colors.primary}
                selectionColor={colors.primary}
              />
            </View>

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSubmitSupport} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>{t('support_submitTicket')}</Text>}
            </TouchableOpacity>

          </View>
        )}

        {activeTab === 'requirements' && (profile?.role === 'admin') && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('req_manageRequirements')}</Text>
            <Text style={s.helperText}>{t('req_configureDocuments')}</Text>

            
            <View style={s.field}>
              <Text style={s.label}>{t('req_assistanceType')}</Text>
              <View style={s.pickerWrap}>
                <Picker
                  selectedValue={reqTypeFilter}
                  onValueChange={(v) => setReqTypeFilter(v)}
                  style={s.picker}
                  dropdownIconColor={colors.textSecondary}
                >
                  <Picker.Item label="Medical" value="Medical" color={Platform.OS === 'android' ? '#0f172a' : colors.text} />
                  <Picker.Item label="Burial" value="Burial" color={Platform.OS === 'android' ? '#0f172a' : colors.text} />
                </Picker>
              </View>
            </View>

            <View style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 20 }}>
              <Text style={[s.label, { color: colors.text, marginBottom: 12 }]}>{t('req_addNewDocument')}</Text>

              <TextInput
                style={[s.input, { marginBottom: 12, color: colors.text }]}
                value={newReqName}
                onChangeText={setNewReqName}
                placeholder={t('req_documentPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                cursorColor={colors.primary}
                selectionColor={colors.primary}
              />
              <View style={s.pickerWrap}>
                <Picker
                  selectedValue={newReqRequired ? 'true' : 'false'}
                  onValueChange={(v) => setNewReqRequired(v === 'true')}
                  style={s.picker}
                  dropdownIconColor={colors.textSecondary}
                >
                  <Picker.Item label={t('req_required')} value="true" color={Platform.OS === 'android' ? '#0f172a' : colors.text} />
                  <Picker.Item label={t('req_optional')} value="false" color={Platform.OS === 'android' ? '#0f172a' : colors.text} />

                </Picker>
              </View>
              <TouchableOpacity style={[s.saveBtn, { marginTop: 12, marginBottom: 0 }]} onPress={handleAddRequirement} disabled={saving || !newReqName.trim()} activeOpacity={0.8}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>{t('req_addRequirement')}</Text>}
              </TouchableOpacity>

            </View>

            <Text style={[s.sectionTitle, { fontSize: 15, marginBottom: 12 }]}>{t('req_currentRequirements')}</Text>
            {requirements.filter(r => r.assistance_type === reqTypeFilter).length === 0 ? (
              <Text style={{ textAlign: 'center', color: colors.textSecondary, fontStyle: 'italic', paddingVertical: 20 }}>{t('req_noRequirements')}</Text>

            ) : (
              requirements.filter(r => r.assistance_type === reqTypeFilter).map((req) => (
                <View key={req.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginBottom: 10 }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Feather name="file-text" size={18} color="#3b82f6" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: colors.text, fontSize: 14 }}>{req.document_name}</Text>
                      <View style={{ alignSelf: 'flex-start', marginTop: 4, backgroundColor: req.is_required ? '#fee2e2' : (isDark ? '#334155' : '#f1f5f9'), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: req.is_required ? '#ef4444' : colors.textSecondary }}>
                          {req.is_required ? t('req_required').toUpperCase() : t('req_optional').toUpperCase()}
                        </Text>

                      </View>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity onPress={() => handleToggleRequirement(req.id, req.is_required)} style={{ padding: 6, backgroundColor: isDark ? '#1e3a8a' : '#eff6ff', borderRadius: 8 }}>
                      <Feather name="refresh-ccw" size={16} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteRequirement(req.id)} style={{ padding: 6, backgroundColor: isDark ? '#7f1d1d' : '#fef2f2', borderRadius: 8 }}>
                      <Feather name="trash-2" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'feedback' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('feedback_title')}</Text>
            <Text style={s.helperText}>{t('feedback_subtitle')}</Text>

            <View style={[s.field, { alignItems: 'center', marginVertical: 20 }]}>
              <Text style={[s.label, { marginBottom: 12, fontSize: 16 }]}>{t('feedback_rateExperience')}</Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setFeedbackForm({ ...feedbackForm, rating: star })}>
                    <Feather 
                      name="star" 
                      size={36} 
                      color={star <= feedbackForm.rating ? '#facc15' : colors.border} 
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>{t('feedback_commentsLabel')}</Text>
              <TextInput
                style={[s.input, { height: 120, textAlignVertical: 'top', color: colors.text }]}
                value={feedbackForm.comments}
                onChangeText={(v) => setFeedbackForm({ ...feedbackForm, comments: v })}
                multiline
                placeholder={t('feedback_commentsPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                cursorColor={colors.primary}
                selectionColor={colors.primary}
              />
            </View>

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSubmitFeedback} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>{t('feedback_submit')}</Text>}
            </TouchableOpacity>

          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 10, paddingTop: Platform.OS === 'ios' ? 10 : 0 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  activeTabText: { color: colors.primary },
  scrollContent: { padding: 20, paddingBottom: 40 },
  section: { backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 16 },
  helperText: { fontSize: 13, color: colors.textSecondary, marginBottom: 20, lineHeight: 20 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: colors.card },
  inputDisabled: { backgroundColor: colors.background, color: colors.textSecondary, borderColor: colors.border },
  pickerWrap: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.card, overflow: 'hidden' },
  picker: { height: 50, color: colors.text },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fef2f2', paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca' },
  signOutText: { color: '#dc2626', fontWeight: '700', fontSize: 15 },
  avatarContainer: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 10 },
  avatarWrapper: { width: 90, height: 90, borderRadius: 20, backgroundColor: colors.background, overflow: 'hidden', borderWidth: 2, borderColor: colors.border },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarOverlay: { ...(StyleSheet.absoluteFill as object), backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  editIconBadge: { position: 'absolute', bottom: -5, right: -5, backgroundColor: colors.primary, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: colors.card },
  avatarInfo: { flex: 1, gap: 2 },
  avatarName: { fontSize: 18, fontWeight: '800', color: colors.text },
  avatarRole: { fontSize: 12, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },
  removeText: { fontSize: 13, color: '#ef4444', fontWeight: '600', marginTop: 8 },
})
