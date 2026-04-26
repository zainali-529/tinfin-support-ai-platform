import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { CannedResponsesAdminPage } from '@/components/canned/CannedResponsesAdminPage'

export default async function CannedResponsesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRecord } = await supabase
    .from('users')
    .select('org_id, active_org_id')
    .eq('id', user.id)
    .maybeSingle()

  const activeOrgId = userRecord?.active_org_id ?? userRecord?.org_id
  if (!activeOrgId) redirect('/inbox')

  const { data: membership } = await supabase
    .from('user_organizations')
    .select('role')
    .eq('user_id', user.id)
    .eq('org_id', activeOrgId)
    .maybeSingle()

  if (membership?.role !== 'admin') {
    redirect('/inbox')
  }

  return <CannedResponsesAdminPage />
}
