import { AIActionsAdminPage } from '@/components/actions/AIActionsAdminPage'
import { requireServerOrgAdmin } from '@/lib/server-org-access'

export default async function AIActionsPage() {
  await requireServerOrgAdmin('/dashboard')

  return <AIActionsAdminPage />
}
