import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { Picker } from '@react-native-picker/picker'


const BARANGAYS = [
  'Aguho','Bagay','Bakhaw','Bateria','Bitoon','Calape','Carnaza','Daanbantayan',
  'Dalingding','Lanao','Logon','Malbago','Malingin','Maya','Pajo','Paypay',
  'Poblacion','Talisay','Tapilon','Tinubdan','Tominjao'
]

const Field = ({ label, field, value, onChangeText, keyboardType, placeholder, error, colors, styles }: any) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput 
      style={[styles.input, error ? { borderColor: '#ef4444' } : {}]} 
      value={value || ''}
      onChangeText={onChangeText} 
      keyboardType={keyboardType} 
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary} 
    />
    {error && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{error}</Text>}
  </View>
)


export default function BeneficiaryFormScreen({ navigation, route }: any) {
  const editId = route.params?.id
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()
  const [form, setForm] = useState({

    first_name: '', middle_name: '', last_name: '', suffix: '',
    birthdate: '', sex: 'Male', civil_status: 'Single',
    barangay: '', address: '', contact_number: '',
    is_pwd: false, is_senior: false, is_4ps: false,
    monthly_income: '0', occupation: '', family_size: '1',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editId) {
      supabase.from('beneficiaries').select('*').eq('id', editId).single()
        .then(({ data }) => { if (data) setForm(data as any) })
    }
  }, [editId])

  const update = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }))

  const save = async () => {
    if (!form.first_name || !form.last_name || !form.birthdate || !form.barangay || !form.address) {
      return Alert.alert(t('error'), t('beneficiary_requiredFields'))
    }
    if (form.contact_number && (form.contact_number.length !== 11 || !form.contact_number.startsWith('09'))) {
      return Alert.alert(t('error'), t('beneficiary_invalidContact'))
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = { ...form, created_by: user?.id }
    const { error } = editId
      ? await supabase.from('beneficiaries').update(payload).eq('id', editId)
      : await supabase.from('beneficiaries').insert(payload)
    if (error) { Alert.alert('Error', error.message); setSaving(false); return }
    navigation.goBack()
  }

  const s = styles(colors)

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={s.section}>{t('beneficiary_personalInfo')}</Text>
      <Field label={t('beneficiary_firstName')} field="first_name" value={form.first_name} onChangeText={(v: string) => update('first_name', v)} colors={colors} styles={s} />
      <Field label={t('beneficiary_middleName')} field="middle_name" value={form.middle_name} onChangeText={(v: string) => update('middle_name', v)} colors={colors} styles={s} />
      <Field label={t('beneficiary_lastName')} field="last_name" value={form.last_name} onChangeText={(v: string) => update('last_name', v)} colors={colors} styles={s} />
      <Field label={t('beneficiary_suffix')} field="suffix" value={form.suffix} onChangeText={(v: string) => update('suffix', v)} colors={colors} styles={s} />
      <Field label={t('beneficiary_birthdate')} field="birthdate" value={form.birthdate} onChangeText={(v: string) => update('birthdate', v)} colors={colors} styles={s} />
      <Field 
        label={t('beneficiary_contactNumber')} 
        field="contact_number" 
        value={form.contact_number} 
        onChangeText={(v: string) => update('contact_number', v.replace(/\D/g, '').slice(0, 11))} 
        keyboardType="phone-pad" 
        placeholder={t('settings_contactPlaceholder')}
        error={form.contact_number && (form.contact_number.length !== 11 || !form.contact_number.startsWith('09')) ? t('beneficiary_invalidContact') : null}
        colors={colors} 
        styles={s} 
      />



      <View style={s.field}>
        <Text style={s.label}>{t('beneficiary_sex')}</Text>
        <View style={s.pickerWrap}>
          <Picker 
            selectedValue={form.sex} 
            onValueChange={(v) => update('sex', v)} 
            style={s.picker}
            dropdownIconColor={colors.textSecondary}
          >
            <Picker.Item label={t('beneficiary_male')} value="Male" color={colors.text} />
            <Picker.Item label={t('beneficiary_female')} value="Female" color={colors.text} />
          </Picker>
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.label}>{t('beneficiary_civilStatus')}</Text>
        <View style={s.pickerWrap}>
          <Picker 
            selectedValue={form.civil_status} 
            onValueChange={(v) => update('civil_status', v)} 
            style={s.picker}
            dropdownIconColor={colors.textSecondary}
          >
            <Picker.Item label={t('settings_single')} value="Single" color={colors.text} />
            <Picker.Item label={t('settings_married')} value="Married" color={colors.text} />
            <Picker.Item label={t('settings_widowed')} value="Widowed" color={colors.text} />
            <Picker.Item label={t('settings_separated')} value="Separated" color={colors.text} />
            <Picker.Item label={t('settings_annulled')} value="Annulled" color={colors.text} />
          </Picker>
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.label}>{t('beneficiary_barangay')}</Text>
        <View style={s.pickerWrap}>
          <Picker 
            selectedValue={form.barangay} 
            onValueChange={(v) => update('barangay', v)} 
            style={s.picker}
            dropdownIconColor={colors.textSecondary}
          >
            <Picker.Item label={t('beneficiary_selectBarangay')} value="" color={colors.textSecondary} />
            {BARANGAYS.map(b => <Picker.Item key={b} label={b} value={b} color={colors.text} />)}
          </Picker>
        </View>
      </View>

      <Field label={t('beneficiary_address')} field="address" value={form.address} onChangeText={(v: string) => update('address', v)} placeholder={t('settings_addressPlaceholder')} colors={colors} styles={s} />

      <Text style={[s.section, { marginTop: 20 }]}>{t('beneficiary_additionalDetails')}</Text>
      
      <View style={s.checkboxRow}>
        <TouchableOpacity style={s.checkboxItem} onPress={() => update('is_pwd', !form.is_pwd)}>
          <View style={[s.checkBox, form.is_pwd && s.checkboxChecked]}>
            {form.is_pwd && <Feather name="check" size={14} color="#fff" />}
          </View>
          <Text style={s.checkLabel}>{t('beneficiary_isPwd')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.checkboxItem} onPress={() => update('is_senior', !form.is_senior)}>
          <View style={[s.checkBox, form.is_senior && s.checkboxChecked]}>
            {form.is_senior && <Feather name="check" size={14} color="#fff" />}
          </View>
          <Text style={s.checkLabel}>{t('beneficiary_isSenior')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.checkboxItem} onPress={() => update('is_4ps', !form.is_4ps)}>
          <View style={[s.checkBox, form.is_4ps && s.checkboxChecked]}>
            {form.is_4ps && <Feather name="check" size={14} color="#fff" />}
          </View>
          <Text style={s.checkLabel}>{t('beneficiary_is4ps')}</Text>
        </TouchableOpacity>
      </View>

      <Field label={t('beneficiary_monthlyIncome')} field="monthly_income" value={form.monthly_income} onChangeText={(v: string) => update('monthly_income', v)} keyboardType="numeric" colors={colors} styles={s} />
      <Field label={t('beneficiary_occupation')} field="occupation" value={form.occupation} onChangeText={(v: string) => update('occupation', v)} placeholder={t('settings_occupationPlaceholder')} colors={colors} styles={s} />
      <Field label={t('beneficiary_familySize')} field="family_size" value={form.family_size} onChangeText={(v: string) => update('family_size', v)} keyboardType="numeric" colors={colors} styles={s} />


      <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.8}>
        <Text style={s.saveBtnText}>{saving ? t('saving') : editId ? t('beneficiary_update') : t('beneficiary_save')}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  section: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, backgroundColor: colors.card },
  pickerWrap: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, overflow: 'hidden' },
  picker: { height: 50, color: colors.text },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  checkBox: { width: 22, height: 22, borderWidth: 2, borderColor: colors.border, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  checked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  checkLabel: { fontSize: 14, color: colors.text },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
