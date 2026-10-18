import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Linking, Modal, TextInput
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

  // Approval Modal State
  const [approvalModalOpen, setApprovalModalOpen] = useState(false)
  const [approvedAmount, setApprovedAmount] = useState('')
  const [submittingApproval, setSubmittingApproval] = useState(false)

  // Treasurer Action States
  const [voucherModalOpen, setVoucherModalOpen]       = useState(false)
  const [voucherNo, setVoucherNo]                     = useState('')
  const [checkNo, setCheckNo]                         = useState('')
  const [paymentMethod, setPaymentMethod]             = useState('Cash')
  const [disbursingOfficer, setDisbursingOfficer]     = useState('')
  const [voucherNotes, setVoucherNotes]               = useState('')
  const [returnModalOpen, setReturnModalOpen]         = useState(false)
  const [returnRemarks, setReturnRemarks]             = useState('')
  const [submittingTreasurer, setSubmittingTreasurer] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [{ data: req }, { data: docs }, { data: assess }, { data: pay }] = await Promise.all([
        supabase.from('requests').select('*, beneficiaries(*)').eq('id', id).single(),
        supabase.from('request_documents').select('*').eq('request_id', id),
        supabase.from('assessments').select('*').eq('request_id', id).maybeSingle(),
        supabase.from('payouts').select('*').eq('request_id', id).maybeSingle(),
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

  const openDocUrl = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 300)
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

      // 4. Notify treasurers
      const { data: treasurers } = await supabase.from('profiles').select('id').eq('role', 'treasurer')
      if (treasurers && treasurers.length > 0) {
        const benName = request.beneficiaries ? `${request.beneficiaries.first_name} ${request.beneficiaries.last_name}` : 'Unknown'
        const notifications = treasurers.map(t => ({
          user_id: t.id,
          title: 'Ready for Processing',
          message: `New approved request ready for processing: ${benName} – ${request.assistance_type} Assistance – ₱${amt.toLocaleString()}.`,
          type: 'info',
          request_id: id,
        }))
        await supabase.from('notifications').insert(notifications)
      }

      setApprovalModalOpen(false)
      setRequest((prev: any) => ({ ...prev, status: 'Approved', amount_approved: amt, release_status: 'Pending Release' }))
      Alert.alert('Success', 'Request approved successfully!')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmittingApproval(false)
    }
  }

  const updateStatus = async (status: string) => {
    if (status === 'Approved') {
      setApprovalModalOpen(true)
      return
    }

    Alert.alert('Confirm', `Mark request as ${status}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          const { data: { user } } = await supabase.auth.getUser()
          const updatePayload: any = { status }
          if (status === 'Released') {
            updatePayload.release_status = 'Released'
          }
          const { error } = await supabase.from('requests').update(updatePayload).eq('id', id)
          if (error) {
            Alert.alert('Error', error.message)
            return
          }

          if (status === 'Released' && request.amount_approved) {
            const { data: existingPayout } = await supabase.from('payouts').select('id').eq('request_id', id).maybeSingle()
            if (!existingPayout) {
              await supabase.from('payouts').insert({
                request_id: id,
                amount_released: Number(request.amount_approved),
                release_date: new Date().toISOString().split('T')[0],
                released_by: user?.id ?? null,
                acknowledgment_notes: 'Released via Request Details',
              })
            }
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
              type: status === 'Released' ? 'info' : 'pending',
              request_id: id,
            })
          }

          setRequest((prev: any) => ({ ...prev, status, ...(status === 'Released' ? { release_status: 'Released' } : {}) }))
        },
      },
    ])
  }

  const handleSaveVoucher = async () => {
    if (!voucherNo.trim()) {
      Alert.alert('Required', 'Please enter a Disbursement Voucher (DV) Number.')
      return
    }
    setSubmittingTreasurer(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('requests').update({
        release_status: 'Ready for Release',
        extra_fields: {
          ...(request.extra_fields || {}),
          voucher_number: voucherNo.trim(),
          check_number: checkNo.trim() || null,
          payment_method: paymentMethod,
          disbursing_officer: disbursingOfficer.trim() || profile?.full_name || 'Municipal Treasurer',
          voucher_notes: voucherNotes.trim() || null,
        }
      }).eq('id', id)

      if (error) throw error

      if (user) {
        await supabase.from('system_logs').insert({
          user_id: user.id,
          action: 'PROCESS_VOUCHER',
          table_name: 'requests',
          record_id: id,
          details: { voucher_number: voucherNo.trim(), release_status: 'Ready for Release' }
        })
      }

      setVoucherModalOpen(false)
      loadData()
      Alert.alert('Success', 'Voucher details recorded! Request is now Ready for Release.')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmittingTreasurer(false)
    }
  }

  const handleConfirmRelease = async () => {
    if (!request.amount_approved || Number(request.amount_approved) <= 0) {
      Alert.alert('Cannot Release', 'Approved amount is missing or zero.')
      return
    }

    Alert.alert(
      'Confirm Disbursement',
      `Release ₱${Number(request.amount_approved).toLocaleString()} to ${b?.first_name} ${b?.last_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmittingTreasurer(true)
            try {
              const { data: { user } } = await supabase.auth.getUser()
              const amt = Number(request.amount_approved)

              // 1. Create Payout
              const { error: payErr } = await supabase.from('payouts').insert({
                request_id: id,
                amount_released: amt,
                release_date: new Date().toISOString().split('T')[0],
                released_by: user?.id,
                acknowledgment_notes: 'Disbursed via Mobile Treasurer Actions'
              })
              if (payErr) throw payErr

              // 2. Update Request
              await supabase.from('requests').update({
                status: 'Released',
                release_status: 'Released'
              }).eq('id', id)

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
                    remarks: `Mobile Disbursement for Request #${id.slice(0, 8).toUpperCase()}`
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
                  details: { amount_released: amt, release_status: 'Released' }
                })
              }

              // 5. Notify Resident
              if (request.encoded_by) {
                await supabase.from('notifications').insert({
                  user_id: request.encoded_by,
                  title: 'Assistance Released',
                  message: `Your ${request.assistance_type} assistance payout of ₱${amt.toLocaleString()} has been disbursed.`,
                  type: 'info',
                  request_id: id
                })
              }

              loadData()
              Alert.alert('Success', 'Assistance payout released and recorded successfully!')
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
              onPress={() => openDocUrl(doc.file_path)}
            >
              <View style={s.docIconBox}>
                <Feather name="file" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.docName}>{doc.file_name}</Text>
                <Text style={s.docSub}>Tap to view attachment</Text>
              </View>
              <Feather name="external-link" size={16} color={colors.primary} />
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
            {['Pending', 'Approved', 'Released', 'Declined'].filter(st => st !== request.status).map(st => {
              const sc = STATUS_COLORS[st]
              return (
                <TouchableOpacity 
                  key={st} 
                  style={[s.actionBtn, { borderColor: isDark ? sc.darkText : sc.text }]}
                  onPress={() => updateStatus(st)} 
                  activeOpacity={0.7}
                >
                  <Text style={[s.actionText, { color: isDark ? sc.darkText : sc.text }]}>Mark {st}</Text>
                </TouchableOpacity>
              )
            })}
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
            <Text style={s.sectionTitle}>Treasurer Financial Processing</Text>
            <Feather name="briefcase" size={16} color={colors.primary} />
          </View>

          {request.status === 'Approved' ? (
            <View style={{ gap: 10, marginTop: 4 }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                Approved Amount: <Text style={{ fontWeight: 'bold', color: '#10b981' }}>₱{Number(request.amount_approved || 0).toLocaleString()}</Text>
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                Release Status: <Text style={{ fontWeight: 'bold', color: colors.text }}>{request.release_status || 'Pending Release'}</Text>
              </Text>

              {request.release_status !== 'Released' && (
                <View style={{ gap: 8, marginTop: 6 }}>
                  <TouchableOpacity
                    style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 10, alignItems: 'center' }}
                    onPress={() => {
                      setVoucherNo(request.extra_fields?.voucher_number || `DV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)
                      setCheckNo(request.extra_fields?.check_number || '')
                      setPaymentMethod(request.extra_fields?.payment_method || 'Cash')
                      setDisbursingOfficer(request.extra_fields?.disbursing_officer || profile?.full_name || 'Municipal Treasurer')
                      setVoucherNotes(request.extra_fields?.voucher_notes || '')
                      setVoucherModalOpen(true)
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Process Disbursement Voucher</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ backgroundColor: '#10b981', padding: 12, borderRadius: 10, alignItems: 'center' }}
                    onPress={handleConfirmRelease}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Confirm Payout & Release</Text>
                  </TouchableOpacity>

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
                    ✓ Financial release complete and ledger updated.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={{ padding: 10, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 8, marginTop: 6 }}>
              <Text style={{ fontSize: 12, color: '#b45309' }}>
                Application approval and decline is restricted to Admin. Treasurers disburse assistance once approved.
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
              Set the assistance amount approved for {b?.first_name} {b?.last_name}. Treasurers will disburse this amount.
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

      {/* Treasurer Voucher Processing Modal */}
      <Modal visible={voucherModalOpen} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Process Disbursement Voucher</Text>
              <TouchableOpacity onPress={() => setVoucherModalOpen(false)}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={s.modalSub}>
              Record disbursement voucher for {b?.first_name} {b?.last_name} (₱{Number(request.amount_approved || 0).toLocaleString()}).
            </Text>

            <Text style={s.inputLabel}>Disbursement Voucher (DV) # *</Text>
            <TextInput
              style={s.amountInput}
              placeholder="e.g. DV-2026-10-0089"
              placeholderTextColor={colors.textSecondary}
              value={voucherNo}
              onChangeText={setVoucherNo}
            />

            <Text style={s.inputLabel}>Check / Reference # (Optional)</Text>
            <TextInput
              style={s.amountInput}
              placeholder="e.g. CHK-554219"
              placeholderTextColor={colors.textSecondary}
              value={checkNo}
              onChangeText={setCheckNo}
            />

            <Text style={s.inputLabel}>Payment Method</Text>
            <TextInput
              style={s.amountInput}
              placeholder="Cash / Cheque / Bank Transfer"
              placeholderTextColor={colors.textSecondary}
              value={paymentMethod}
              onChangeText={setPaymentMethod}
            />

            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setVoucherModalOpen(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.confirmApproveBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.8}
                onPress={handleSaveVoucher}
                disabled={submittingTreasurer}
              >
                {submittingTreasurer ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.confirmApproveBtnText}>Save & Ready</Text>
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
    </ScrollView>
  )
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  statusBar: { borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 16 },
  statusText: { fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
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
})
