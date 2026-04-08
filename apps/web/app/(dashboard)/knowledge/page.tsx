/**
 * BUG FIX: Previously read `users.org_id` (original primary org).
 * After an org switch, this passed the OLD org ID to KnowledgeBasePage,
 * which then sent it to tRPC. But ctx.userOrgId in the tRPC middleware was
 * already resolved to the NEW active org → requireOrgAccess threw 403.
 *
 * FIX: Read `active_org_id ?? org_id` so we always pass the correct active org.
 */

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { KnowledgeBasePage } from '@/components/knowledge/KnowledgeBasePage'

export default async function KnowledgePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // FIXED: select both org_id and active_org_id
  const { data: userRecord } = await supabase
    .from('users')
    .select('org_id, active_org_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.org_id) redirect('/dashboard')

  // Use active_org_id if set, fall back to the primary org_id
  const activeOrgId = userRecord.active_org_id ?? userRecord.org_id

  return <KnowledgeBasePage orgId={activeOrgId} />
}