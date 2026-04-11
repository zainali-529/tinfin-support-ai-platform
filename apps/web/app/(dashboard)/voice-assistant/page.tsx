import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { VoiceSettingsPanel } from '@/components/voice/VoiceSettingsPanel'
import { MicIcon } from 'lucide-react'

export default async function VoiceAssistantPage() {
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

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <MicIcon className="size-6 text-primary" />
          Voice Assistant
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your AI assistant for website voice calls.
        </p>
      </div>

      <VoiceSettingsPanel />
    </div>
  )
}
