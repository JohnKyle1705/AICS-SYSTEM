'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PlusCircle, Loader2, X, AlertTriangle } from 'lucide-react'

type Fund = {
  id: string
  assistance_type: string
  total_allocated: number
  total_released: number
  current_balance: number
  low_balance_threshold: number
}

export default function AllocationModal({ funds }: { funds: Fund[] }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [fundId, setFundId] = useState(funds[0]?.id || '')
  const [transactionType, setTransactionType] = useState('Allocation')
  const [amount, setAmount] = useState('')
  const [remarks, setRemarks] = useState('')
  const [threshold, setThreshold] = useState('')

  const handleOpen = () => {
    if (funds.length > 0) {
      setFundId(funds[0].id)
      setThreshold(funds[0].low_balance_threshold.toString())
    }
    setIsOpen(true)
  }

  const handleFundChange = (id: string) => {
    setFundId(id)
    const fund = funds.find(f => f.id === id)
    if (fund) {
      setThreshold(fund.low_balance_threshold.toString())
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount greater than 0.')
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const selectedFund = funds.find(f => f.id === fundId)
    if (!selectedFund) return

    const numAmount = Number(amount)
    const newThreshold = threshold ? Number(threshold) : selectedFund.low_balance_threshold

    // Calculate new balance
    let newBalance = Number(selectedFund.current_balance)
    let newTotalAllocated = Number(selectedFund.total_allocated)

    if (transactionType === 'Allocation') {
      newBalance += numAmount
      newTotalAllocated += numAmount
    } else if (transactionType === 'Adjustment') {
      // Adjustment can be negative, but let's assume UI handles positive input and we deduct
      // Wait, if it's "Add Adjustment" or "Deduct Adjustment"? Let's simplify and make the amount signed if it's an adjustment, but for now let's just do Allocation to add funds.
      // We will treat Adjustment as deducting funds.
      newBalance -= numAmount
      newTotalAllocated -= numAmount // reduce total allocated as well? Usually yes.
      if (newBalance < 0) {
        setError('Adjustment would cause balance to fall below zero.')
        setLoading(false)
        return
      }
    }

    // 1. Update funds table
    const { error: updateError } = await supabase
      .from('funds')
      .update({
        total_allocated: newTotalAllocated,
        current_balance: newBalance,
        low_balance_threshold: newThreshold,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      })
      .eq('id', fundId)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // 2. Insert transaction log
    const { error: txError } = await supabase
      .from('fund_transactions')
      .insert({
        fund_id: fundId,
        transaction_type: transactionType,
        amount: numAmount,
        balance_after: newBalance,
        remarks: remarks || `Manual ${transactionType}`,
        processed_by: user.id
      })

    if (txError) {
      setError(txError.message)
      setLoading(false)
      return
    }

    setIsOpen(false)
    setAmount('')
    setRemarks('')
    setTransactionType('Allocation')
    router.refresh()
    setLoading(false)
  }

  return (
    <>
      <button 
        onClick={handleOpen}
        className="btn btn-primary"
      >
        <PlusCircle size={18} className="mr-2" /> Manage Funds
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Manage Funds</h2>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {funds.length === 0 ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-500 rounded-lg flex gap-3">
                  <AlertTriangle className="shrink-0" />
                  <p className="text-sm">No funds available. Please ask your administrator to run the SQL migration.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="form-label block mb-1">Select Assistance Fund</label>
                    <select 
                      value={fundId} 
                      onChange={(e) => handleFundChange(e.target.value)}
                      className="form-input w-full bg-white dark:bg-slate-900"
                    >
                      {funds.map(f => (
                        <option key={f.id} value={f.id}>{f.assistance_type} Assistance</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label block mb-1">Action</label>
                      <select 
                        value={transactionType} 
                        onChange={(e) => setTransactionType(e.target.value)}
                        className="form-input w-full bg-white dark:bg-slate-900"
                      >
                        <option value="Allocation">Add Allocation (+)</option>
                        <option value="Adjustment">Deduct Adjustment (-)</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label block mb-1">Amount (₱)</label>
                      <input 
                        type="number" 
                        required 
                        min="1"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="form-input w-full"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label block mb-1">Low Balance Warning Threshold (₱)</label>
                    <input 
                      type="number" 
                      required 
                      min="0"
                      step="0.01"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                      className="form-input w-full"
                      placeholder="e.g. 10000"
                    />
                    <p className="text-xs text-slate-500 mt-1">Updates the threshold for this fund type.</p>
                  </div>

                  <div>
                    <label className="form-label block mb-1">Remarks (Optional)</label>
                    <input 
                      type="text" 
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="form-input w-full"
                      placeholder="e.g. Q3 Additional Budget"
                    />
                  </div>

                  {error && (
                    <div className="text-red-500 text-sm mt-2">{error}</div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setIsOpen(false)} className="btn bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 flex-1">
                      Cancel
                    </button>
                    <button type="submit" disabled={loading} className="btn btn-primary flex-1">
                      {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Confirm'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  )
}
