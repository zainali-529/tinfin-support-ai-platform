/**
 * apps/web/app/(dashboard)/dashboard/analytics/page.tsx
 */

import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'
import { requireServerOrgPermission } from '@/lib/server-org-access'

export default async function AnalyticsPage() {
  await requireServerOrgPermission('analytics')

  return <AnalyticsDashboard />
}
