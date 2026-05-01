import { AIProfilePage } from '@/components/ai-profile/AIProfilePage'
import { requireServerOrgPermission } from '@/lib/server-org-access'

export default async function AIProfileDashboardPage() {
  await requireServerOrgPermission('knowledge')

  return <AIProfilePage />
}

