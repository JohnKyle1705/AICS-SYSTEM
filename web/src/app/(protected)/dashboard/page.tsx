'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function DashboardRouter() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const routeUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/login')
        return
      }
      const user = session.user
      const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
      
      // If no profile found, try to create one (upsert to avoid duplicate key errors).
      // Then redirect to /pending since new accounts need admin activation.
      if (!profile) {
        await supabase.from('profiles').upsert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
          role: 'resident',
          is_active: false,
        }, { onConflict: 'id', ignoreDuplicates: true })

        router.replace('/pending')
        return
      }

      // If profile exists but is not active, go to pending
      if (!profile.is_active) {
        router.replace('/pending')
        return
      }

      switch (profile.role) {
        case 'admin':
          router.replace('/admin/dashboard')
          break
        case 'resident':
          router.replace('/resident/dashboard')
          break
        case 'treasurer':
          router.replace('/treasurer')
          break
        default:
          router.replace('/login')
      }
    }

    routeUser()
  }, [router])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600">
        <Loader2 size={24} className="animate-spin" />
      </div>
      <p className="text-[var(--color-text-secondary)] text-sm font-medium animate-pulse">
        Redirecting to your dashboard...
      </p>
    </div>
  )
}
