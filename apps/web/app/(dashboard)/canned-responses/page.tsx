import { CannedResponsesAdminPage } from '@/components/canned/CannedResponsesAdminPage'
import { requireServerOrgPermission } from '@/lib/server-org-access'

export default async function CannedResponsesPage() {
  await requireServerOrgPermission('cannedResponses', '/inbox')

  return <CannedResponsesAdminPage />
}
