import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { TeamSettingsPage } from '@/components/settings/TeamSettingsPage'
import { UpgradePrompt } from '@/components/billing/PlanGuard'

export default async function TeamPageRoute() {
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

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('org_id', activeOrgId)
    .maybeSingle()

  if ((sub?.plan ?? 'free') === 'free') {
    return (
      <div className="mx-auto w-full max-w-2xl py-6">
        <UpgradePrompt
          feature="Team Management"
          requiredPlan="pro"
          description="Invite and manage team members on the Pro or Scale plan."
        />
      </div>
    )
  }

  return <TeamSettingsPage />
}
