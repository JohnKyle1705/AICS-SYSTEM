export const BARANGAYS = [
  'Aguho', 'Bagay', 'Bakhaw', 'Bateria', 'Bitoon', 'Calape', 'Carnaza',
  'Daanbantayan', 'Dalingding', 'Lanao', 'Logon', 'Malbago', 'Malingin',
  'Maya', 'Pajo', 'Paypay', 'Poblacion', 'Talisay', 'Tapilon', 'Tinubdan', 'Tominjao'
]

export const ASSISTANCE_TYPES = ['Medical', 'Burial', 'Educational', 'Foods'] as const

export const REQUEST_STATUSES = ['Pending', 'Approved', 'Released', 'Declined'] as const

export const STATUS_COLORS: Record<string, string> = {
  Pending: 'badge-pending',
  Approved: 'badge-approved',
  Released: 'badge-released',
  Declined: 'badge-declined',
}

export const ASSISTANCE_COLORS: Record<string, string> = {
  Medical: '#3b82f6',
  Burial: '#6b7280',
  Educational: '#8b5cf6',
  Foods: '#f59e0b',
}
