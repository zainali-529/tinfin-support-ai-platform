import { EmailSettingsPage } from '@/components/email/EmailSettingsPage'
import { requireServerOrgPermission } from '@/lib/server-org-access'

export default async function EmailSettingsRoute() {
  await requireServerOrgPermission('channels')

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <EmailSettingsPage />
    </div>
  )
}
