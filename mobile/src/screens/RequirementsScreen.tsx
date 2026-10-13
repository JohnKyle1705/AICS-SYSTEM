import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, ScrollView
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { Feather } from '@expo/vector-icons'

const ASSISTANCE_TYPES = ['Medical', 'Burial']

export default function RequirementsScreen({ navigation }: any) {
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()
  const [requirements, setRequirements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [selectedType, setSelectedType] = useState('Medical')
  const [documentName, setDocumentName] = useState('')

  const loadData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('assistance_requirements')
        .select('*')
        .order('assistance_type')
        .order('document_name')

      if (error) throw error
      setRequirements(data ?? [])
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

  const handleAddRequirement = async () => {
    if (!documentName.trim()) {
      Alert.alert('Missing Name', 'Please enter a document name (e.g. Medical Certificate).')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('assistance_requirements').insert({
        assistance_type: selectedType,
        document_name: documentName.trim(),
        is_required: true,
      })

      if (error) throw error
      setDocumentName('')
      loadData()
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Remove Requirement',
      `Are you sure you want to remove "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('assistance_requirements').delete().eq('id', id)
            if (error) {
              Alert.alert('Error', error.message)
            } else {
              setRequirements(prev => prev.filter(r => r.id !== id))
            }
          },
        },
      ]
    )
  }

  const s = styles(colors, isDark)

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header Info */}
      <View style={s.headerBox}>
        <Text style={s.pageTitle}>Requirements Setup</Text>
        <Text style={s.pageSubtitle}>Configure the required documents for each assistance type.</Text>
      </View>

      {/* Add New Requirement Card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Add New Requirement</Text>

        <Text style={s.inputLabel}>Assistance Type</Text>
        <View style={s.typeSelectorRow}>
          {ASSISTANCE_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[s.typeChip, selectedType === type && s.typeChipActive]}
              onPress={() => setSelectedType(type)}
            >
              <Text style={[s.typeChipText, selectedType === type && s.typeChipTextActive]}>
                {type} Assistance
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.inputLabel}>Document Name</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. Hospital Bill, Death Certificate..."
          placeholderTextColor={colors.textSecondary}
          value={documentName}
          onChangeText={setDocumentName}
        />

        <TouchableOpacity
          style={s.addBtn}
          activeOpacity={0.8}
          onPress={handleAddRequirement}
          disabled={saving || !documentName.trim()}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="plus-circle" size={16} color="#fff" />
              <Text style={s.addBtnText}>Add Requirement</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Grouped Requirements */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        ASSISTANCE_TYPES.map((type) => {
          const reqs = requirements.filter(r => r.assistance_type === type)
          return (
            <View key={type} style={s.categoryCard}>
              <View style={s.categoryHeader}>
                <View style={s.categoryIconBox}>
                  <Feather name="check-square" size={18} color={type === 'Medical' ? '#2563eb' : '#64748b'} />
                </View>
                <Text style={s.categoryTitle}>{type} Requirements</Text>
                <View style={s.countBadge}>
                  <Text style={s.countBadgeText}>{reqs.length}</Text>
                </View>
              </View>

              {reqs.length === 0 ? (
                <Text style={s.emptyCategoryText}>No requirements defined for {type}.</Text>
              ) : (
                <View style={s.itemsList}>
                  {reqs.map((r, index) => (
                    <View
                      key={r.id}
                      style={[s.reqItem, index === reqs.length - 1 && { borderBottomWidth: 0 }]}
                    >
                      <View style={s.reqLeft}>
                        <View style={s.bullet} />
                        <Text style={s.reqName}>{r.document_name}</Text>
                      </View>
                      <TouchableOpacity
                        style={s.deleteBtn}
                        onPress={() => handleDelete(r.id, r.document_name)}
                      >
                        <Feather name="trash-2" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )
        })
      )}
    </ScrollView>
  )
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBox: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  pageSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeChipActive: {
    backgroundColor: isDark ? 'rgba(37, 99, 235, 0.25)' : '#eff6ff',
    borderColor: colors.primary,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  input: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  categoryIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  countBadge: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  emptyCategoryText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  itemsList: {
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa',
    borderWidth: 1,
    borderColor: colors.border,
  },
  reqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reqLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  reqName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  deleteBtn: {
    padding: 6,
  },
})
