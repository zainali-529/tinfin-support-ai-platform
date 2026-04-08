/**
 * BUG FIX: Same as knowledge page — was reading users.org_id (primary, immutable)
 * instead of users.active_org_id (currently selected org).
 *
 * This caused WidgetCustomizationPage to load config from the old org and tRPC
 * calls to fail with 403 because the orgId mismatch triggered requireOrgAccess.
 */

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { WidgetCustomizationPage } from '@/components/widget/WidgetCustomizationPage'

export default async function WidgetPage() {
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

  return <WidgetCustomizationPage orgId={activeOrgId} />
}