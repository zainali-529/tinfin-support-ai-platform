import { supabaseAdmin } from '@/lib/supabase-admin'
import { TeamSettingsPage } from '@/components/settings/TeamSettingsPage'
import { UpgradePrompt } from '@/components/billing/PlanGuard'
import { requireServerOrgAdmin } from '@/lib/server-org-access'

export default async function TeamPageRoute() {
  const access = await requireServerOrgAdmin()
  const activeOrgId = access.activeOrgId

  // Use service-role client for subscription reads to avoid role/RLS-specific false "free" fallbacks.
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('plan')
    .eq('org_id', activeOrgId)
    .maybeSingle()

  if ((sub?.plan ?? 'free') === 'free') {
    return (
      <div className="mx-auto w-full max-w-2xl py-6">
        <UpgradePrompt
          feature="Team Management"
          requiredPlan="starter"
          description="Invite and manage team members on Starter, Pro, or Scale."
        />
      </div>
    )
  }

  return <TeamSettingsPage />
}
