import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Image } from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { Picker } from '@react-native-picker/picker'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { decode } from 'base64-arraybuffer'
import { Feather } from '@expo/vector-icons'

const ASSISTANCE_TYPES = ['Medical', 'Burial', 'Educational', 'Foods']

const TYPE_ICONS: Record<string, string> = {
  Educational: 'book-open',
  Medical: 'activity',
  Foods: 'coffee',
  Burial: 'heart',
}



const AMOUNT_RANGES: Record<string, string[]> = {
  Educational: ['₱2,000 - ₱5,000', '₱5,001 - ₱10,000'],
  Medical: ['₱1,000 - ₱3,000', '₱3,001 - ₱5,000', '₱5,001 - ₱10,000'],
  Foods: ['₱1,000 - ₱3,000', '₱3,001 - ₱5,000'],
  Burial: ['₱5,000 - ₱10,000', '₱10,001+']
}

export default function RequestFormScreen({ navigation, route }: any) {
  const initialType = route.params?.initialType || ''
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()

  const TYPE_FIELDS: Record<string, { key: string; label: string; type: string; placeholder: string; required?: boolean }[]> = {
    Educational: [
      { key: 'school_name', label: t('newRequest_fields.school_name'), type: 'text', placeholder: t('newRequest_placeholders.school_name'), required: true },
      { key: 'course_grade', label: t('newRequest_fields.course_grade'), type: 'text', placeholder: t('newRequest_placeholders.course_grade'), required: true },
    ],
    Medical: [
      { key: 'hospital_name', label: t('newRequest_fields.hospital_name'), type: 'text', placeholder: t('newRequest_placeholders.hospital_name'), required: true },
      { key: 'diagnosis', label: t('newRequest_fields.diagnosis'), type: 'text', placeholder: t('newRequest_placeholders.diagnosis'), required: true },
      { key: 'estimated_cost', label: t('newRequest_fields.estimated_cost'), type: 'number', placeholder: '0.00', required: true },
    ],
    Foods: [
      { key: 'household_size', label: t('newRequest_fields.household_size'), type: 'number', placeholder: 'e.g. 5', required: true },
      { key: 'monthly_income', label: t('newRequest_fields.monthly_income'), type: 'number', placeholder: '0.00', required: true },
    ],
    Burial: [
      { key: 'deceased_name', label: t('newRequest_fields.deceased_name'), type: 'text', placeholder: t('newRequest_placeholders.deceased_name'), required: true },
      { key: 'relationship', label: t('newRequest_fields.relationship'), type: 'text', placeholder: t('newRequest_placeholders.relationship'), required: true },
      { key: 'funeral_home', label: t('newRequest_fields.funeral_home'), type: 'text', placeholder: t('newRequest_placeholders.funeral_home'), required: true },
    ],
  }
  const [step, setStep] = useState(1)
  const [myBeneficiary, setMyBeneficiary] = useState<any>(null)
  const [requirements, setRequirements] = useState<any[]>([])
  const [preparedDocs, setPreparedDocs] = useState<Record<string, boolean>>({})
  const [validIdFront, setValidIdFront] = useState<any>(null)
  const [validIdBack, setValidIdBack] = useState<any>(null)
  const [form, setForm] = useState({ beneficiary_id: '', assistance_type: initialType, purpose: '', amount_range: '', remarks: '' })
  const [extraFields, setExtraFields] = useState<Record<string, string>>({})
  const [personalInfo, setPersonalInfo] = useState({
    full_name: '', address: '', contact_number: '', email: '',
    birthdate: '', civil_status: '', occupation: '', monthly_income: '',
    household_size: '', barangay: '',
    sex: '', is_pwd: false, is_senior: false, is_4ps: false
  })
  const [saving, setSaving] = useState(false)

  const update = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))
  const updatePersonal = (key: string, value: string) => setPersonalInfo(prev => ({ ...prev, [key]: value }))

  useEffect(() => {
    const loadMyBeneficiary = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      
      if (profile?.role && profile.role !== 'resident') {
        Alert.alert(t('error'), t('newRequest_accessDenied'))
        navigation.goBack()
        return
      }

      const { data: b } = await supabase.from('beneficiaries').select('*').eq('created_by', user.id).single()
      if (b) {
        setMyBeneficiary(b)
        update('beneficiary_id', b.id)
        setPersonalInfo({
          full_name: `${b.first_name} ${b.middle_name ? b.middle_name + ' ' : ''}${b.last_name}${b.suffix ? ' ' + b.suffix : ''}`,
          address: b.address || '', contact_number: b.contact_number || '', email: '',
          birthdate: b.birthdate || '', civil_status: b.civil_status || '',
          occupation: b.occupation || '', monthly_income: b.monthly_income?.toString() || '',
          household_size: b.family_size?.toString() || '', barangay: b.barangay || '',
          sex: b.sex || '', is_pwd: b.is_pwd || false, is_senior: b.is_senior || false, is_4ps: b.is_4ps || false
        })
      }
    }
    loadMyBeneficiary()
  }, [])

  useEffect(() => {
    if (form.assistance_type) {
      supabase.from('assistance_requirements')
        .select('*')
        .eq('assistance_type', form.assistance_type)
        .then(({ data }) => {
          setRequirements(data ?? [])
          setPreparedDocs({})
        })
    }
  }, [form.assistance_type])

  const captureWithCamera = async (side: 'front' | 'back') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('error'), t('settings_photoPermission'))
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    })
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0]
      if (side === 'front') setValidIdFront(asset)
      else setValidIdBack(asset)
    }
  }

  const handleNext = () => {
    if (step === 1) {
      if (!form.assistance_type) return Alert.alert(t('error'), t('newRequest_selectType'))
      setStep(2)
    } else if (step === 2) {
      if (!form.purpose) return Alert.alert(t('error'), t('newRequest_purpose'))
      if (!form.amount_range) return Alert.alert(t('error'), t('newRequest_selectAmount'))
      const fields = TYPE_FIELDS[form.assistance_type] || []
      for (const f of fields) {
        if (f.required && !extraFields[f.key]) {
          return Alert.alert(t('error'), `${t(`newRequest_fields.${f.key}` as any)} ${t('required')}`)
        }
      }
      setStep(3)
    }
  }

  const uploadIdPhoto = async (asset: any, requestId: string, side: string, userId: string) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' })
      const path = `requests/${requestId}/valid_id_${side}_${Date.now()}.jpg`
      
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(path, decode(base64), { contentType: 'image/jpeg' })
      
      if (uploadErr) throw uploadErr

      await supabase.from('request_documents').insert({
        request_id: requestId,
        file_name: `valid_id_${side}.jpg`,
        file_path: path,
        file_type: 'image/jpeg',
        uploaded_by: userId
      })
    } catch (err: any) {
      console.error(`Error uploading ${side} ID:`, err)
      throw new Error(`${t('settings_uploadFailed')}: ${side} ID`)
    }
  }

  const submitRequest = async () => {
    if (!validIdFront || !validIdBack) return Alert.alert(t('error'), t('newRequest_frontRequired'))
    const missingReqs = requirements.filter(r => r.is_required && !preparedDocs[r.id])
    if (missingReqs.length > 0) return Alert.alert(t('error'), t('newRequest_allDocumentsRequired'))

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: req, error } = await supabase.from('requests').insert({
        beneficiary_id: form.beneficiary_id,
        assistance_type: form.assistance_type,
        purpose: form.purpose,
        remarks: form.remarks || null,
        extra_fields: { ...extraFields, amount_range: form.amount_range, personal_info: personalInfo },
        encoded_by: user.id,
        status: 'Pending',
      }).select().single()

      if (error) throw error

      // Upload ID photos
      await uploadIdPhoto(validIdFront, req.id, 'front', user.id)
      await uploadIdPhoto(validIdBack, req.id, 'back', user.id)

      // Log activity
      await supabase.from('system_logs').insert({
        user_id: user.id,
        action: 'CREATE_REQUEST',
        table_name: 'requests',
        record_id: req.id,
        details: { type: form.assistance_type, beneficiary_id: form.beneficiary_id }
      })

      Alert.alert(t('success'), t('newRequest_success'))
      navigation.goBack()
    } catch (err: any) {
      Alert.alert(t('error'), err.message)
    } finally {
      setSaving(false)
    }
  }

  const renderStep1 = () => (
    <ScrollView style={s.stepContent} contentContainerStyle={{ padding: 20 }}>
      <View style={s.sectionHeader}>
        <Feather name="user" size={20} color={colors.primary} />
        <Text style={[s.stepTitle, { marginBottom: 0 }]}>{t('newRequest_stepBeneficiary')}</Text>
      </View>
      
      <View style={s.field}>
        <Text style={s.label}>{t('newRequest_beneficiary')}</Text>
        <View style={s.beneficiaryCard}>
          <View style={s.benAvatar}>
            <Feather name="user" size={20} color={colors.primary} />
          </View>
          <View style={s.benInfo}>
            <Text style={s.benName}>{myBeneficiary ? `${myBeneficiary.last_name}, ${myBeneficiary.first_name}` : t('loading')}</Text>
            <Text style={s.benBarangay}>{myBeneficiary?.barangay || '---'}</Text>
          </View>
          <View style={s.readOnlyBadge}>
            <Text style={s.readOnlyText}>{t('newRequest_readOnly')}</Text>
          </View>
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.label}>{t('newRequest_assistanceType')} *</Text>
        <View style={s.typeGrid}>
          {ASSISTANCE_TYPES.map(type => {
            const active = form.assistance_type === type
            return (
              <TouchableOpacity
                key={type}
                style={[s.typeBtn, active && s.typeBtnActive]}
                onPress={() => update('assistance_type', type)}
                activeOpacity={0.7}
              >
                <View style={[s.typeIconBg, active && s.typeIconBgActive]}>
                  <Feather name={TYPE_ICONS[type] as any} size={24} color={active ? colors.text : colors.textSecondary} />
                </View>
                <Text style={[s.typeBtnText, active && s.typeBtnTextActive]}>{t(type.toLowerCase() as any)}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      <View style={[s.sectionHeader, { marginTop: 20 }]}>
        <Feather name="user" size={20} color={colors.primary} />
        <Text style={[s.stepTitle, { marginBottom: 0 }]}>{t('newRequest_personalInfo').replace(/ *\(.*\)/, '')}</Text>
        <View style={s.autoFilledBadge}>
          <Text style={s.autoFilledText}>{t('newRequest_autoFilled')}</Text>
        </View>
      </View>
      <Text style={s.helperText}>{t('newRequest_personalInfoHelper')}</Text>

      <View style={[s.infoCard, { marginTop: 0 }]}>
        <View style={s.infoGrid}>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>{t('settings_fullName')}</Text>
            <Text style={s.infoValue}>{personalInfo.full_name || '---'}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>{t('beneficiary_barangay')}</Text>
            <Text style={s.infoValue}>{personalInfo.barangay || '---'}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>{t('settings_completeAddress')}</Text>
            <Text style={s.infoValue}>{personalInfo.address || '---'}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>{t('settings_contactNumber')}</Text>
            <Text style={s.infoValue}>{personalInfo.contact_number || '---'}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>{t('settings_dateOfBirth')}</Text>
            <Text style={s.infoValue}>{personalInfo.birthdate || '---'}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>{t('settings_sex')}</Text>
            <Text style={s.infoValue}>{personalInfo.sex ? t(personalInfo.sex.toLowerCase() as any) : '---'}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>{t('settings_civilStatus')}</Text>
            <Text style={s.infoValue}>{personalInfo.civil_status ? t(`settings_${personalInfo.civil_status.toLowerCase()}` as any) : '---'}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>{t('settings_occupation')}</Text>
            <Text style={s.infoValue}>{personalInfo.occupation || '---'}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>{t('beneficiary_monthlyIncome')}</Text>
            <Text style={s.infoValue}>₱{personalInfo.monthly_income || '0'}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>{t('beneficiary_familySize')}</Text>
            <Text style={s.infoValue}>{personalInfo.household_size || '---'}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>{t('settings_isPwd')}</Text>
            <Text style={s.infoValue}>{personalInfo.is_pwd ? t('yes') : t('no')}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>{t('settings_isSenior')}</Text>
            <Text style={s.infoValue}>{personalInfo.is_senior ? t('yes') : t('no')}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>{t('settings_is4ps')}</Text>
            <Text style={s.infoValue}>{personalInfo.is_4ps ? t('yes') : t('no')}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )

  const renderStep2 = () => (
    <ScrollView style={s.stepContent} contentContainerStyle={{ padding: 20 }}>
      <Text style={s.stepTitle}>{t('newRequest_stepDetails')}</Text>
      
      <View style={s.field}>
        <Text style={s.label}>{t('newRequest_purpose')}</Text>
        <TextInput
          style={[s.input, { height: 100, textAlignVertical: 'top' }]}
          value={form.purpose}
          onChangeText={(v) => update('purpose', v)}
          placeholder={t('newRequest_purposePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          multiline
        />
      </View>

      <View style={s.field}>
        <Text style={s.label}>{t('newRequest_amountRange')}</Text>
        <View style={s.pickerWrap}>
          <Picker
            selectedValue={form.amount_range}
            onValueChange={(v) => update('amount_range', v)}
            style={s.picker}
            dropdownIconColor={colors.textSecondary}
          >
            <Picker.Item label={t('newRequest_selectAmount')} value="" color={colors.textSecondary} />
            {(AMOUNT_RANGES[form.assistance_type] || []).map(r => 
              <Picker.Item key={r} label={r} value={r} color={colors.text} />
            )}
          </Picker>
        </View>
      </View>

      {TYPE_FIELDS[form.assistance_type]?.map((field) => (
        <View key={field.key} style={s.field}>
          <Text style={s.label}>{t(`newRequest_fields.${field.key}` as any)}</Text>
          <TextInput
            style={s.input}
            value={extraFields[field.key] || ''}
            onChangeText={(v) => setExtraFields(prev => ({ ...prev, [field.key]: v }))}
            placeholder={t(`newRequest_placeholders.${field.key}` as any)}
            placeholderTextColor={colors.textSecondary}
            keyboardType={field.type === 'number' ? 'numeric' : 'default'}
          />
        </View>
      ))}

      <View style={s.field}>
        <Text style={s.label}>{t('newRequest_remarks')}</Text>
        <TextInput
          style={s.input}
          value={form.remarks}
          onChangeText={(v) => update('remarks', v)}
          placeholder={t('newRequest_remarksPlaceholder')}
          placeholderTextColor={colors.textSecondary}
        />
      </View>
    </ScrollView>
  )

  const renderStep3 = () => (
    <ScrollView style={s.stepContent} contentContainerStyle={{ padding: 20 }}>
      <Text style={s.stepTitle}>{t('newRequest_stepDocuments')}</Text>

      <View style={s.section}>
        <Text style={s.sectionTitle}>{t('newRequest_idCapture')}</Text>
        <Text style={s.helperText}>{t('newRequest_idCaptureDesc')}</Text>

        <View style={s.idGrid}>
          <View style={s.idItem}>
            <Text style={s.idLabel}>{t('newRequest_frontSide')}</Text>
            <TouchableOpacity 
              style={[s.idPlaceholder, validIdFront && { padding: 0 }]} 
              onPress={() => captureWithCamera('front')}
            >
              {validIdFront ? (
                <Image source={{ uri: validIdFront.uri }} style={s.idImage} />
              ) : (
                <>
                  <Feather name="camera" size={24} color={colors.textSecondary} />
                  <Text style={s.idPlaceholderText}>{t('newRequest_openCamera')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={s.idItem}>
            <Text style={s.idLabel}>{t('newRequest_backSide')}</Text>
            <TouchableOpacity 
              style={[s.idPlaceholder, validIdBack && { padding: 0 }]} 
              onPress={() => captureWithCamera('back')}
            >
              {validIdBack ? (
                <Image source={{ uri: validIdBack.uri }} style={s.idImage} />
              ) : (
                <>
                  <Feather name="camera" size={24} color={colors.textSecondary} />
                  <Text style={s.idPlaceholderText}>{t('newRequest_openCamera')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={s.requirementsList}>
        {requirements.map((req) => (
          <View key={req.id} style={s.reqItem}>
            <View style={s.reqMain}>
              <View style={s.reqInfo}>
                <Text style={s.reqName}>{req.document_name}</Text>
                <Text style={s.reqType}>{req.is_required ? t('req_required') : t('req_optional')}</Text>
              </View>
              <TouchableOpacity 
                style={[s.preparedBtn, preparedDocs[req.id] && s.preparedBtnActive]}
                onPress={() => setPreparedDocs(prev => ({ ...prev, [req.id]: !prev[req.id] }))}
              >
                <Feather 
                  name={preparedDocs[req.id] ? "check-circle" : "circle"} 
                  size={18} 
                  color={preparedDocs[req.id] ? "#fff" : colors.textSecondary} 
                />
                <Text style={[s.preparedBtnText, preparedDocs[req.id] && s.preparedBtnTextActive]}>
                  {preparedDocs[req.id] ? t('newRequest_prepared') : t('newRequest_notPrepared')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  )

  const s = styles(colors, isDark)

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('newRequest_title')}</Text>
      </View>

      <View style={s.stepper}>
        <TouchableOpacity style={[s.stepBtn, step === 1 && s.stepBtnActive]} onPress={() => setStep(1)}>
          <Text style={[s.stepBtnText, step === 1 && s.stepBtnTextActive]}>{t('newRequest_step1Label') || 'Info'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.stepBtn, step === 2 && s.stepBtnActive]} onPress={() => step >= 2 && setStep(2)}>
          <Text style={[s.stepBtnText, step === 2 && s.stepBtnTextActive]}>{t('newRequest_step2Label') || 'Details'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.stepBtn, step === 3 && s.stepBtnActive]} onPress={() => step >= 3 && setStep(3)}>
          <Text style={[s.stepBtnText, step === 3 && s.stepBtnTextActive]}>{t('newRequest_step3Label') || 'Docs'}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </View>

      <View style={s.footer}>
        {step > 1 && (
          <TouchableOpacity style={s.navBtn} onPress={() => setStep(step - 1)}>
            <Feather name="arrow-left" size={18} color={colors.textSecondary} />
            <Text style={s.navBtnText}>{t('back')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={[s.navBtn, s.nextBtn, saving && { opacity: 0.7 }]} 
          onPress={step === 3 ? submitRequest : handleNext}
          disabled={saving}
        >
          <Text style={s.nextBtnText}>
            {saving ? t('submitting') : (step === 3 ? t('newRequest_submit') : t('next'))}
          </Text>
          {!saving && <Feather name="arrow-right" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 40, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 8, marginRight: 12, borderRadius: 10, backgroundColor: colors.background },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  stepper: { flexDirection: 'row', padding: 12, backgroundColor: colors.card, gap: 8 },
  stepBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  stepBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  stepBtnText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  stepBtnTextActive: { color: colors.primary },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 12 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 14, color: colors.text, backgroundColor: colors.card },
  pickerWrap: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, overflow: 'hidden' },
  picker: { height: 50, color: colors.text },
  beneficiaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, padding: 16, borderRadius: 16, gap: 14 },
  benAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
  benInfo: { flex: 1 },
  benName: { fontSize: 16, fontWeight: '800', color: colors.text },
  benBarangay: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  readOnlyBadge: { backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  readOnlyText: { fontSize: 11, fontWeight: '800', color: colors.textSecondary },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  typeBtn: { width: '48%', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, borderRadius: 20, padding: 20, alignItems: 'center', justifyContent: 'center', gap: 16 },
  typeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '05' },
  typeIconBg: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  typeIconBgActive: { backgroundColor: colors.primary + '15' },
  typeBtnText: { fontSize: 14, fontWeight: '800', color: colors.text },
  typeBtnTextActive: { color: colors.primary },
  autoFilledBadge: { backgroundColor: colors.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginLeft: 'auto' },
  autoFilledText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  infoCard: { padding: 16, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginTop: 10 },
  infoGrid: { gap: 12 },
  infoItem: { gap: 4 },
  infoLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  helperText: { fontSize: 12, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 },
  idGrid: { flexDirection: 'row', gap: 12 },
  idItem: { flex: 1, gap: 8 },
  idLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  idPlaceholder: { height: 120, borderRadius: 12, borderWeight: 2, borderColor: colors.border, borderStyle: 'dashed', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  idPlaceholderText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  idImage: { width: '100%', height: '100%' },
  requirementsList: { gap: 12 },
  reqItem: { padding: 16, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  reqMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reqInfo: { flex: 1, gap: 4 },
  reqName: { fontSize: 14, fontWeight: '600', color: colors.text },
  reqType: { fontSize: 11, color: colors.textSecondary },
  preparedBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  preparedBtnActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  preparedBtnText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  preparedBtnTextActive: { color: '#fff' },
  footer: { flexDirection: 'row', padding: 20, paddingBottom: 30, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 },
  navBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  nextBtn: { backgroundColor: colors.primary, borderColor: colors.primary },
  navBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
