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

export const FUNERAL_HOMES_BOGO_TO_DAANBANTAYAN = [
  // Daanbantayan
  'St. Peter Funeral Home - Daanbantayan',
  'St. Francis Memorial Funeral Homes - Daanbantayan',
  'Llorente Funeral Chapel - Daanbantayan',
  'San Jose Memorial Homes - Daanbantayan',
  // Medellin
  'Metro Funeral Home - Medellin',
  'Obedencio Funeral Home - Medellin',
  'St. Peter Funeral Home - Medellin',
  // San Remigio
  'San Remigio Memorial Homes - San Remigio',
  // Bogo City
  'St. Peter Funeral Home - Bogo City',
  'Cosmopolitan Funeral Home - Bogo City',
  'Reamillo Funeral Chapel - Bogo City',
  'San Roque Funeral Chapel - Bogo City',
  'Bogo Memorial Chapel - Bogo City',
  // Fallback
  'Other Funeral Home (Within Bogo to Daanbantayan Area)',
]

export const BENEFICIARY_RELATIONSHIPS = [
  'Spouse',
  'Son',
  'Daughter',
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Grandfather',
  'Grandmother',
  'Grandson',
  'Granddaughter',
  'Uncle',
  'Aunt',
  'Nephew',
  'Niece',
  'Cousin',
  'Father-in-law',
  'Mother-in-law',
  'Son-in-law',
  'Daughter-in-law',
  'Brother-in-law',
  'Sister-in-law',
  'Common-law Partner / Live-in Partner',
  'Neighbor / Silingan (Authorized Representative)',
  'Legal Guardian',
  'Other Relative (Specify in remarks)',
  'Other (Specify in remarks)',
]
