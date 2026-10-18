import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export interface TreasurySummary {
  totalFunds: number
  totalAllocated: number
  totalReleased: number
  remainingBalance: number
  pendingCount: number
  pendingAmount: number
  readyCount: number
  readyAmount: number
  approvedCount: number
  approvedAmount: number
  medicalFunds: {
    allocated: number
    released: number
    currentBalance: number
    threshold: number
    isLow: boolean
  }
  burialFunds: {
    allocated: number
    released: number
    currentBalance: number
    threshold: number
    isLow: boolean
  }
}

/**
 * Calculates unified, consistent treasury statistics directly from database records.
 * Prevents double-counting and ensures dashboards, fund tracking, and reports agree.
 */
export async function getTreasuryStats(): Promise<TreasurySummary> {
  // 1. Fetch funds records
  const { data: funds } = await supabaseAdmin
    .from('funds')
    .select('*')
    .order('assistance_type')

  const medFund = funds?.find((f) => f.assistance_type === 'Medical')
  const burFund = funds?.find((f) => f.assistance_type === 'Burial')

  const totalFunds = (funds || []).reduce((s, f) => s + Number(f.total_allocated || 0), 0)
  const totalReleased = (funds || []).reduce((s, f) => s + Number(f.total_released || 0), 0)
  const totalAvailable = (funds || []).reduce((s, f) => s + Number(f.current_balance || 0), 0)

  // 2. Fetch approved requests awaiting release
  const { data: approvedReqs } = await supabaseAdmin
    .from('requests')
    .select('id, assistance_type, amount_approved, release_status, status')
    .eq('status', 'Approved')

  const pendingList = (approvedReqs || []).filter(
    (r) => !r.release_status || r.release_status === 'Pending Release'
  )
  const readyList = (approvedReqs || []).filter(
    (r) => r.release_status === 'Ready for Release'
  )

  const pendingCount = pendingList.length
  const pendingAmount = pendingList.reduce((s, r) => s + Number(r.amount_approved || 0), 0)

  const readyCount = readyList.length
  const readyAmount = readyList.reduce((s, r) => s + Number(r.amount_approved || 0), 0)

  const approvedCount = (approvedReqs || []).length
  const approvedAmount = (approvedReqs || []).reduce((s, r) => s + Number(r.amount_approved || 0), 0)

  // Total allocated for approved requests waiting in pipeline
  const totalAllocatedToRequests = approvedAmount

  // Remaining balance = current available minus reserved approved requests
  const remainingBalance = Math.max(0, totalAvailable - readyAmount)

  return {
    totalFunds,
    totalAllocated: totalAllocatedToRequests,
    totalReleased,
    remainingBalance,
    pendingCount,
    pendingAmount,
    readyCount,
    readyAmount,
    approvedCount,
    approvedAmount,
    medicalFunds: {
      allocated: Number(medFund?.total_allocated || 0),
      released: Number(medFund?.total_released || 0),
      currentBalance: Number(medFund?.current_balance || 0),
      threshold: Number(medFund?.low_balance_threshold || 10000),
      isLow: Number(medFund?.current_balance || 0) <= Number(medFund?.low_balance_threshold || 10000),
    },
    burialFunds: {
      allocated: Number(burFund?.total_allocated || 0),
      released: Number(burFund?.total_released || 0),
      currentBalance: Number(burFund?.current_balance || 0),
      threshold: Number(burFund?.low_balance_threshold || 10000),
      isLow: Number(burFund?.current_balance || 0) <= Number(burFund?.low_balance_threshold || 10000),
    },
  }
}
