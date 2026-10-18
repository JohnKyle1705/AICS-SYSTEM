import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Search } from 'lucide-react'

export default async function FundTransactionsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string, type?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  // Ensure Admin
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'treasurer') redirect('/dashboard')

  // Build query
  let query = supabase
    .from('fund_transactions')
    .select('*, funds(assistance_type), profiles(full_name), requests(beneficiary_id, beneficiaries(first_name, last_name))')
    .order('created_at', { ascending: false })

  if (params.type) {
    query = query.eq('transaction_type', params.type)
  }

  const { data: transactions, error } = await query

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
  }

  const filteredTransactions = transactions?.filter(tx => {
    if (!params.q) return true
    const q = params.q.toLowerCase()
    const typeMatch = tx.funds?.assistance_type.toLowerCase().includes(q)
    const profMatch = tx.profiles?.full_name?.toLowerCase().includes(q)
    const benMatch = tx.requests?.beneficiaries?.first_name?.toLowerCase().includes(q) || tx.requests?.beneficiaries?.last_name?.toLowerCase().includes(q)
    const remMatch = tx.remarks?.toLowerCase().includes(q)
    return typeMatch || profMatch || benMatch || remMatch
  })

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/funds" className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Fund Ledger</h1>
          <p className="text-slate-600 dark:text-slate-400">Complete transaction history for all funds.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="relative w-full sm:w-96">
            <form>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                name="q"
                defaultValue={params.q}
                placeholder="Search by name, type, or remarks..." 
                className="form-input pl-10 w-full bg-white dark:bg-slate-900"
              />
              {params.type && <input type="hidden" name="type" value={params.type} />}
            </form>
          </div>

          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <Link href="/admin/funds/transactions" className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${!params.type ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              All Transactions
            </Link>
            <Link href="?type=Allocation" className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${params.type === 'Allocation' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              Allocations
            </Link>
            <Link href="?type=Release" className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${params.type === 'Release' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              Releases
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Date & Time</th>
                <th className="p-4 font-semibold">Type</th>
                <th className="p-4 font-semibold">Fund</th>
                <th className="p-4 font-semibold text-right">Amount</th>
                <th className="p-4 font-semibold text-right">Balance After</th>
                <th className="p-4 font-semibold">Details</th>
                <th className="p-4 font-semibold">Processed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredTransactions?.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No transactions found.
                  </td>
                </tr>
              )}
              {filteredTransactions?.map((tx) => {
                const isAdd = tx.transaction_type === 'Allocation'
                const isSubtract = tx.transaction_type === 'Release' || tx.transaction_type === 'Adjustment'
                
                return (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 text-sm whitespace-nowrap">
                      <div className="text-slate-900 dark:text-white font-medium">{new Date(tx.created_at).toLocaleDateString()}</div>
                      <div className="text-slate-500 text-xs">{new Date(tx.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        isAdd ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                        isSubtract ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {isAdd ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {tx.transaction_type}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-medium text-slate-900 dark:text-white">
                      {tx.funds?.assistance_type}
                    </td>
                    <td className={`p-4 text-sm font-bold text-right whitespace-nowrap ${
                      isAdd ? 'text-indigo-600 dark:text-indigo-400' :
                      isSubtract ? 'text-slate-900 dark:text-white' : ''
                    }`}>
                      {isAdd ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                    <td className="p-4 text-sm text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatCurrency(tx.balance_after)}
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-slate-900 dark:text-white">{tx.remarks}</div>
                      {tx.requests?.beneficiaries && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Beneficiary: {tx.requests.beneficiaries.first_name} {tx.requests.beneficiaries.last_name}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                      {tx.profiles?.full_name}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
