'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BeneficiaryForm from '@/components/BeneficiaryForm'
import { ShieldAlert, MapPin, Phone } from 'lucide-react'
import Link from 'next/link'

export default function NewBeneficiaryPage() {
  const router = useRouter()
  const supabase = createClient()
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setRole(profile?.role ?? null)
      setLoading(false)
    }
    checkRole()
  }, [router, supabase])

  if (loading) return null

  // Residents cannot self-register — admin must register them in person
  if (role === 'resident') {
    return (
      <div className="max-w-lg mx-auto my-14 card p-8 sm:p-10 text-center space-y-6 border border-[var(--color-border)] shadow-xl rounded-2xl animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-500 flex items-center justify-center mx-auto">
          <ShieldAlert size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--color-text)]">In-Person Registration Required</h1>
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed max-w-md mx-auto">
            Beneficiary registration must be completed in person at the <strong>Daanbantayan MSWD Office</strong>. 
            Please visit us and bring valid identification documents to be registered in the system by our staff.
          </p>
        </div>
        <div className="bg-[var(--color-surface)] rounded-xl p-4 text-left space-y-3 border border-[var(--color-border)]">
          <div className="flex items-start gap-3 text-sm text-[var(--color-text-secondary)]">
            <MapPin size={16} className="text-blue-500 mt-0.5 shrink-0" />
            <span>Daanbantayan MSWD Office, Daanbantayan, Cebu</span>
          </div>
          <div className="flex items-start gap-3 text-sm text-[var(--color-text-secondary)]">
            <Phone size={16} className="text-blue-500 mt-0.5 shrink-0" />
            <span>Contact the MSWD office for office hours and requirements</span>
          </div>
        </div>
        <Link href="/resident/dashboard" className="btn btn-primary px-8 inline-block">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5" id="new-beneficiary-page">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Add Beneficiary</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">Register a new AICS beneficiary</p>
      </div>
      <BeneficiaryForm />
    </div>
  )
}
