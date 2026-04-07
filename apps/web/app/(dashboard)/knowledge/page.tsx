import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { KnowledgeBasePage } from '@/components/knowledge/KnowledgeBasePage'

export default async function KnowledgePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: userRecord } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.org_id) redirect('/dashboard')

  return <KnowledgeBasePage orgId={userRecord.org_id} />
}