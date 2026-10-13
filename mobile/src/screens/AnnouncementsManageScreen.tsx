import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, Switch, Image, Alert, ScrollView
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { Feather } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { format } from 'date-fns'

export default function AnnouncementsManageScreen({ navigation }: any) {
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    content: '',
    image_url: '',
    is_published: true,
  })

  const loadData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAnnouncements(data ?? [])
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

  const resetForm = () => {
    setForm({ title: '', content: '', image_url: '', is_published: true })
    setEditingId(null)
  }

  const openNewModal = () => {
    resetForm()
    setModalOpen(true)
  }

  const openEditModal = (item: any) => {
    setForm({
      title: item.title || '',
      content: item.content || '',
      image_url: item.image_url || '',
      is_published: item.is_published ?? true,
    })
    setEditingId(item.id)
    setModalOpen(true)
  }

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      })

      if (result.canceled || !result.assets[0].uri) return

      setUploadingImage(true)
      const asset = result.assets[0]
      const fileUri = asset.uri
      const fileExt = fileUri.split('.').pop() || 'jpg'
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      const { error: uploadError } = await supabase.storage
        .from('announcements')
        .upload(fileName, decode(base64), {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('announcements')
        .getPublicUrl(fileName)

      setForm(prev => ({ ...prev, image_url: publicUrl }))
    } catch (err: any) {
      Alert.alert('Upload Error', err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      Alert.alert('Missing Fields', 'Please enter both a title and announcement content.')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        image_url: form.image_url || null,
        is_published: form.is_published,
        created_by: user?.id,
      }

      if (editingId) {
        const { error } = await supabase
          .from('announcements')
          .update(payload)
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert([payload])
        if (error) throw error
      }

      setModalOpen(false)
      resetForm()
      loadData()
    } catch (err: any) {
      Alert.alert('Save Error', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (id: string, title: string) => {
    Alert.alert(
      'Delete Announcement',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('announcements').delete().eq('id', id)
            if (error) {
              Alert.alert('Error', error.message)
            } else {
              setAnnouncements(prev => prev.filter(a => a.id !== id))
            }
          },
        },
      ]
    )
  }

  const togglePublished = async (item: any) => {
    const newStatus = !item.is_published
    const { error } = await supabase
      .from('announcements')
      .update({ is_published: newStatus })
      .eq('id', item.id)

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setAnnouncements(prev => prev.map(a => a.id === item.id ? { ...a, is_published: newStatus } : a))
    }
  }

  const s = styles(colors, isDark)

  const renderItem = ({ item }: { item: any }) => {
    const dateStr = item.created_at ? format(new Date(item.created_at), 'MMM d, yyyy • h:mm a') : ''

    return (
      <View style={s.card}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={s.cardImage} resizeMode="cover" />
        ) : null}

        <View style={s.cardBody}>
          <View style={s.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{item.title}</Text>
              <Text style={s.cardDate}>{dateStr}</Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: item.is_published ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)' }]}>
              <Text style={[s.statusBadgeText, { color: item.is_published ? '#10b981' : '#64748b' }]}>
                {item.is_published ? 'Published' : 'Draft'}
              </Text>
            </View>
          </View>

          <Text style={s.cardContent} numberOfLines={3}>{item.content}</Text>

          <View style={s.cardActions}>
            <TouchableOpacity style={s.actionBtn} onPress={() => togglePublished(item)}>
              <Feather name={item.is_published ? 'eye-off' : 'eye'} size={14} color={colors.textSecondary} />
              <Text style={s.actionBtnText}>{item.is_published ? 'Unpublish' : 'Publish'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionBtn} onPress={() => openEditModal(item)}>
              <Feather name="edit-2" size={14} color={colors.primary} />
              <Text style={[s.actionBtnText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionBtn} onPress={() => handleDelete(item.id, item.title)}>
              <Feather name="trash-2" size={14} color="#ef4444" />
              <Text style={[s.actionBtnText, { color: '#ef4444' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={s.container}>
      {/* Top action bar */}
      <View style={s.topBar}>
        <View>
          <Text style={s.headerTitle}>Announcements</Text>
          <Text style={s.headerSubtitle}>{announcements.length} total announcements</Text>
        </View>
        <TouchableOpacity style={s.createBtn} activeOpacity={0.8} onPress={openNewModal}>
          <Feather name="plus" size={16} color="#fff" />
          <Text style={s.createBtnText}>Create New</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Feather name="volume-x" size={42} color={colors.textSecondary} style={{ opacity: 0.4 }} />
              <Text style={s.emptyText}>No announcements posted yet</Text>
            </View>
          }
        />
      )}

      {/* Create / Edit Modal */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editingId ? 'Edit Announcement' : 'New Announcement'}</Text>
              <TouchableOpacity onPress={() => { setModalOpen(false); resetForm() }}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={s.inputLabel}>Title</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Schedule of Payout"
                placeholderTextColor={colors.textSecondary}
                value={form.title}
                onChangeText={(v) => setForm(f => ({ ...f, title: v }))}
              />

              <Text style={s.inputLabel}>Content</Text>
              <TextInput
                style={[s.input, { height: 100, textAlignVertical: 'top' }]}
                placeholder="Announcement details, schedules, requirements..."
                placeholderTextColor={colors.textSecondary}
                value={form.content}
                onChangeText={(v) => setForm(f => ({ ...f, content: v }))}
                multiline
              />

              <Text style={s.inputLabel}>Banner Image (Optional)</Text>
              {form.image_url ? (
                <View style={s.imagePreviewBox}>
                  <Image source={{ uri: form.image_url }} style={s.previewImage} resizeMode="cover" />
                  <TouchableOpacity style={s.removeImageBtn} onPress={() => setForm(f => ({ ...f, image_url: '' }))}>
                    <Feather name="x" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={s.imagePickerBtn} activeOpacity={0.7} onPress={handlePickImage} disabled={uploadingImage}>
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Feather name="image" size={20} color={colors.primary} />
                      <Text style={s.imagePickerText}>Select image from gallery</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <View style={s.switchRow}>
                <View>
                  <Text style={s.switchLabel}>Publish Immediately</Text>
                  <Text style={s.switchSub}>Visible to residents on their dashboard</Text>
                </View>
                <Switch
                  value={form.is_published}
                  onValueChange={(v) => setForm(f => ({ ...f, is_published: v }))}
                  trackColor={{ false: '#64748b', true: colors.primary }}
                />
              </View>

              <View style={s.modalButtons}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setModalOpen(false); resetForm() }}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} activeOpacity={0.8} onPress={handleSave} disabled={saving || uploadingImage}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.saveBtnText}>{editingId ? 'Save Changes' : 'Post Announcement'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardImage: {
    width: '100%',
    height: 160,
  },
  cardBody: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  cardDate: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardContent: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginVertical: 6,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imagePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 20,
  },
  imagePickerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  imagePreviewBox: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 140,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  switchSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
})
