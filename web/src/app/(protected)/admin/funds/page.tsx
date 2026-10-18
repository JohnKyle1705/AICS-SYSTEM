import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Wallet, TrendingUp, AlertCircle, History, ArrowUpRight, ArrowDownRight, PlusCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import AllocationModal from './AllocationModal'

export default async function FundsDashboard() {
  const supabase = await createClient()

  // Ensure Admin
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'treasurer') redirect('/dashboard')

  // Fetch Funds
  const { data: funds, error } = await supabase.from('funds').select('*').order('assistance_type')
  
  if (error) {
    console.error('Error fetching funds:', error)
  }

  // Calculate totals
  const totalAvailable = funds?.reduce((sum, fund) => sum + Number(fund.current_balance), 0) || 0
  const totalAllocated = funds?.reduce((sum, fund) => sum + Number(fund.total_allocated), 0) || 0
  const totalReleased = funds?.reduce((sum, fund) => sum + Number(fund.total_released), 0) || 0

  // Count pending releases (Approved requests not yet marked as Released)
  const { count: pendingCount } = await supabase
    .from('requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Approved')
    .or('release_status.is.null,release_status.neq.Released')

  const finalPendingCount = pendingCount || 0

  // Fetch recent transactions
  const { data: transactions } = await supabase
    .from('fund_transactions')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(5)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Fund Tracking Dashboard</h1>
          <p className="text-slate-600 dark:text-slate-400">Monitor and manage municipal AICS fund allocations.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/funds/transactions" className="btn bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
            <History size={18} className="mr-2" /> View Ledger
          </Link>
          <AllocationModal funds={funds || []} />
        </div>
      </div>

      {/* Warnings */}
      {funds?.map(fund => {
        if (Number(fund.current_balance) <= Number(fund.low_balance_threshold)) {
          return (
            <div key={fund.id} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex items-start gap-3">
              <AlertTriangle className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-400">Low Balance Warning: {fund.assistance_type} Assistance</h3>
                <p className="text-sm text-amber-700 dark:text-amber-500 mt-1">
                  The available funds ({formatCurrency(fund.current_balance)}) have reached the low threshold ({formatCurrency(fund.low_balance_threshold)}). Please allocate more funds soon.
                </p>
              </div>
            </div>
          )
        }
        return null
      })}

      {/* Overall Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-500 dark:text-slate-400">Total Available Funds</h3>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg">
              <Wallet size={20} />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalAvailable)}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-500 dark:text-slate-400">Total Allocated</h3>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-lg">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalAllocated)}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-500 dark:text-slate-400">Total Released</h3>
            <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg">
              <ArrowDownRight size={20} />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalReleased)}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-500 dark:text-slate-400">Pending Releases</h3>
            <div className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-lg">
              <AlertCircle size={20} />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{finalPendingCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funds Breakdown */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Fund Breakdown by Type</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {funds?.map(fund => {
              const percentage = fund.total_allocated > 0 
                ? (Number(fund.current_balance) / Number(fund.total_allocated)) * 100 
                : 0

              return (
                <div key={fund.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{fund.assistance_type} Assistance</h3>
                      <p className="text-sm text-slate-500">Threshold: {formatCurrency(fund.low_balance_threshold)}</p>
                    </div>
                    <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                      <Wallet size={18} className="text-slate-600 dark:text-slate-300" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-500">Available Balance</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(fund.current_balance)}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5">
                        <div 
                          className={`h-2.5 rounded-full ${percentage > 20 ? 'bg-blue-600' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                      <div>
                        <p className="text-xs text-slate-500">Total Allocated</p>
                        <p className="font-medium text-slate-900 dark:text-white">{formatCurrency(fund.total_allocated)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Total Released</p>
                        <p className="font-medium text-slate-900 dark:text-white">{formatCurrency(fund.total_released)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            
            {(!funds || funds.length === 0) && (
              <div className="col-span-2 text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 border-dashed">
                <Wallet className="mx-auto h-12 w-12 text-slate-400 mb-3" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">No funds tracked</h3>
                <p className="text-slate-500 mt-1">Please ensure the SQL migration for funds was executed.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Activity</h2>
            <Link href="/admin/funds/transactions" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {transactions?.length === 0 && (
                <div className="p-6 text-center text-slate-500">No recent transactions</div>
              )}
              {transactions?.map(tx => (
                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      tx.transaction_type === 'Allocation' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
                      tx.transaction_type === 'Release' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      {tx.transaction_type === 'Allocation' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {tx.transaction_type}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${
                      tx.transaction_type === 'Allocation' ? 'text-indigo-600 dark:text-indigo-400' :
                      tx.transaction_type === 'Release' ? 'text-slate-900 dark:text-white' : ''
                    }`}>
                      {tx.transaction_type === 'Allocation' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Balance: {formatCurrency(tx.balance_after)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
