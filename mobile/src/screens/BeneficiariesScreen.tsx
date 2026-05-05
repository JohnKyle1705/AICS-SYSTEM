import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import type { Beneficiary } from '../types'

export default function BeneficiariesScreen({ navigation }: any) {
  const [data, setData] = useState<Beneficiary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const { colors, isDark } = useTheme()

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('beneficiaries').select('*').order('last_name')
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
    const { data } = await query
    setData(data ?? [])
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('beneficiaries').delete().eq('id', id)
        load()
      }},
    ])
  }

  const s = styles(colors)

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Beneficiaries</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => navigation.navigate('BeneficiaryForm')} activeOpacity={0.8}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <TextInput style={s.search} placeholder="Search by name..." value={search}
        onChangeText={setSearch} placeholderTextColor={colors.textSecondary} />

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={load}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onLongPress={() => handleDelete(item.id)}
            onPress={() => navigation.navigate('BeneficiaryForm', { id: item.id })} activeOpacity={0.7}>
            <View style={s.cardRow}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{item.last_name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>{item.last_name}, {item.first_name} {item.middle_name ?? ''}</Text>
                <Text style={s.cardSub}>{item.barangay} • {item.sex}</Text>
              </View>
            </View>
            <View style={s.tags}>
              {item.is_pwd && (
                <View style={[s.tag, { backgroundColor: isDark ? '#2e1065' : '#f3e8ff' }]}>
                  <Text style={[s.tagText, { color: isDark ? '#a78bfa' : '#7c3aed' }]}>PWD</Text>
                </View>
              )}
              {item.is_senior && (
                <View style={[s.tag, { backgroundColor: isDark ? '#451a03' : '#fff7ed' }]}>
                  <Text style={[s.tagText, { color: isDark ? '#fb923c' : '#c2410c' }]}>Senior</Text>
                </View>
              )}
              {item.is_4ps && (
                <View style={[s.tag, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }]}>
                  <Text style={[s.tagText, { color: isDark ? '#34d399' : '#059669' }]}>4Ps</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No beneficiaries found</Text> : null}
      />
    </View>
  )
}

const styles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 6 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  search: { marginHorizontal: 20, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: colors.text, marginBottom: 12, backgroundColor: colors.card },
  card: { backgroundColor: colors.card, marginHorizontal: 20, marginBottom: 10, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: colors.border },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  cardName: { fontSize: 15, fontWeight: '600', color: colors.text },
  cardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  tags: { flexDirection: 'row', gap: 6, marginTop: 10 },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontSize: 11, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40, fontSize: 14 },
})
