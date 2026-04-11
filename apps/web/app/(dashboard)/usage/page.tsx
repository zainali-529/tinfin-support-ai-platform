/**
 * apps/web/app/(dashboard)/usage/page.tsx
 */
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { UsagePage } from '@/components/settings/UsagePage'

export default async function UsagePageRoute() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRecord } = await supabase
    .from('users')
    .select('org_id, active_org_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.org_id) redirect('/dashboard')

  return <UsagePage />
}
