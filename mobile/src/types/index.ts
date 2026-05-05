export type Role = 'admin' | 'staff' | 'encoder' | 'resident'
export type AssistanceType = 'Medical' | 'Burial' | 'Educational' | 'Foods'
export type RequestStatus = 'Pending' | 'Approved' | 'Released' | 'Declined'

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
  civil_status: string
  barangay: string
  address: string
  contact_number?: string
  is_pwd: boolean
  is_senior: boolean
  is_4ps: boolean
  created_at: string
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
  created_at: string
  beneficiaries?: Beneficiary
}

export interface Notification {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}
