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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      
      if (!profile) {
        router.push('/login')
        return
      }

      switch (profile.role) {
        case 'admin':
          router.replace('/admin/dashboard')
          break
        case 'staff':
        case 'encoder':
          router.replace('/staff/dashboard')
          break
        case 'resident':
          router.replace('/resident/dashboard')
          break
        default:
          router.replace('/login')
      }
    }

    routeUser()
  }, [router, supabase])

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
