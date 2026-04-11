import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Keep settings page accessible for future general settings content.
  const { data: userRecord } = await supabase
    .from('users')
    .select('org_id, active_org_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.org_id) redirect('/dashboard')

  return (
    <div className="mx-auto w-full max-w-3xl py-6">
      <div className="rounded-xl border bg-card p-6">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          General settings will appear here. Usage, Billing, and Team are now available as separate sidebar sections.
        </p>
      </div>
    </div>
  )
}