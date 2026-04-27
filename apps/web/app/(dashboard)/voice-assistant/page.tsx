import { VoiceSettingsPanel } from '@/components/voice/VoiceSettingsPanel'
import { MicIcon } from 'lucide-react'
import { requireServerOrgPermission } from '@/lib/server-org-access'

export default async function VoiceAssistantPage() {
  await requireServerOrgPermission('voiceAssistant')

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
