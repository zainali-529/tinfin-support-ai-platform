import { WhatsAppSetupPage } from '@/components/channels/WhatsAppSetupPage'
import { requireServerOrgPermission } from '@/lib/server-org-access'

export default async function WhatsAppSettingsRoute() {
  await requireServerOrgPermission('channels')
  return <WhatsAppSetupPage />
}
