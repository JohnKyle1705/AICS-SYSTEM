export const BARANGAY_PAJO = 'Barangay Pajo'

export const BARANGAYS = [BARANGAY_PAJO]

export const PUROKS_PAJO = [
  'Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5',
  'Purok 6', 'Purok 7', 'Purok 8', 'Purok 9', 'Purok 10',
  'Purok Centro', 'Purok Riverside', 'Purok San Isidro',
  'Purok Lower Pajo', 'Purok Upper Pajo',
]

export const ASSISTANCE_TYPES = ['Medical', 'Burial'] as const

export const REQUEST_STATUSES = ['Pending', 'Approved', 'Released', 'Declined'] as const

export const STATUS_COLORS: Record<string, string> = {
  Pending: 'badge-pending',
  Approved: 'badge-approved',
  Released: 'badge-released',
  Declined: 'badge-declined',
}

export const ASSISTANCE_COLORS: Record<string, string> = {
  Medical: '#3b82f6',
  Burial: '#64748b'
}
