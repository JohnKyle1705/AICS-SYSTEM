import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Linking, Modal, TextInput, Image
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { Feather } from '@expo/vector-icons'
import { format } from 'date-fns'

const STATUS_COLORS: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  Pending: { bg: '#fef3c7', text: '#92400e', darkBg: '#3d3014', darkText: '#fbbf24' },
  Approved: { bg: '#dbeafe', text: '#1e40af', darkBg: '#142c3d', darkText: '#60a5fa' },
  Released: { bg: '#d1fae5', text: '#065f46', darkBg: '#143d2c', darkText: '#34d399' },
  Declined: { bg: '#fee2e2', text: '#991b1b', darkBg: '#3d1414', darkText: '#f87171' },
}

export default function RequestDetailScreen({ route, navigation }: any) {
  const { id } = route.params
  const { profile } = useAuth()
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()

  const [request, setRequest] = useState<any>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [assessment, setAssessment] = useState<any>(null)
  const [payout, setPayout] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Document Preview Lightbox Modal State
  const [previewDoc, setPreviewDoc] = useState<any>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  // Approval Modal State
  const [approvalModalOpen, setApprovalModalOpen] = useState(false)
  const [approvedAmount, setApprovedAmount] = useState('')
  const [submittingApproval, setSubmittingApproval] = useState(false)

  // Treasurer Action States
  const [returnModalOpen, setReturnModalOpen]         = useState(false)
  const [returnRemarks, setReturnRemarks]             = useState('')
  const [submittingTreasurer, setSubmittingTreasurer] = useState(false)
  const [submittingAdminRelease, setSubmittingAdminRelease] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [{ data: req }, { data: docs }, { data: assess }, { data: pay }] = await Promise.all([
        supabase.from('requests').select('*, beneficiaries(*), approver:approved_by(full_name)').eq('id', id).single(),
        supabase.from('request_documents').select('*').eq('request_id', id),
        supabase.from('assessments').select('*').eq('request_id', id).maybeSingle(),
        supabase.from('payouts').select('*, profiles:released_by(full_name)').eq('request_id', id).maybeSingle(),
      ])

      setRequest(req)
      setDocuments(docs ?? [])
      setAssessment(assess)
      setPayout(pay)
      if (req?.amount_approved) {
        setApprovedAmount(req.amount_approved.toString())
      } else if (req?.amount_requested) {
        setApprovedAmount(req.amount_requested.toString())
      }
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handlePreviewDoc = async (doc: any) => {
    setPreviewDoc(doc)
    setPreviewLoading(true)
    setPreviewError('')
    setPreviewUrl('')

    try {
      // 1. Get public URL (available since documents bucket is public)
      const { data: pubData } = supabase.storage.from('documents').getPublicUrl(doc.file_path)
      let resolvedUrl = pubData?.publicUrl || ''

      if (!resolvedUrl) {
        const { data: signData, error: signErr } = await supabase.storage
          .from('documents')
          .createSignedUrl(doc.file_path, 3600)
        if (signErr) throw signErr
        resolvedUrl = signData?.signedUrl || ''
      }

      if (!resolvedUrl) {
        throw new Error('File not found or unavailable in storage')
      }

      setPreviewUrl(resolvedUrl)
    } catch (err: any) {
      console.error('Error loading document preview:', err)
      setPreviewError(err.message || 'File not found or unavailable')
    } finally {
      setPreviewLoading(false)
    }
  }

  const openDocUrl = async (path: string) => {
    try {
      const { data: pubData } = supabase.storage.from('documents').getPublicUrl(path)
      if (pubData?.publicUrl) {
        Linking.openURL(pubData.publicUrl)
        return
      }
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600)
      if (error) throw error
      if (data?.signedUrl) {
        Linking.openURL(data.signedUrl)
      }
    } catch (e: any) {
      Alert.alert('Error', 'Unable to open document: ' + e.message)
    }
  }

  const handleApproveSubmit = async () => {
    const amt = parseFloat(approvedAmount)
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please specify a valid approved amount greater than 0.')
      return
    }

    setSubmittingApproval(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // 1. Update request
      const { error: reqErr } = await supabase.from('requests').update({
        status: 'Approved',
        amount_approved: amt,
        approved_by: user?.id,
        release_status: 'Pending Release',
      }).eq('id', id)

      if (reqErr) throw reqErr

      // 2. Audit log
      if (user) {
        await supabase.from('system_logs').insert({
          user_id: user.id,
          action: 'APPROVE_REQUEST',
          table_name: 'requests',
          record_id: id,
          details: { new_status: 'Approved', amount_approved: amt }
        })
      }

      // 3. Notify resident
      if (request.encoded_by) {
        await supabase.from('notifications').insert({
          user_id: request.encoded_by,
          title: 'Request Approved',
          message: `Your request for ${request.assistance_type} Assistance has been approved for ₱${amt.toLocaleString()}.`,
          type: 'info',
          request_id: id,
        })
      }

      // 4. Notify treasurers: Pending Release
      const { data: treasurers } = await supabase.from('profiles').select('id').eq('role', 'treasurer')
      if (treasurers && treasurers.length > 0) {
        const benName = request.beneficiaries ? `${request.beneficiaries.first_name} ${request.beneficiaries.last_name}` : 'Unknown'
        const notifications = treasurers.map(t => ({
          user_id: t.id,
          title: 'Pending Release',
          message: `Request for ${benName} (${request.assistance_type} – ₱${amt.toLocaleString()}) has been approved and is Pending Release.`,
          type: 'info',
          request_id: id,
        }))
        await supabase.from('notifications').insert(notifications)
      }

      setApprovalModalOpen(false)
      setRequest((prev: any) => ({ ...prev, status: 'Approved', amount_approved: amt, release_status: 'Pending Release' }))
      Alert.alert('Success', 'Request approved successfully! Treasurers have been notified of Pending Release.')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmittingApproval(false)
    }
  }

  const handleAdminConfirmRelease = async () => {
    if (!request.amount_approved || Number(request.amount_approved) <= 0) {
      Alert.alert('Cannot Release', 'Approved amount is missing or zero.')
      return
    }

    const benName = b ? `${b.first_name} ${b.last_name}` : 'the beneficiary'
    Alert.alert(
      'Official Release Confirmation',
      `Confirm that ₱${Number(request.amount_approved).toLocaleString()} has actually been given to ${benName}? This will permanently record the payout and update municipal fund balances.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Release',
          onPress: async () => {
            setSubmittingAdminRelease(true)
            try {
              const { data: { user } } = await supabase.auth.getUser()
              const amt = Number(request.amount_approved)

              // 1. Create Payout
              const { error: payErr } = await supabase.from('payouts').insert({
                request_id: id,
                amount_released: amt,
                release_date: new Date().toISOString().split('T')[0],
                released_by: user?.id,
                acknowledgment_notes: 'This assistance has been given to the beneficiary.'
              })
              if (payErr) throw payErr

              // 2. Update Request
              const { error: reqErr } = await supabase.from('requests').update({
                status: 'Released',
                release_status: 'Released',
                updated_at: new Date().toISOString()
              }).eq('id', id)
              if (reqErr) throw reqErr

              // 3. Deduct Fund
              if (request.assistance_type) {
                const { data: fund } = await supabase.from('funds').select('*').eq('assistance_type', request.assistance_type).single()
                if (fund) {
                  const newBalance = Math.max(0, Number(fund.current_balance) - amt)
                  const newReleased = Number(fund.total_released || 0) + amt
                  await supabase.from('funds').update({
                    current_balance: newBalance,
                    total_released: newReleased
                  }).eq('id', fund.id)

                  await supabase.from('fund_transactions').insert({
                    fund_id: fund.id,
                    request_id: id,
                    transaction_type: 'Release',
                    amount: amt,
                    balance_after: newBalance,
                    processed_by: user?.id,
                    remarks: `Official Release for Request #${id.slice(0, 8).toUpperCase()}`
                  })
                }
              }

              // 4. Audit Log
              if (user) {
                await supabase.from('system_logs').insert({
                  user_id: user.id,
                  action: 'CONFIRM_RELEASE',
                  table_name: 'requests',
                  record_id: id,
                  details: { amount_released: amt, release_status: 'Released', notes: 'This assistance has been given to the beneficiary.' }
                })
              }

              // 5. Notify Resident
              if (request.encoded_by) {
                await supabase.from('notifications').insert({
                  user_id: request.encoded_by,
                  title: 'Assistance Released',
                  message: `This assistance has been given to the beneficiary (${request.assistance_type} – ₱${amt.toLocaleString()}).`,
                  type: 'info',
                  request_id: id
                })
              }

              // 6. Notify Treasurers
              const { data: treasurers } = await supabase.from('profiles').select('id').eq('role', 'treasurer')
              if (treasurers && treasurers.length > 0) {
                await supabase.from('notifications').insert(
                  treasurers.map((t: any) => ({
                    user_id: t.id,
                    title: 'Assistance Given to Beneficiary',
                    message: `This assistance has been given to the beneficiary (${benName} – ₱${amt.toLocaleString()}).`,
                    type: 'info',
                    request_id: id
                  }))
                )
              }

              Alert.alert('Assistance Released', 'This assistance has been given to the beneficiary.')
              loadData()
            } catch (e: any) {
              Alert.alert('Error', e.message)
            } finally {
              setSubmittingAdminRelease(false)
            }
          }
        }
      ]
    )
  }

  const handleConfirmReadiness = async () => {
    if (!request.amount_approved || Number(request.amount_approved) <= 0) {
      Alert.alert('Cannot Confirm', 'Approved amount is missing or zero.')
      return
    }

    const benName = b ? `${b.first_name} ${b.last_name}` : 'the beneficiary'
    Alert.alert(
      'Confirm Readiness',
      `Confirm that assistance request for ${benName} (₱${Number(request.amount_approved).toLocaleString()}) has been verified and is ready for release?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmittingTreasurer(true)
            try {
              const { data: { user } } = await supabase.auth.getUser()

              const { error: updErr } = await supabase.from('requests').update({
                release_status: 'Ready for Release',
                updated_at: new Date().toISOString()
              }).eq('id', id)

              if (updErr) throw updErr

              if (user) {
                await supabase.from('system_logs').insert({
                  user_id: user.id,
                  action: 'TREASURY_CONFIRM_READINESS',
                  table_name: 'requests',
                  record_id: id,
                  details: { release_status: 'Ready for Release' }
                })
              }

              // Notify Admins
              const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
              if (admins && admins.length > 0) {
                await supabase.from('notifications').insert(
                  admins.map((a: any) => ({
                    user_id: a.id,
                    title: 'Request Ready for Release',
                    message: `Assistance request for ${benName} has been verified by the Treasurer and is ready for release.`,
                    type: 'info',
                    request_id: id,
                  }))
                )
              }

              Alert.alert('Success', 'Readiness confirmed! Request is now Ready for Release.')
              loadData()
            } catch (e: any) {
              Alert.alert('Error', e.message)
            } finally {
              setSubmittingTreasurer(false)
            }
          }
        }
      ]
    )
  }

  const updateStatus = async (status: string) => {
    if (status === 'Approved') {
      setApprovalModalOpen(true)
      return
    }
    if (status === 'Released') {
      handleAdminConfirmRelease()
      return
    }

    Alert.alert('Confirm', `Mark request as ${status}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          const { data: { user } } = await supabase.auth.getUser()
          const updatePayload: any = { status }
          const { error } = await supabase.from('requests').update(updatePayload).eq('id', id)
          if (error) {
            Alert.alert('Error', error.message)
            return
          }

          if (user) {
            await supabase.from('system_logs').insert({
              user_id: user.id,
              action: `UPDATE_STATUS_${status.toUpperCase()}`,
              table_name: 'requests',
              record_id: id,
              details: { new_status: status }
            })
          }

          if (request.encoded_by) {
            await supabase.from('notifications').insert({
              user_id: request.encoded_by,
              title: `Request ${status}`,
              message: `Your assistance request status has been updated to ${status}.`,
              type: 'info',
              request_id: id,
            })
          }

          loadData()
        },
      },
    ])
  }

  const handleReturnToAdmin = async () => {
    if (!returnRemarks.trim()) {
      Alert.alert('Required', 'Please state the reason for returning this request.')
      return
    }

    setSubmittingTreasurer(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('requests').update({
        status: 'Pending',
        release_status: 'Pending Release',
        remarks: `[Returned by Treasurer]: ${returnRemarks.trim()}`
      }).eq('id', id)

      if (error) throw error

      // Notify Admins
      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
      if (admins) {
        await supabase.from('notifications').insert(
          admins.map((a: any) => ({
            user_id: a.id,
            title: 'Request Returned by Treasurer',
            message: `Request for ${b?.first_name} ${b?.last_name} was returned: ${returnRemarks.trim()}`,
            type: 'warning',
            request_id: id
          }))
        )
      }

      setReturnModalOpen(false)
      loadData()
      Alert.alert('Returned', 'Request has been returned to the Admin with your remarks.')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmittingTreasurer(false)
    }
  }

  const s = styles(colors, isDark)

  if (loading || !request) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  const b = request.beneficiaries
  const c = STATUS_COLORS[request.status] ?? STATUS_COLORS.Pending

  const Info = ({ label, value }: { label: string; value: string }) => (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value || '—'}</Text>
    </View>
  )

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Status Bar */}
      <View style={[s.statusBar, { backgroundColor: isDark ? c.darkBg : c.bg }]}>
        <Text style={[s.statusText, { color: isDark ? c.darkText : c.text }]}>
          STATUS: {request.status.toUpperCase()}
        </Text>
      </View>

      {/* Section 5: Official Release Confirmation Banner */}
      {(request.status === 'Released' || request.release_status === 'Released') && (
        <View style={s.releaseConfirmedCard}>
          <View style={s.releaseConfirmedHeader}>
            <View style={s.releaseIconBox}>
              <Feather name="check-circle" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.releaseBadge}>
                <Text style={s.releaseBadgeText}>OFFICIAL RELEASE COMPLETED</Text>
              </View>
              <Text style={s.releaseConfirmedTitle}>
                This assistance has been given to the beneficiary.
              </Text>
              <Text style={s.releaseConfirmedSub}>
                The authorized municipal administrator has officially disbursed the assistance grant. The transaction is permanently recorded.
              </Text>
            </View>
          </View>

          <View style={s.releaseDivider} />

          <View style={s.releaseMetaGrid}>
            <View style={s.releaseMetaCol}>
              <Text style={s.releaseMetaLabel}>Beneficiary Name</Text>
              <Text style={s.releaseMetaVal}>{b?.first_name} {b?.last_name}</Text>
            </View>
            <View style={s.releaseMetaCol}>
              <Text style={s.releaseMetaLabel}>Request Reference</Text>
              <Text style={[s.releaseMetaVal, { fontFamily: 'monospace' }]}>#{id.slice(0, 8).toUpperCase()}</Text>
            </View>
            <View style={s.releaseMetaCol}>
              <Text style={s.releaseMetaLabel}>Assistance Type</Text>
              <Text style={s.releaseMetaVal}>{request.assistance_type} Assistance</Text>
            </View>
            <View style={s.releaseMetaCol}>
              <Text style={s.releaseMetaLabel}>Final Approved Amount</Text>
              <Text style={[s.releaseMetaVal, { color: '#10b981', fontWeight: 'bold' }]}>
                ₱{Number(request.amount_approved || payout?.amount_released || 0).toLocaleString()}
              </Text>
            </View>
            <View style={s.releaseMetaCol}>
              <Text style={s.releaseMetaLabel}>Official Release Date</Text>
              <Text style={s.releaseMetaVal}>
                {payout?.release_date
                  ? format(new Date(payout.release_date), 'MMMM d, yyyy')
                  : request.release_date
                  ? format(new Date(request.release_date), 'MMMM d, yyyy')
                  : format(new Date(request.updated_at || request.created_at), 'MMMM d, yyyy')}
              </Text>
            </View>
            <View style={s.releaseMetaCol}>
              <Text style={s.releaseMetaLabel}>Authorized Releaser</Text>
              <Text style={s.releaseMetaVal}>
                {payout?.profiles?.full_name || request.approver?.full_name || 'Authorized MSWDO Admin'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Beneficiary Info */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Beneficiary Information</Text>
          <Feather name="user" size={16} color={colors.textSecondary} />
        </View>
        <Info label="Name" value={`${b?.last_name || ''}, ${b?.first_name || ''} ${b?.middle_name || ''}`} />
        <Info label="Sex" value={b?.sex} />
        <Info label="Barangay" value={`Brgy. ${b?.barangay || '—'}`} />
        <Info label="Contact Number" value={b?.contact_number} />
        <Info label="Civil Status" value={b?.civil_status} />
      </View>

      {/* Request Details */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Assistance Request</Text>
          <Feather name="file-text" size={16} color={colors.textSecondary} />
        </View>
        <Info label="Assistance Type" value={request.assistance_type} />
        <Info label="Amount Requested" value={request.amount_requested ? `₱${Number(request.amount_requested).toLocaleString()}` : '—'} />
        <Info label="Amount Approved" value={request.amount_approved ? `₱${Number(request.amount_approved).toLocaleString()}` : '—'} />
        <Info label="Release Status" value={request.release_status || 'Pending'} />
        <Info label="Purpose" value={request.purpose} />
        {request.assistance_type === 'Burial' && request.extra_fields && (
          <>
            <Info 
              label="Name of Deceased" 
              value={request.extra_fields.deceased_name || 
                [request.extra_fields.deceased_first_name, request.extra_fields.deceased_middle_name, request.extra_fields.deceased_last_name, request.extra_fields.deceased_suffix].filter(Boolean).join(' ') || 
                '—'} 
            />
            <Info label="Relationship" value={request.extra_fields.relationship || '—'} />
            <Info label="Funeral Home" value={request.extra_fields.funeral_home || '—'} />
          </>
        )}
        {request.assistance_type === 'Medical' && request.extra_fields && (
          <>
            <Info label="Hospital / Clinic" value={request.extra_fields.hospital_name || '—'} />
            <Info label="Diagnosis" value={request.extra_fields.diagnosis || '—'} />
            <Info label="Estimated Cost" value={request.extra_fields.estimated_cost ? `₱${Number(request.extra_fields.estimated_cost).toLocaleString()}` : '—'} />
          </>
        )}
        {request.remarks ? <Info label="Remarks" value={request.remarks} /> : null}
        <Info label="Date Filed" value={format(new Date(request.created_at), 'MMM d, yyyy • h:mm a')} />
      </View>

      {/* Uploaded Documents */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Uploaded Documents ({documents.length})</Text>
          <Feather name="paperclip" size={16} color={colors.textSecondary} />
        </View>

        {documents.length === 0 ? (
          <Text style={s.emptyDocsText}>No uploaded documents attached to this request.</Text>
        ) : (
          documents.map((doc) => (
            <TouchableOpacity
              key={doc.id}
              style={s.docItem}
              activeOpacity={0.7}
              onPress={() => handlePreviewDoc(doc)}
            >
              <View style={s.docIconBox}>
                <Feather name="file-text" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={s.docName} numberOfLines={1}>{doc.file_name}</Text>
                <Text style={s.docSub}>Attached Requirement / Proof</Text>
              </View>
              <TouchableOpacity
                style={s.docViewBtn}
                activeOpacity={0.7}
                onPress={() => handlePreviewDoc(doc)}
              >
                <Feather name="download" size={12} color={colors.primary} />
                <Text style={[s.docViewBtnText, { color: colors.primary }]}>View</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Assessment Info if present */}
      {assessment && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Social Worker Assessment</Text>
            <View style={[
              s.priorityBadge, 
              assessment.priority_level === 'High' ? s.badgeHigh : assessment.priority_level === 'Medium' ? s.badgeMed : s.badgeLow
            ]}>
              <Text style={[
                s.priorityLabel, 
                assessment.priority_level === 'High' ? s.textHigh : assessment.priority_level === 'Medium' ? s.textMed : s.textLow
              ]}>{assessment.priority_level || 'NORMAL'} PRIORITY</Text>
            </View>
          </View>
          <Info label="Eligibility" value={assessment.eligibility_status} />
          <Info label="Urgency" value={assessment.urgency_level} />
          <Info label="Recommendation" value={assessment.recommendation} />
          <Info label="Home Visit" value={assessment.home_visit ? 'Conducted' : 'Not Conducted'} />
        </View>
      )}

      {/* Payout Info if present */}
      {payout && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Payout Record</Text>
            <Feather name="check-circle" size={16} color="#10b981" />
          </View>
          <Info label="Released Amount" value={`₱${Number(payout.amount_released).toLocaleString()}`} />
          <Info label="Release Date" value={format(new Date(payout.release_date), 'MMM d, yyyy')} />
          {payout.acknowledgment_notes ? <Info label="Notes" value={payout.acknowledgment_notes} /> : null}
        </View>
      )}

      {/* Admin Action Buttons */}
      {profile?.role === 'admin' && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Admin Actions</Text>
          <View style={s.actions}>
            {request.status === 'Pending' && (
              <>
                <TouchableOpacity 
                  style={[s.actionBtn, { borderColor: '#2563eb', backgroundColor: '#eff6ff' }]}
                  onPress={() => setApprovalModalOpen(true)} 
                  activeOpacity={0.7}
                >
                  <Text style={[s.actionText, { color: '#1e40af' }]}>Approve Request</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[s.actionBtn, { borderColor: '#dc2626', backgroundColor: '#fef2f2' }]}
                  onPress={() => updateStatus('Declined')} 
                  activeOpacity={0.7}
                >
                  <Text style={[s.actionText, { color: '#991b1b' }]}>Decline Request</Text>
                </TouchableOpacity>
              </>
            )}

            {request.status === 'Approved' && request.release_status !== 'Released' && (
              <TouchableOpacity 
                style={[s.actionBtn, { borderColor: '#059669', backgroundColor: '#ecfdf5', flexGrow: 1 }]}
                onPress={handleAdminConfirmRelease} 
                disabled={submittingAdminRelease}
                activeOpacity={0.7}
              >
                {submittingAdminRelease ? (
                  <ActivityIndicator size="small" color="#059669" />
                ) : (
                  <Text style={[s.actionText, { color: '#065f46', textAlign: 'center' }]}>
                    ✓ Mark as Released (Assistance Given)
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {request.status === 'Declined' && (
              <TouchableOpacity 
                style={[s.actionBtn, { borderColor: '#d97706', backgroundColor: '#fffbeb' }]}
                onPress={() => updateStatus('Pending')} 
                activeOpacity={0.7}
              >
                <Text style={[s.actionText, { color: '#b45309' }]}>Reopen Request</Text>
              </TouchableOpacity>
            )}
          </View>

          {!assessment && (
            <TouchableOpacity onPress={() => navigation.navigate('AssessmentForm', { request_id: id })}>
              <Text style={s.linkBtn}>+ Conduct Assessment</Text>
            </TouchableOpacity>
          )}

          {request.status === 'Approved' && !payout && (
            <TouchableOpacity onPress={() => navigation.navigate('PayoutForm', { request_id: id })}>
              <Text style={[s.linkBtn, { color: '#10b981' }]}>+ Record Payout</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Treasurer Financial Actions */}
      {profile?.role === 'treasurer' && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Treasurer Review & Readiness</Text>
            <Feather name="shield" size={16} color={colors.primary} />
          </View>

          {request.status === 'Approved' ? (
            <View style={{ gap: 10, marginTop: 4 }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                Admin-Approved Amount: <Text style={{ fontWeight: 'bold', color: '#10b981' }}>₱{Number(request.amount_approved || 0).toLocaleString()}</Text>
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                Release Status: <Text style={{ fontWeight: 'bold', color: colors.text }}>{request.release_status || 'Pending Release'}</Text>
              </Text>

              {request.release_status !== 'Released' && (
                <View style={{ gap: 8, marginTop: 6 }}>
                  {request.release_status !== 'Ready for Release' ? (
                    <TouchableOpacity
                      style={{ backgroundColor: '#10b981', padding: 12, borderRadius: 10, alignItems: 'center' }}
                      onPress={handleConfirmReadiness}
                      disabled={submittingTreasurer}
                    >
                      {submittingTreasurer ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Confirm Ready for Release</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={{ padding: 10, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 8 }}>
                      <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 12 }}>
                        ✓ Checked & Ready for Release (Awaiting Admin release to beneficiary)
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={{ backgroundColor: '#ef4444', padding: 12, borderRadius: 10, alignItems: 'center' }}
                    onPress={() => {
                      setReturnRemarks('')
                      setReturnModalOpen(true)
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Return to Admin</Text>
                  </TouchableOpacity>
                </View>
              )}

              {request.release_status === 'Released' && (
                <View style={{ padding: 10, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, marginTop: 4 }}>
                  <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 12 }}>
                    ✓ This assistance has been given to the beneficiary.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={{ padding: 10, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 8, marginTop: 6 }}>
              <Text style={{ fontSize: 12, color: '#b45309' }}>
                Only requests approved by Admin can be checked for release. Treasurers monitor requests and confirm readiness.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Approval Modal with Amount Input */}
      <Modal visible={approvalModalOpen} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Approve Assistance Request</Text>
              <TouchableOpacity onPress={() => setApprovalModalOpen(false)}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={s.modalSub}>
              Set the assistance amount approved for {b?.first_name} {b?.last_name}. Treasurers will check and monitor this release.
            </Text>

            <Text style={s.inputLabel}>Approved Amount (₱)</Text>
            <TextInput
              style={s.amountInput}
              keyboardType="numeric"
              placeholder="e.g. 5000"
              placeholderTextColor={colors.textSecondary}
              value={approvedAmount}
              onChangeText={setApprovedAmount}
            />

            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setApprovalModalOpen(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.confirmApproveBtn}
                activeOpacity={0.8}
                onPress={handleApproveSubmit}
                disabled={submittingApproval}
              >
                {submittingApproval ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.confirmApproveBtnText}>Confirm Approval</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Treasurer Return to Admin Modal */}
      <Modal visible={returnModalOpen} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: '#ef4444' }]}>Return to Admin</Text>
              <TouchableOpacity onPress={() => setReturnModalOpen(false)}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={s.modalSub}>
              State the reason for returning this request (e.g. insufficient funds, missing document).
            </Text>

            <Text style={s.inputLabel}>Reason / Remarks *</Text>
            <TextInput
              style={[s.amountInput, { height: 70, textAlignVertical: 'top' }]}
              multiline
              numberOfLines={3}
              placeholder="Enter remarks..."
              placeholderTextColor={colors.textSecondary}
              value={returnRemarks}
              onChangeText={setReturnRemarks}
            />

            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setReturnModalOpen(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.confirmApproveBtn, { backgroundColor: '#ef4444' }]}
                activeOpacity={0.8}
                onPress={handleReturnToAdmin}
                disabled={submittingTreasurer}
              >
                {submittingTreasurer ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.confirmApproveBtnText}>Confirm Return</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Document Preview Lightbox Modal */}
      <Modal
        visible={!!previewDoc}
        animationType="fade"
        transparent
        onRequestClose={() => setPreviewDoc(null)}
      >
        <View style={s.previewModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setPreviewDoc(null)}
          />
          <View style={[s.previewModalBox, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={s.previewModalHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[s.previewModalTitle, { color: colors.text }]} numberOfLines={1}>
                  {previewDoc?.file_name}
                </Text>
                <Text style={[s.previewModalSubtitle, { color: colors.textSecondary }]}>
                  Attached Requirement / Proof
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {!!previewUrl && (
                  <TouchableOpacity
                    style={[s.previewActionBtn, { backgroundColor: colors.primary }]}
                    onPress={() => Linking.openURL(previewUrl)}
                  >
                    <Feather name="download" size={13} color="#fff" />
                    <Text style={s.previewActionBtnText}>Open</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[s.previewCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }]}
                  onPress={() => setPreviewDoc(null)}
                >
                  <Feather name="x" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Image Preview Body */}
            <View style={[s.previewImageBody, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}>
              {previewLoading ? (
                <View style={s.previewCenterState}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[s.previewLoadingText, { color: colors.textSecondary }]}>
                    Loading attachment...
                  </Text>
                </View>
              ) : previewError ? (
                <View style={s.previewCenterState}>
                  <Feather name="alert-circle" size={36} color="#ef4444" />
                  <Text style={s.previewErrorTitle}>Unable to load document</Text>
                  <Text style={[s.previewErrorSub, { color: colors.textSecondary }]}>{previewError}</Text>
                  <TouchableOpacity
                    style={[s.previewRetryBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handlePreviewDoc(previewDoc)}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : previewUrl ? (
                <Image
                  source={{ uri: previewUrl }}
                  style={s.previewImage}
                  resizeMode="contain"
                  onError={() => setPreviewError('File not found or unavailable')}
                />
              ) : null}
            </View>

            {/* Footer */}
            <View style={s.previewModalFooter}>
              <Text style={[s.previewFooterText, { color: colors.textSecondary }]} numberOfLines={1}>
                File: {previewDoc?.file_name}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  statusBar: { borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 16 },
  statusText: { fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  releaseConfirmedCard: {
    backgroundColor: isDark ? '#06281e' : '#ecfdf5',
    borderColor: '#10b981',
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#10b981',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  releaseConfirmedHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  releaseIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  releaseBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  releaseBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  releaseConfirmedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: isDark ? '#a7f3d0' : '#064e3b',
    marginBottom: 4,
  },
  releaseConfirmedSub: {
    fontSize: 12,
    color: isDark ? '#6ee7b7' : '#047857',
    lineHeight: 16,
  },
  releaseDivider: {
    height: 1,
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#a7f3d0',
    marginVertical: 14,
  },
  releaseMetaGrid: {
    gap: 10,
  },
  releaseMetaCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  releaseMetaLabel: {
    fontSize: 12,
    color: isDark ? '#6ee7b7' : '#065f46',
    fontWeight: '600',
  },
  releaseMetaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: isDark ? '#ecfdf5' : '#022c22',
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeLow: { backgroundColor: '#eff6ff' },
  badgeMed: { backgroundColor: '#fff7ed' },
  badgeHigh: { backgroundColor: '#fef2f2' },
  priorityLabel: { fontSize: 10, fontWeight: '800' },
  textLow: { color: '#2563eb' },
  textMed: { color: '#d97706' },
  textHigh: { color: '#dc2626' },
  infoRow: { marginBottom: 10 },
  infoLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 14, color: colors.text, lineHeight: 19 },
  emptyDocsText: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', paddingVertical: 6 },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  docIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docName: { fontSize: 13, fontWeight: '600', color: colors.text },
  docSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  actionBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  actionText: { fontWeight: '700', fontSize: 13 },
  linkBtn: { color: colors.primary, fontWeight: '700', fontSize: 14, marginTop: 14 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  modalSub: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  amountInput: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
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
  confirmApproveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
  },
  confirmApproveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },

  // Document View button & Lightbox Modal styles
  docViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff',
  },
  docViewBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  previewModalBox: {
    width: '100%',
    maxHeight: '88%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  previewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  previewModalTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  previewModalSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  previewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  previewActionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  previewCloseBtn: {
    padding: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImageBody: {
    width: '100%',
    height: 380,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewCenterState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  previewLoadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '500',
  },
  previewErrorTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
  },
  previewErrorSub: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  previewRetryBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  previewModalFooter: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  previewFooterText: {
    fontSize: 11,
  },
})
