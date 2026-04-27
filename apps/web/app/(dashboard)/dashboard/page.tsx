import { DashboardHome } from '@/components/dashboard/DashboardHome'
import { requireServerOrgPermission } from '@/lib/server-org-access'

export default async function DashboardPage() {
  await requireServerOrgPermission('dashboard')
  return <DashboardHome />
}
