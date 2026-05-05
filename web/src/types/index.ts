export type Role = 'admin' | 'staff' | 'encoder' | 'resident'
export type AssistanceType = 'Medical' | 'Burial' | 'Educational' | 'Foods'
export type RequestStatus = 'Pending' | 'Approved' | 'Released' | 'Declined'
export type NotificationType = 'pending' | 'incomplete' | 'followup' | 'info'

export interface Profile {
  id: string
  full_name: string
  role: Role
  is_active: boolean
  created_at: string
  updated_at: string
  avatar_url?: string
}

export interface Beneficiary {
  id: string
  first_name: string
  middle_name?: string
  last_name: string
  suffix?: string
  birthdate: string
  sex: 'Male' | 'Female'
  civil_status: 'Single' | 'Married' | 'Widowed' | 'Separated' | 'Annulled'
  barangay: string
  address: string
  contact_number?: string
  is_pwd: boolean
  is_senior: boolean
  is_4ps: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface Request {
  id: string
  beneficiary_id: string
  assistance_type: AssistanceType
  status: RequestStatus
  amount_requested?: number
  amount_approved?: number
  purpose: string
  remarks?: string
  encoded_by?: string
  assessed_by?: string
  approved_by?: string
  created_at: string
  updated_at: string
  beneficiaries?: Beneficiary
  profiles?: Profile
}

export interface RequestDocument {
  id: string
  request_id: string
  file_name: string
  file_path: string
  file_type?: string
  uploaded_by?: string
  uploaded_at: string
}

export interface Assessment {
  id: string
  request_id: string
  interview_date: string
  findings: string
  recommendation: string
  home_visit: boolean
  assessed_by?: string
  created_at: string
  updated_at: string
}

export interface Payout {
  id: string
  request_id: string
  amount_released: number
  release_date: string
  released_by?: string
  acknowledgment_notes?: string
  created_at: string
  requests?: Request & { beneficiaries?: Beneficiary }
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  is_read: boolean
  request_id?: string
  created_at: string
}
