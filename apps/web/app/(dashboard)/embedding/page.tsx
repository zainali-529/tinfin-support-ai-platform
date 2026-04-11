import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { WidgetEmbeddingPage } from '@/components/widget/WidgetEmbeddingPage'

export default async function EmbeddingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRecord } = await supabase
    .from('users')
    .select('org_id, active_org_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.org_id) redirect('/dashboard')

  const activeOrgId = userRecord.active_org_id ?? userRecord.org_id

  const { data: membership } = await supabase
    .from('user_organizations')
    .select('role')
    .eq('user_id', user.id)
    .eq('org_id', activeOrgId)
    .maybeSingle()

  if (membership?.role !== 'admin') redirect('/dashboard')

  return <WidgetEmbeddingPage orgId={activeOrgId} />
}
